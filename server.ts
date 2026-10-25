import fs from 'fs';
import dotenv from 'dotenv';
import crypto from 'crypto';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { GoogleGenAI } from '@google/genai';
import {
  type RawModelRecommendedItem,
  validateModelRecommendations,
} from './src/utils/validateAssistantRecommendation.ts';
import type {
  AuditLog,
  CustomerAccount,
  GroupParticipantOrderSummary,
  Order,
  OrderLineItem,
  OrderStatus,
  StaffMember,
} from './src/types.ts';
import {
  cloneDefaultDemoOrders,
  ORDER_STATUS_LIST,
} from './src/data/defaultOrders.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Synchronize secrets from AI Studio control-plane files (/app/.dev.env.json) and local env files
function syncSecretsFromDisk(): void {
  const secretFileCandidates = [
    '/app/.dev.env.json',
    path.resolve(__dirname, '../.dev.env.json'),
    path.resolve(__dirname, '.dev.env.json'),
    path.resolve(process.cwd(), '.dev.env.json'),
    path.resolve(__dirname, '.env.local'),
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(__dirname, '.env'),
    path.resolve(process.cwd(), '.env'),
  ];

  for (const filePath of secretFileCandidates) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, 'utf-8');
      if (filePath.endsWith('.json')) {
        const json = JSON.parse(content);
        if (json && typeof json === 'object') {
          for (const [k, v] of Object.entries(json)) {
            if (typeof v === 'string' && v.trim()) {
              process.env[k] = v.trim();
              const upper = k.toUpperCase();
              if (!process.env[upper]) {
                process.env[upper] = v.trim();
              }
            }
          }
        }
      } else {
        const parsed = dotenv.parse(content);
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string' && v.trim()) {
            process.env[k] = v.trim();
            const upper = k.toUpperCase();
            if (!process.env[upper]) {
              process.env[upper] = v.trim();
            }
          }
        }
      }
    } catch {
      // Ignore transient read errors
    }
  }
}

// Initial boot sync
dotenv.config();
syncSecretsFromDisk();

const PORT = Number(process.env.PORT) || 3000;
const GEMMA_MODEL_ID = process.env.GEMINI_MODEL || 'gemma-4-26b-a4b-it';
const MAX_GEMMA_ATTEMPTS = 3; // 1 initial attempt + up to 2 transient retries
const PER_ATTEMPT_TIMEOUT_MS = 50000;
const TRANSIENT_HTTP_STATUSES = new Set([408, 500, 502, 503, 504]);

interface ClientMenuSnapshotItem {
  id: string;
  name: string;
  price: number;
  category: string;
  prepMinutes: number;
  stock: number;
  isAvailable: boolean;
  dietaryNote?: string;
}

interface ChatHistoryTurn {
  role: 'user' | 'model';
  text: string;
}

interface AssistantChatRequestBody {
  message?: string;
  history?: ChatHistoryTurn[];
  menuItems?: ClientMenuSnapshotItem[];
}

interface ParsedGemmaJson {
  reply?: string;
  recommendedItems?: RawModelRecommendedItem[];
  items?: RawModelRecommendedItem[];
  prepNote?: string;
}

interface SanitizedAttemptDiagnostic {
  requestId: string;
  timestamp: string;
  model: string;
  attemptsUsed: number;
  ok: boolean;
  upstreamStatus?: number;
  latencyMs: number;
  errorCode?: string;
  sanitizedError?: string;
}

const recentDiagnostics: SanitizedAttemptDiagnostic[] = [];

function recordDiagnostic(entry: SanitizedAttemptDiagnostic) {
  recentDiagnostics.unshift(entry);
  if (recentDiagnostics.length > 10) {
    recentDiagnostics.pop();
  }
}

// ============================================================================
// Server-Side Authentication, Customer Registry, Staff & Audit Log Stores
// ============================================================================
const OTP_SECRET_SALT = process.env.OTP_SALT || 'canteeniq_campus_auth_salt_2026';
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const OTP_COOLDOWN_MS = 60 * 1000; // 60 seconds
const OTP_MAX_ATTEMPTS = 5;

interface ServerOtpEntry {
  email: string;
  hashedCode: string;
  codePlainDevOnly: string;
  expiresAt: number;
  attempts: number;
  mode: 'signup' | 'login';
  name?: string;
  phone?: string;
  lastSentAt: number;
}

const activeOtps = new Map<string, ServerOtpEntry>();

function hashOtpCode(code: string): string {
  return crypto.createHash('sha256').update(code + OTP_SECRET_SALT).digest('hex');
}

function generateCustomerId(): string {
  return `CUST-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

const serverCustomers = new Map<string, CustomerAccount>();

let serverStaffList: StaffMember[] = [
  {
    staffId: 'STF-101',
    staffUid: 'usr-stf-101',
    name: 'Rajesh Verma',
    email: 'rajesh.verma@canteeniq.campus',
    passcode: 'canteen2026',
    role: 'Canteen Operations Supervisor',
    permissions: [
      'staff:view_dashboard',
      'orders:update_status',
      'inventory:manage',
      'tables:manage',
      'system:reset_demo',
    ],
    status: 'active',
    createdAt: '2026-01-10T08:00:00.000Z',
    createdBy: 'saraswataryan2312@gmail.com',
  },
  {
    staffId: 'STF-102',
    staffUid: 'usr-stf-102',
    name: 'Meera Krishnan',
    email: 'meera.k@canteeniq.campus',
    passcode: 'kitchen2026',
    role: 'Kitchen Counter Lead',
    permissions: [
      'staff:view_dashboard',
      'orders:update_status',
      'inventory:manage',
      'tables:manage',
    ],
    status: 'active',
    createdAt: '2026-01-15T09:30:00.000Z',
    createdBy: 'saraswataryan2312@gmail.com',
  },
];

let serverAuditLogs: AuditLog[] = [
  {
    id: 'aud-init-001',
    adminEmail: 'saraswataryan2312@gmail.com',
    action: 'CREATE_STAFF',
    targetStaffId: 'STF-101',
    targetStaffName: 'Rajesh Verma',
    details: 'Initial supervisor account provisioned with full operational access',
    timestamp: '2026-01-10T08:00:00.000Z',
  },
  {
    id: 'aud-init-002',
    adminEmail: 'saraswataryan2312@gmail.com',
    action: 'CREATE_STAFF',
    targetStaffId: 'STF-102',
    targetStaffName: 'Meera Krishnan',
    details: 'Initial kitchen counter lead account provisioned with order and inventory permissions',
    timestamp: '2026-01-15T09:30:00.000Z',
  },
];

function getMailTransporter(): ReturnType<typeof nodemailer.createTransport> | null {
  syncSecretsFromDisk();
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const port = Number(process.env.SMTP_PORT) || 587;

  if (!host || !user || !pass) {
    return null;
  }

  try {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  } catch (err) {
    console.warn('[CanteenIQ Mailer] Failed to initialize mail transporter:', err);
    return null;
  }
}

// ============================================================================
// Shared In-Memory Demo Order Store (Authoritative for active server process)
// ============================================================================
const VALID_ORDER_STATUSES = new Set<string>(ORDER_STATUS_LIST);


let serverOrders: Order[] = cloneDefaultDemoOrders();

function isValidOrderStatus(val: unknown): val is OrderStatus {
  return typeof val === 'string' && VALID_ORDER_STATUSES.has(val);
}

function sanitizeOrderPayload(raw: unknown): Order | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const id = typeof obj.id === 'string' ? obj.id.trim() : '';
  const token = typeof obj.token === 'string' ? obj.token.trim() : '';
  const studentName =
    typeof obj.studentName === 'string' ? obj.studentName.trim() : '';
  const rollNumber =
    typeof obj.rollNumber === 'string' ? obj.rollNumber.trim() : '';
  const createdAt =
    typeof obj.createdAt === 'string' ? obj.createdAt.trim() : '';
  const totalAmount = Number(obj.totalAmount);
  const estimatedMinutes = Number(obj.estimatedMinutes);

  if (
    !id ||
    !token ||
    !studentName ||
    !rollNumber ||
    !isValidOrderStatus(obj.status) ||
    !Array.isArray(obj.items) ||
    !Number.isFinite(totalAmount) ||
    totalAmount < 0
  ) {
    return null;
  }

  const sanitizedItems: OrderLineItem[] = [];
  for (const li of obj.items) {
    if (!li || typeof li !== 'object') continue;
    const line = li as Record<string, unknown>;
    const menuItemId =
      typeof line.menuItemId === 'string' ? line.menuItemId.trim() : '';
    const name = typeof line.name === 'string' ? line.name.trim() : '';
    const unitPrice = Number(line.unitPrice);
    const quantity = Number(line.quantity);
    if (
      !menuItemId ||
      !name ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0 ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      continue;
    }
    sanitizedItems.push({ menuItemId, name, unitPrice, quantity });
  }

  if (sanitizedItems.length === 0) return null;

  return {
    id,
    token,
    studentName,
    rollNumber,
    items: sanitizedItems,
    totalAmount,
    status: obj.status,
    createdAt: createdAt || 'Just now',
    estimatedMinutes:
      Number.isFinite(estimatedMinutes) && estimatedMinutes >= 0
        ? estimatedMinutes
        : 5,
    tableId:
      typeof obj.tableId === 'string' && obj.tableId.trim()
        ? obj.tableId.trim()
        : undefined,
    notes:
      typeof obj.notes === 'string' && obj.notes.trim()
        ? obj.notes.trim()
        : undefined,
    isUserOrder: Boolean(obj.isUserOrder),
    userId: typeof obj.userId === 'string' && obj.userId.trim() ? obj.userId.trim() : undefined,
    customerId: typeof obj.customerId === 'string' && obj.customerId.trim() ? obj.customerId.trim() : undefined,
    customerEmail: typeof obj.customerEmail === 'string' && obj.customerEmail.trim() ? obj.customerEmail.trim() : undefined,
    customerPhone: typeof obj.customerPhone === 'string' && obj.customerPhone.trim() ? obj.customerPhone.trim() : undefined,
    deliveryAddress: typeof obj.deliveryAddress === 'string' && obj.deliveryAddress.trim() ? obj.deliveryAddress.trim() : undefined,
    deliveryNotes: typeof obj.deliveryNotes === 'string' && obj.deliveryNotes.trim() ? obj.deliveryNotes.trim() : undefined,
    isGroupOrder: Boolean(obj.isGroupOrder),
    groupCode:
      typeof obj.groupCode === 'string' && obj.groupCode.trim()
        ? obj.groupCode.trim()
        : undefined,
    groupParticipants: Array.isArray(obj.groupParticipants)
      ? (obj.groupParticipants as GroupParticipantOrderSummary[])
      : undefined,
  };
}

const DEFAULT_SERVER_MENU: ClientMenuSnapshotItem[] = [
  {
    id: 'item-samosa',
    name: 'Samosa',
    price: 20,
    category: 'Snacks',
    prepMinutes: 3,
    stock: 42,
    isAvailable: true,
  },
  {
    id: 'item-veg-sandwich',
    name: 'Veg Sandwich',
    price: 40,
    category: 'Sandwiches',
    prepMinutes: 5,
    stock: 28,
    isAvailable: true,
  },
  {
    id: 'item-masala-dosa',
    name: 'Masala Dosa',
    price: 50,
    category: 'South Indian',
    prepMinutes: 7,
    stock: 24,
    isAvailable: true,
  },
  {
    id: 'item-cold-coffee',
    name: 'Cold Coffee',
    price: 30,
    category: 'Beverages',
    prepMinutes: 4,
    stock: 35,
    isAvailable: true,
  },
];

function getConfiguredApiKey(): string | null {
  // Re-sync secrets from disk on demand so keys added in AI Studio Settings > Secrets are recognized immediately
  syncSecretsFromDisk();

  const raw =
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GENAI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.VITE_API_KEY;

  if (!raw) return null;
  let trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  if (
    !trimmed ||
    trimmed === 'MY_GEMINI_API_KEY' ||
    trimmed === 'YOUR_GEMINI_API_KEY' ||
    trimmed === 'PLACEHOLDER' ||
    trimmed === 'your_api_key_here'
  ) {
    return null;
  }
  return trimmed;
}

function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
      timeout: PER_ATTEMPT_TIMEOUT_MS,
      // Disable hidden SDK internal retries so our explicit, logged 3-attempt loop controls retries cleanly
      retryOptions: {
        attempts: 1,
      },
    },
  });
}

function scrubSecrets(message: string, apiKey: string | null): string {
  if (!message) return 'Unknown Gemini API error.';
  let cleaned = message;
  if (apiKey && apiKey.length > 4) {
    cleaned = cleaned.split(apiKey).join('[REDACTED]');
  }
  cleaned = cleaned.replace(/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED_KEY]');
  cleaned = cleaned.replace(/key=[0-9A-Za-z_-]{16,}/gi, 'key=[REDACTED]');
  return cleaned;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeMenuSnapshot(
  rawMenu: ClientMenuSnapshotItem[] | undefined
): ClientMenuSnapshotItem[] {
  if (!Array.isArray(rawMenu) || rawMenu.length === 0) {
    return DEFAULT_SERVER_MENU;
  }

  const sanitized: ClientMenuSnapshotItem[] = [];
  for (const item of rawMenu.slice(0, 20)) {
    if (!item || typeof item !== 'object') continue;
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    const price = Number(item.price);
    const prepMinutes = Number(item.prepMinutes);
    const stock = Number(item.stock);
    if (!id || !name || !Number.isFinite(price) || price <= 0) continue;

    sanitized.push({
      id,
      name,
      price,
      category: typeof item.category === 'string' ? item.category : 'Menu',
      prepMinutes:
        Number.isFinite(prepMinutes) && prepMinutes > 0 ? prepMinutes : 0,
      stock: Number.isFinite(stock) && stock >= 0 ? Math.floor(stock) : 0,
      isAvailable: Boolean(item.isAvailable) && stock > 0,
    });
  }

  return sanitized.length > 0 ? sanitized : DEFAULT_SERVER_MENU;
}

/**
 * Compact prompt builder (~110 tokens) tailored for gemma-4-26b-a4b-it.
 * Note: gemma-4-26b-a4b-it rejects `systemInstruction` and `responseSchema` with HTTP 500 INTERNAL,
 * and uses built-in reasoning (`thinking: true`), so keeping menu context concise minimizes latency
 * and reduces transient upstream 500 errors.
 */
function buildCompactGemmaPrompt(
  menu: ClientMenuSnapshotItem[],
  historyTurns: ChatHistoryTurn[],
  studentMessage: string
): string {
  const compactMenu = menu
    .map((m) => {
      const stockTag =
        m.isAvailable && m.stock > 0 ? `stock:${m.stock}` : 'OUT_OF_STOCK';
      const prepTag = m.prepMinutes > 0 ? `~${m.prepMinutes}m` : 'prep:est';
      return `${m.id}="${m.name}" ₹${m.price} (${prepTag}, ${stockTag})`;
    })
    .join('; ');

  const recentHistory =
    historyTurns.length > 0
      ? '\nContext:\n' +
        historyTurns
          .slice(-2)
          .map(
            (t) =>
              `${t.role === 'user' ? 'Student' : 'Assistant'}: ${t.text
                .replace(/\s+/g, ' ')
                .slice(0, 160)}`
          )
          .join('\n')
      : '';

  return [
    'You are the CanteenIQ campus food assistant. Reply in the student\'s language (English, Hindi, or Hinglish).',
    `Menu: ${compactMenu}`,
    'Rules: Recommend ONLY in-stock menu items using exact ₹ prices. Total cost must not exceed the student\'s budget, and prep time should fit their break. Never claim to place orders directly; tell them to add items to cart.',
    'Output ONLY valid JSON: {"reply":"concise 1-3 sentence answer","recommendedItems":[{"menuItemId":"item-id","quantity":1}],"prepNote":"short prep time note"}',
    recentHistory,
    `Student: ${studentMessage}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function extractJsonObject(rawText: string): ParsedGemmaJson | null {
  const trimmed = rawText.trim();
  const withoutFences = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(withoutFences) as ParsedGemmaJson;
  } catch {
    const firstBrace = withoutFences.indexOf('{');
    const lastBrace = withoutFences.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const candidate = withoutFences.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidate) as ParsedGemmaJson;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function extractUpstreamStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const statusProp = (err as { status?: unknown }).status;
  if (typeof statusProp === 'number' && statusProp >= 100 && statusProp < 600) {
    return statusProp;
  }
  const codeProp = (err as { code?: unknown }).code;
  if (typeof codeProp === 'number' && codeProp >= 100 && codeProp < 600) {
    return codeProp;
  }
  const msg = err instanceof Error ? err.message : String(err);
  const match = msg.match(/"code"\s*:\s*(4\d\d|5\d\d)/);
  if (match) {
    return Number(match[1]);
  }
  return undefined;
}

function isTransientGemmaError(
  err: unknown,
  upstreamStatus: number | undefined
): boolean {
  if (upstreamStatus !== undefined) {
    return TRANSIENT_HTTP_STATUSES.has(upstreamStatus);
  }
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('abort') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('econnreset') ||
    msg.includes('fetch failed') ||
    msg.includes('internal error') ||
    msg.includes('unavailable')
  );
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '128kb' }));

  const TRUSTED_ADMIN_EMAILS = new Set([
    'saraswataryan87@gmail.com',
    'saraswataryan2312@gmail.com',
  ]);

  function getCallerRoleAndAuth(req: Request) {
    const staffId = (req.headers['x-staff-id'] as string || '').trim().toUpperCase();
    const adminEmail = (req.headers['x-admin-email'] as string || '').trim().toLowerCase();
    const customerUid = (req.headers['x-customer-uid'] as string || '').trim();
    const customerId = (req.headers['x-customer-id'] as string || '').trim().toUpperCase();
    const customerEmail = (req.headers['x-customer-email'] as string || '').trim().toLowerCase();

    const isAdmin = Boolean(adminEmail && TRUSTED_ADMIN_EMAILS.has(adminEmail));
    const staffMember = serverStaffList.find(
      (s) => s.staffId.toUpperCase() === staffId && s.status === 'active'
    );
    const isStaff = Boolean(staffMember);

    return {
      isAdmin,
      isStaff,
      staffMember,
      customerId: customerId || undefined,
      customerUid: customerUid || undefined,
      customerEmail: customerEmail || undefined,
    };
  }

  // ==========================================================================
  // Secure Orders API (RBAC & Customer Privacy Enforced)
  // ==========================================================================
  app.get('/api/orders', (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const auth = getCallerRoleAndAuth(req);

    // 1. Authorized Admin or Staff with order dashboard access: return full operational queue
    if (auth.isAdmin || (auth.isStaff && auth.staffMember?.permissions.includes('staff:view_dashboard'))) {
      res.json({
        ok: true,
        orders: serverOrders,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    // 2. Authenticated Customer: return ONLY their own orders (Customer Privacy Protection)
    if (auth.customerUid || auth.customerId || auth.customerEmail) {
      const privateOrders = serverOrders.filter((o) => {
        if (auth.customerUid && o.userId === auth.customerUid) return true;
        if (auth.customerId && (o as any).customerId === auth.customerId) return true;
        if (auth.customerEmail && o.customerEmail && o.customerEmail.toLowerCase().trim() === auth.customerEmail) return true;
        return false;
      });

      res.json({
        ok: true,
        orders: privateOrders,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    // 3. Unauthenticated guest / unknown requester: strictly empty list (never expose other customers' details)
    res.json({
      ok: true,
      orders: [],
      updatedAt: new Date().toISOString(),
    });
  });

  app.post('/api/orders', (req: Request, res: Response) => {
    const incoming = sanitizeOrderPayload(
      (req.body as { order?: unknown } | undefined)?.order ?? req.body
    );
    if (!incoming) {
      res.status(400).json({
        ok: false,
        error: 'Invalid order payload.',
      });
      return;
    }

    const existingIdx = serverOrders.findIndex(
      (o) =>
        o.id === incoming.id ||
        o.token.toLowerCase() === incoming.token.toLowerCase()
    );

    if (existingIdx >= 0) {
      serverOrders = serverOrders.map((o, idx) =>
        idx === existingIdx ? incoming : o
      );
    } else {
      serverOrders = [incoming, ...serverOrders];
    }

    res.json({
      ok: true,
      order: incoming,
      orders: serverOrders,
      updatedAt: new Date().toISOString(),
    });
  });

  app.post('/api/orders/sync', (req: Request, res: Response) => {
    const auth = getCallerRoleAndAuth(req);
    const rawList = (req.body as { orders?: unknown } | undefined)?.orders;
    if (Array.isArray(rawList)) {
      const missingClientOrders: Order[] = [];
      for (const rawItem of rawList.slice(0, 100)) {
        const sanitized = sanitizeOrderPayload(rawItem);
        if (!sanitized) continue;
        const existsOnServer = serverOrders.some(
          (o) =>
            o.id === sanitized.id ||
            o.token.toLowerCase() === sanitized.token.toLowerCase()
        );
        if (!existsOnServer) {
          missingClientOrders.push(sanitized);
        }
      }
      if (missingClientOrders.length > 0) {
        serverOrders = [...missingClientOrders, ...serverOrders];
      }
    }

    res.setHeader('Cache-Control', 'no-store');
    if (auth.isAdmin || (auth.isStaff && auth.staffMember?.permissions.includes('staff:view_dashboard'))) {
      res.json({
        ok: true,
        orders: serverOrders,
        updatedAt: new Date().toISOString(),
      });
    } else if (auth.customerUid || auth.customerId || auth.customerEmail) {
      const privateOrders = serverOrders.filter((o) => {
        if (auth.customerUid && o.userId === auth.customerUid) return true;
        if (auth.customerId && (o as any).customerId === auth.customerId) return true;
        if (auth.customerEmail && o.customerEmail && o.customerEmail.toLowerCase().trim() === auth.customerEmail) return true;
        return false;
      });
      res.json({
        ok: true,
        orders: privateOrders,
        updatedAt: new Date().toISOString(),
      });
    } else {
      res.json({
        ok: true,
        orders: [],
        updatedAt: new Date().toISOString(),
      });
    }
  });

  app.patch('/api/orders/:orderId/status', (req: Request, res: Response) => {
    const auth = getCallerRoleAndAuth(req);
    const canUpdate = auth.isAdmin || (auth.isStaff && auth.staffMember?.permissions.includes('orders:update_status'));
    if (!canUpdate) {
      res.status(403).json({
        ok: false,
        error: 'Unauthorized: Only authorized kitchen staff or administrators can update order statuses.',
      });
      return;
    }

    const targetKey = decodeURIComponent(String(req.params.orderId || '')).trim();
    const nextStatus = (req.body as { status?: unknown } | undefined)?.status;

    if (!isValidOrderStatus(nextStatus)) {
      res.status(400).json({
        ok: false,
        error:
          'Invalid status. Allowed values: Received, Preparing, Ready, Collected, Delivered.',
      });
      return;
    }

    const idx = serverOrders.findIndex(
      (o) =>
        o.id === targetKey ||
        o.token.toLowerCase() === targetKey.toLowerCase()
    );

    if (idx === -1) {
      res.status(404).json({
        ok: false,
        error: `Order "${targetKey}" not found in server queue.`,
      });
      return;
    }

    const updatedOrder: Order = {
      ...serverOrders[idx],
      status: nextStatus,
    };
    serverOrders = serverOrders.map((o, i) => (i === idx ? updatedOrder : o));

    res.json({
      ok: true,
      order: updatedOrder,
      orders: serverOrders,
      updatedAt: new Date().toISOString(),
    });
  });

  app.post('/api/orders/reset', (req: Request, res: Response) => {
    const auth = getCallerRoleAndAuth(req);
    if (!auth.isAdmin && (!auth.isStaff || !auth.staffMember?.permissions.includes('system:reset_demo'))) {
      res.status(403).json({
        ok: false,
        error: 'Unauthorized: Only administrators or authorized supervisors can reset order data.',
      });
      return;
    }

    serverOrders = cloneDefaultDemoOrders();
    res.json({
      ok: true,
      orders: serverOrders,
      updatedAt: new Date().toISOString(),
    });
  });

  // ==========================================================================
  // Customer Authentication & Server-Side 6-Digit Email OTP Endpoints
  // ==========================================================================
  app.post('/api/auth/send-otp', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as {
      email?: string;
      mode?: 'signup' | 'login';
      name?: string;
      phone?: string;
    };
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const mode = body.mode === 'login' ? 'login' : 'signup';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';

    if (!email || !email.includes('@') || !email.includes('.')) {
      res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
      return;
    }

    if (mode === 'signup') {
      if (!name) {
        res.status(400).json({ ok: false, error: 'Full name is required for customer registration.' });
        return;
      }
      if (!phone || phone.length < 7) {
        res.status(400).json({ ok: false, error: 'Valid phone number is required for customer registration.' });
        return;
      }

      // Check duplicate customer account for the same email
      if (serverCustomers.has(email)) {
        res.status(400).json({
          ok: false,
          errorCode: 'EMAIL_ALREADY_EXISTS',
          error: `An account already exists for ${email}. Please use Log In or sign in with Google.`,
        });
        return;
      }
    }

    // Cooldown check (60s)
    const existing = activeOtps.get(email);
    const now = Date.now();
    if (existing && now - existing.lastSentAt < OTP_COOLDOWN_MS) {
      const remainingSec = Math.ceil((OTP_COOLDOWN_MS - (now - existing.lastSentAt)) / 1000);
      res.status(429).json({
        ok: false,
        errorCode: 'RATE_LIMITED',
        error: `Please wait ${remainingSec} seconds before requesting another verification code.`,
        cooldownSeconds: remainingSec,
      });
      return;
    }

    // Generate genuine 6-digit cryptographic OTP
    const code = crypto.randomInt(100000, 1000000).toString();
    const hashedCode = hashOtpCode(code);

    activeOtps.set(email, {
      email,
      hashedCode,
      codePlainDevOnly: code,
      expiresAt: now + OTP_EXPIRY_MS,
      attempts: 0,
      mode,
      name,
      phone,
      lastSentAt: now,
    });

    const transporter = getMailTransporter();
    let emailSent = false;

    if (transporter) {
      try {
        const fromAddr = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@canteeniq.campus';
        await transporter.sendMail({
          from: `"CanteenIQ Campus" <${fromAddr}>`,
          to: email,
          subject: `Your CanteenIQ Verification Code: ${code}`,
          text: `Hello,\n\nYour 6-digit verification code for CanteenIQ is: ${code}\n\nThis code expires in 5 minutes.\nDo not share this code with anyone.`,
          html: `<div style="font-family: sans-serif; padding: 24px; color: #0f172a; max-width: 500px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #065f46; margin-top: 0;">CanteenIQ Campus Dining</h2>
            <p style="font-size: 15px;">Your six-digit email verification code is:</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; padding: 14px 20px; background: #ecfdf5; color: #065f46; border-radius: 8px; text-align: center; margin: 16px 0;">
              ${code}
            </div>
            <p style="color: #64748b; font-size: 13px; line-height: 1.5;">This code will expire in 5 minutes. If you did not initiate this request, please safely ignore this message.</p>
          </div>`,
        });
        emailSent = true;
        console.info(`[CanteenIQ Auth OTP] Real outbound verification email dispatched to ${email}.`);
      } catch (err) {
        console.error(`[CanteenIQ Auth OTP] Outbound SMTP dispatch failed:`, err);
      }
    } else {
      console.info(
        `[CanteenIQ Auth OTP] Code for ${email} is: ${code} (Expires in 5m). Notice: Outbound SMTP credentials are not configured in Settings > Secrets. To send live emails, set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.`
      );
    }

    res.json({
      ok: true,
      email,
      mode,
      emailSent,
      smtpConfigured: Boolean(transporter),
      cooldownSeconds: 60,
      message: emailSent
        ? `A 6-digit verification code was sent to ${email}.`
        : `A 6-digit verification code has been dispatched. (Outbound SMTP is not configured on this server, so the code was logged to the server console).`,
    });
  });

  app.post('/api/auth/verify-otp', (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { email?: string; code?: string };
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const code = typeof body.code === 'string' ? body.code.trim() : '';

    if (!email || !code) {
      res.status(400).json({ ok: false, error: 'Email and 6-digit verification code are required.' });
      return;
    }

    const record = activeOtps.get(email);
    if (!record) {
      res.status(400).json({
        ok: false,
        error: 'No active verification code found for this email. Please request a new code.',
      });
      return;
    }

    const now = Date.now();
    if (now > record.expiresAt) {
      activeOtps.delete(email);
      res.status(400).json({
        ok: false,
        errorCode: 'EXPIRED',
        error: 'Verification code has expired. Please request a fresh code.',
      });
      return;
    }

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      activeOtps.delete(email);
      res.status(429).json({
        ok: false,
        errorCode: 'MAX_ATTEMPTS_EXCEEDED',
        error: 'Too many incorrect attempts. For security, this code has been cancelled. Please request a new code.',
      });
      return;
    }

    record.attempts += 1;
    const candidateHash = hashOtpCode(code);
    if (candidateHash !== record.hashedCode) {
      const remaining = OTP_MAX_ATTEMPTS - record.attempts;
      res.status(400).json({
        ok: false,
        errorCode: 'INVALID_CODE',
        error: `Incorrect verification code. ${remaining} attempt(s) remaining.`,
      });
      return;
    }

    // Single-use guarantee: remove verified OTP
    activeOtps.delete(email);

    // Retrieve or register customer record
    let customer = serverCustomers.get(email);
    if (!customer) {
      const customerId = generateCustomerId();
      const uid = `cust-${crypto.randomBytes(8).toString('hex')}`;
      customer = {
        customerId,
        uid,
        name: record.name || email.split('@')[0],
        email,
        phone: record.phone || '',
        emailVerified: true,
        createdAt: new Date().toISOString(),
        status: 'active',
        provider: 'email_otp',
      };
      serverCustomers.set(email, customer);
    } else {
      customer.emailVerified = true;
      if (record.name && !customer.name) customer.name = record.name;
      if (record.phone && !customer.phone) customer.phone = record.phone;
    }

    res.json({
      ok: true,
      verified: true,
      customer,
      customerId: customer.customerId,
    });
  });

  app.get('/api/auth/customer', (req: Request, res: Response) => {
    const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
    const uid = typeof req.query.uid === 'string' ? req.query.uid.trim() : '';

    if (!email && !uid) {
      res.status(400).json({ ok: false, error: 'Email or UID is required.' });
      return;
    }

    let customer: CustomerAccount | undefined;
    if (email) {
      customer = serverCustomers.get(email);
    } else if (uid) {
      for (const c of serverCustomers.values()) {
        if (c.uid === uid) {
          customer = c;
          break;
        }
      }
    }

    if (!customer) {
      res.status(404).json({ ok: false, error: 'Customer record not found.' });
      return;
    }

    res.json({ ok: true, customer });
  });

  app.post('/api/auth/customer', (req: Request, res: Response) => {
    const body = (req.body ?? {}) as {
      email?: string;
      uid?: string;
      name?: string;
      phone?: string;
      provider?: 'google.com' | 'email_otp';
    };

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const uid = typeof body.uid === 'string' ? body.uid.trim() : '';

    if (!email || !uid) {
      res.status(400).json({ ok: false, error: 'Email and UID are required.' });
      return;
    }

    let customer = serverCustomers.get(email);
    if (!customer) {
      customer = {
        customerId: generateCustomerId(),
        uid,
        name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : email.split('@')[0],
        email,
        phone: typeof body.phone === 'string' ? body.phone.trim() : '',
        emailVerified: true,
        createdAt: new Date().toISOString(),
        status: 'active',
        provider: body.provider || 'google.com',
      };
      serverCustomers.set(email, customer);
    } else {
      customer.uid = uid;
      if (body.name && body.name.trim()) customer.name = body.name.trim();
      if (body.phone && body.phone.trim()) customer.phone = body.phone.trim();
      if (body.provider) customer.provider = body.provider;
    }

    res.json({ ok: true, customer, customerId: customer.customerId });
  });

  // ==========================================================================
  // Staff Role Management, Activation & Authentication Endpoints
  // ==========================================================================
  app.get('/api/staff', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: true,
      staff: serverStaffList,
      count: serverStaffList.length,
    });
  });

  app.post('/api/staff', (req: Request, res: Response) => {
    const body = (req.body ?? {}) as {
      name?: string;
      email?: string;
      passcode?: string;
      role?: string;
      permissions?: string[];
      adminEmail?: string;
    };

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const passcode = typeof body.passcode === 'string' ? body.passcode.trim() : 'staff2026';
    const role = typeof body.role === 'string' ? body.role.trim() : 'Canteen Crew';
    const permissions = Array.isArray(body.permissions) && body.permissions.length > 0
      ? body.permissions.map(String)
      : ['staff:view_dashboard', 'orders:update_status'];
    const adminEmail = typeof body.adminEmail === 'string' ? body.adminEmail.trim() : 'saraswataryan2312@gmail.com';

    if (!name || !email) {
      res.status(400).json({ ok: false, error: 'Staff name and email are required.' });
      return;
    }

    const existingStaff = serverStaffList.find((s) => s.email.toLowerCase() === email.toLowerCase());
    if (existingStaff) {
      res.status(400).json({ ok: false, error: `A staff member with email ${email} already exists.` });
      return;
    }

    const staffNum = 100 + serverStaffList.length + 1;
    const staffId = `STF-${staffNum}`;
    const staffUid = `usr-stf-${crypto.randomBytes(4).toString('hex')}`;

    const newStaff: StaffMember = {
      staffId,
      staffUid,
      name,
      email,
      passcode,
      role,
      permissions,
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: adminEmail,
    };

    serverStaffList = [...serverStaffList, newStaff];

    // Record audit log
    const auditEntry: AuditLog = {
      id: `aud-${crypto.randomBytes(6).toString('hex')}`,
      adminEmail,
      action: 'CREATE_STAFF',
      targetStaffId: staffId,
      targetStaffName: name,
      details: `Provisioned new staff account ${staffId} (${role})`,
      timestamp: new Date().toISOString(),
    };
    serverAuditLogs = [auditEntry, ...serverAuditLogs];

    res.json({ ok: true, staff: newStaff, auditEntry });
  });

  app.patch('/api/staff/:staffId/status', (req: Request, res: Response) => {
    const targetStaffId = decodeURIComponent(String(req.params.staffId || '')).trim().toUpperCase();
    const body = (req.body ?? {}) as { status?: 'active' | 'inactive'; adminEmail?: string };
    const nextStatus = body.status === 'inactive' ? 'inactive' : 'active';
    const adminEmail = typeof body.adminEmail === 'string' ? body.adminEmail.trim() : 'saraswataryan2312@gmail.com';

    const idx = serverStaffList.findIndex((s) => s.staffId.toUpperCase() === targetStaffId);
    if (idx === -1) {
      res.status(404).json({ ok: false, error: `Staff member ${targetStaffId} not found.` });
      return;
    }

    const prevStaff = serverStaffList[idx];
    const updatedStaff: StaffMember = { ...prevStaff, status: nextStatus };
    serverStaffList = serverStaffList.map((s, i) => (i === idx ? updatedStaff : s));

    const action = nextStatus === 'active' ? 'ACTIVATE_STAFF' : 'DEACTIVATE_STAFF';
    const auditEntry: AuditLog = {
      id: `aud-${crypto.randomBytes(6).toString('hex')}`,
      adminEmail,
      action,
      targetStaffId: updatedStaff.staffId,
      targetStaffName: updatedStaff.name,
      details: `Staff status changed to ${nextStatus}`,
      timestamp: new Date().toISOString(),
    };
    serverAuditLogs = [auditEntry, ...serverAuditLogs];

    res.json({ ok: true, staff: updatedStaff, auditEntry });
  });

  app.patch('/api/staff/:staffId', (req: Request, res: Response) => {
    const targetStaffId = decodeURIComponent(String(req.params.staffId || '')).trim().toUpperCase();
    const body = (req.body ?? {}) as {
      name?: string;
      role?: string;
      permissions?: string[];
      passcode?: string;
      adminEmail?: string;
    };
    const adminEmail = typeof body.adminEmail === 'string' ? body.adminEmail.trim() : 'saraswataryan2312@gmail.com';

    const idx = serverStaffList.findIndex((s) => s.staffId.toUpperCase() === targetStaffId);
    if (idx === -1) {
      res.status(404).json({ ok: false, error: `Staff member ${targetStaffId} not found.` });
      return;
    }

    const prev = serverStaffList[idx];
    const updatedStaff: StaffMember = {
      ...prev,
      name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : prev.name,
      role: typeof body.role === 'string' && body.role.trim() ? body.role.trim() : prev.role,
      permissions: Array.isArray(body.permissions) && body.permissions.length > 0 ? body.permissions.map(String) : prev.permissions,
      passcode: typeof body.passcode === 'string' && body.passcode.trim() ? body.passcode.trim() : prev.passcode,
    };
    serverStaffList = serverStaffList.map((s, i) => (i === idx ? updatedStaff : s));

    const auditEntry: AuditLog = {
      id: `aud-${crypto.randomBytes(6).toString('hex')}`,
      adminEmail,
      action: 'UPDATE_STAFF',
      targetStaffId: updatedStaff.staffId,
      targetStaffName: updatedStaff.name,
      details: `Updated role to ${updatedStaff.role} with ${updatedStaff.permissions.length} permissions`,
      timestamp: new Date().toISOString(),
    };
    serverAuditLogs = [auditEntry, ...serverAuditLogs];

    res.json({ ok: true, staff: updatedStaff, auditEntry });
  });

  app.post('/api/staff/login', (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { identifier?: string; passcode?: string };
    const identifier = typeof body.identifier === 'string' ? body.identifier.trim().toLowerCase() : '';
    const passcode = typeof body.passcode === 'string' ? body.passcode.trim() : '';

    if (!identifier || !passcode) {
      res.status(400).json({ ok: false, error: 'Staff ID or email and passcode are required.' });
      return;
    }

    const matched = serverStaffList.find(
      (s) =>
        s.staffId.toLowerCase() === identifier ||
        s.email.toLowerCase() === identifier
    );

    if (!matched) {
      res.status(401).json({ ok: false, error: 'Invalid Staff ID or email.' });
      return;
    }

    // IMMEDIATE DISABLEMENT CHECK
    if (matched.status !== 'active') {
      res.status(403).json({
        ok: false,
        errorCode: 'STAFF_DEACTIVATED',
        error: 'Your staff account has been deactivated by the administrator. Access is denied.',
      });
      return;
    }

    if (matched.passcode && matched.passcode !== passcode) {
      res.status(401).json({ ok: false, error: 'Incorrect staff passcode.' });
      return;
    }

    // Update last login
    matched.lastLoginAt = new Date().toISOString();

    res.json({
      ok: true,
      session: {
        userId: matched.staffUid,
        staffId: matched.staffId,
        displayName: matched.name,
        roleTitle: matched.role,
        role: 'staff',
        permissions: matched.permissions,
        issuedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    });
  });

  app.get('/api/audit-logs', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: true,
      logs: serverAuditLogs,
      count: serverAuditLogs.length,
    });
  });

  // Check server-side Gemma 4 readiness and sanitized diagnostics (never exposes GEMINI_API_KEY)
  app.get('/api/assistant/status', (_req: Request, res: Response) => {

    const apiKey = getConfiguredApiKey();
    res.json({
      configured: Boolean(apiKey),
      model: GEMMA_MODEL_ID,
      maxAttempts: MAX_GEMMA_ATTEMPTS,
      recentDiagnostics: recentDiagnostics.slice(0, 5),
    });
  });

  // Live server-side Gemma 4 chat endpoint with compact context & bounded transient retry
  app.post('/api/assistant/chat', async (req: Request, res: Response) => {
    const requestId = crypto.randomUUID().slice(0, 8);
    const startedAt = Date.now();
    const apiKey = getConfiguredApiKey();

    // Note: Avoid HTTP 502/503/504 responses on /api/* because container Nginx intercepts 502/503/504 with warmup.html
    if (!apiKey) {
      console.warn(
        `[CanteenIQ Gemma 4] req=${requestId} note=MISSING_API_KEY (GEMINI_API_KEY is unset or placeholder; handled gracefully)`
      );
      res.status(200).json({
        ok: false,
        requestId,
        model: GEMMA_MODEL_ID,
        errorCode: 'MISSING_API_KEY',
        error:
          'Server GEMINI_API_KEY is not configured yet. Add GEMINI_API_KEY in Settings > Secrets to enable live Gemma 4 responses.',
      });
      return;
    }

    const body = (req.body ?? {}) as AssistantChatRequestBody;
    const rawMessage =
      typeof body.message === 'string' ? body.message.trim() : '';

    if (!rawMessage) {
      res.status(400).json({
        ok: false,
        requestId,
        model: GEMMA_MODEL_ID,
        errorCode: 'EMPTY_MESSAGE',
        error: 'Please enter a food request before sending.',
      });
      return;
    }

    if (rawMessage.length > 350) {
      res.status(400).json({
        ok: false,
        requestId,
        model: GEMMA_MODEL_ID,
        errorCode: 'MESSAGE_TOO_LONG',
        error: 'Please keep your request concise (under 350 characters).',
      });
      return;
    }

    const menuSnapshot = sanitizeMenuSnapshot(body.menuItems);
    const historyTurns = Array.isArray(body.history)
      ? body.history
          .filter(
            (t) =>
              t &&
              (t.role === 'user' || t.role === 'model') &&
              typeof t.text === 'string' &&
              t.text.trim().length > 0
          )
          .slice(-2)
      : [];

    const compactPrompt = buildCompactGemmaPrompt(
      menuSnapshot,
      historyTurns,
      rawMessage
    );

    const ai = createGeminiClient(apiKey);

    let lastError: unknown = null;
    let lastUpstreamStatus: number | undefined;
    let attemptsUsed = 0;

    for (let attempt = 1; attempt <= MAX_GEMMA_ATTEMPTS; attempt++) {
      attemptsUsed = attempt;
      const attemptStart = Date.now();

      try {
        console.info(
          `[CanteenIQ Gemma 4] req=${requestId} attempt=${attempt}/${MAX_GEMMA_ATTEMPTS} model=${GEMMA_MODEL_ID} promptChars=${compactPrompt.length} menuItems=${menuSnapshot.length}`
        );

        const response = await ai.models.generateContent({
          model: GEMMA_MODEL_ID,
          contents: compactPrompt,
          config: {
            temperature: 0.2,
          },
        });

        const modelText = response.text ?? '';
        const modelVersion = response.modelVersion || GEMMA_MODEL_ID;
        const responseId = response.responseId;
        const totalLatencyMs = Date.now() - startedAt;

        if (!modelText.trim()) {
          throw new Error(
            'Gemini API returned HTTP 200 with empty text candidate from Gemma 4.'
          );
        }

        const parsed = extractJsonObject(modelText);
        const replyProse =
          parsed && typeof parsed.reply === 'string' && parsed.reply.trim()
            ? parsed.reply.trim()
            : modelText.trim();

        const candidateItems = parsed?.recommendedItems ?? parsed?.items;

        // Deterministic application-side validation of items, prices, stock, and totals
        const validation = validateModelRecommendations(
          candidateItems,
          menuSnapshot,
          parsed?.prepNote
        );

        console.info(
          `[CanteenIQ Gemma 4] req=${requestId} ok=true attempt=${attempt}/${MAX_GEMMA_ATTEMPTS} latencyMs=${totalLatencyMs} responseId=${
            responseId ?? 'n/a'
          } validatedItems=${validation.recommendation?.items.length ?? 0}`
        );

        recordDiagnostic({
          requestId,
          timestamp: new Date().toISOString(),
          model: modelVersion,
          attemptsUsed: attempt,
          ok: true,
          upstreamStatus: 200,
          latencyMs: totalLatencyMs,
        });

        res.json({
          ok: true,
          requestId,
          model: GEMMA_MODEL_ID,
          modelVersion,
          responseId,
          attemptsUsed: attempt,
          latencyMs: totalLatencyMs,
          reply: replyProse,
          recommendation: validation.recommendation,
          validationSummary: {
            validatedByApp: true,
            droppedInvalidItems: validation.droppedInvalidItems,
            adjustedQuantities: validation.adjustedQuantities,
          },
        });
        return;
      } catch (err: unknown) {
        lastError = err;
        lastUpstreamStatus = extractUpstreamStatus(err);
        const attemptMs = Date.now() - attemptStart;
        const safeErrText = scrubSecrets(
          err instanceof Error ? err.message : String(err),
          apiKey
        );
        const canRetry =
          attempt < MAX_GEMMA_ATTEMPTS &&
          isTransientGemmaError(err, lastUpstreamStatus);

        console.error(
          `[CanteenIQ Gemma 4 Error] req=${requestId} attempt=${attempt}/${MAX_GEMMA_ATTEMPTS} upstreamStatus=${
            lastUpstreamStatus ?? 'network/timeout'
          } attemptMs=${attemptMs} willRetry=${canRetry} detail=${safeErrText}`
        );

        if (!canRetry) {
          break;
        }

        const backoffMs =
          1200 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 350);
        await sleep(backoffMs);
      }
    }

    const totalFailedMs = Date.now() - startedAt;
    const rawFinalErr =
      lastError instanceof Error ? lastError.message : String(lastError);
    const safeDetails = scrubSecrets(rawFinalErr, apiKey);
    const upstreamCode = lastUpstreamStatus ?? 500;

    let friendlyError = `Gemma 4 (${GEMMA_MODEL_ID}) experienced a temporary upstream error on the Gemini API after ${attemptsUsed} ${
      attemptsUsed === 1 ? 'attempt' : 'attempts'
    }. Please wait a few seconds and click Retry.`;

    if (upstreamCode === 429 || safeDetails.toLowerCase().includes('quota')) {
      friendlyError =
        'The Gemini API rate limit or quota for Gemma 4 was temporarily reached. Please wait 15–30 seconds and click Retry.';
    } else if (
      upstreamCode === 401 ||
      upstreamCode === 403 ||
      safeDetails.toLowerCase().includes('api key not valid') ||
      safeDetails.toLowerCase().includes('permission_denied')
    ) {
      friendlyError =
        'The server GEMINI_API_KEY was rejected by the Gemini API. Please check your key in the Settings > Secrets panel.';
    } else if (upstreamCode === 404) {
      friendlyError = `Model "${GEMMA_MODEL_ID}" is not available for the configured API key or endpoint.`;
    } else if (upstreamCode === 400) {
      friendlyError =
        'The request could not be processed by Gemma 4 (HTTP 400 Invalid Argument). Try a shorter, simpler question.';
    }

    recordDiagnostic({
      requestId,
      timestamp: new Date().toISOString(),
      model: GEMMA_MODEL_ID,
      attemptsUsed,
      ok: false,
      upstreamStatus: upstreamCode,
      latencyMs: totalFailedMs,
      errorCode: `GEMINI_API_${upstreamCode}`,
      sanitizedError: safeDetails.slice(0, 240),
    });

    // Map 502/503/504 to 500 on Express response so container Nginx does not intercept JSON with warmup.html
    const safeExpressStatus =
      upstreamCode === 400 ||
      upstreamCode === 401 ||
      upstreamCode === 403 ||
      upstreamCode === 404 ||
      upstreamCode === 429
        ? upstreamCode
        : 500;

    res.status(safeExpressStatus).json({
      ok: false,
      requestId,
      model: GEMMA_MODEL_ID,
      attemptsUsed,
      errorCode: `GEMINI_API_${upstreamCode}`,
      error: friendlyError,
      technicalDetails: `[req=${requestId}, attempts=${attemptsUsed}, upstream=${upstreamCode}] ${safeDetails.slice(
        0,
        240
      )}`,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get(/^(?!\/api(?:\/|$)).*/, (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.info(
      `[CanteenIQ Server] Listening on http://0.0.0.0:${PORT} | model=${GEMMA_MODEL_ID} | apiKeyConfigured=${Boolean(
        getConfiguredApiKey()
      )} | maxAttempts=${MAX_GEMMA_ATTEMPTS}`
    );
  });
}

startServer();
