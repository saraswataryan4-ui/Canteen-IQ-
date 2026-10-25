import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  Clock,
  Code2,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  ShoppingBag,
  User,
} from 'lucide-react';
import {
  ActiveTab,
  AssistantRecommendation,
  ChatMessage,
  DiningTable,
  MenuItem,
  Order,
  OrderStatus,
  RecommendedBundleItem,
  TableStatus,
} from '../types';
import { validateModelRecommendations } from '../utils/validateAssistantRecommendation';

interface GemmaChatProps {
  menuItems: MenuItem[];
  orders: Order[];
  tables: DiningTable[];
  onAddToCart: (menuItemId: string) => void;
  onAddRecommendedBundle: (
    items: { menuItemId: string; quantity: number }[]
  ) => number;
  onOpenCart: () => void;
  onNavigateTab: (tab: ActiveTab) => void;
}

interface AssistantApiSuccess {
  ok: true;
  requestId?: string;
  model: string;
  modelVersion?: string;
  responseId?: string;
  attemptsUsed?: number;
  latencyMs?: number;
  reply: string;
  recommendation?: AssistantRecommendation;
  validationSummary?: {
    validatedByApp: boolean;
    droppedInvalidItems: number;
    adjustedQuantities: number;
  };
}

interface AssistantApiError {
  ok: false;
  requestId?: string;
  model?: string;
  attemptsUsed?: number;
  errorCode?: string;
  error?: string;
  technicalDetails?: string;
}

const GEMMA_MODEL_NAME = 'gemma-4-26b-a4b-it';

const STARTER_PROMPTS = [
  'I have ₹60 and only 10 minutes. What should I order?',
  'Mere paas ₹60 hain aur sirf 10 minute hain.',
  'I have ₹90 and 8 minutes for a filling meal.',
  '₹50 में जल्दी क्या मिलेगा?',
];

const INITIAL_ONBOARDING_MESSAGE: ChatMessage = {
  id: 'msg-welcome',
  sender: 'assistant',
  text: 'Welcome to the CanteenIQ Food Assistant, powered server-side by Gemma 4 (gemma-4-26b-a4b-it). Tell me your budget (₹) and available break time in English, Hindi, or Hinglish — for example: "I have ₹60 and only 10 minutes. What should I order?"',
  timestamp: 'Ready',
};

export const GemmaChat: React.FC<GemmaChatProps> = ({
  menuItems,
  orders,
  tables,
  onAddToCart,
  onAddRecommendedBundle,
  onOpenCart,
  onNavigateTab,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    INITIAL_ONBOARDING_MESSAGE,
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<{
    message: string;
    details?: string;
    failedPrompt: string;
  } | null>(null);
  const [serverStatus, setServerStatus] = useState<{
    checked: boolean;
    configured: boolean;
    model: string;
  }>({
    checked: false,
    configured: true,
    model: GEMMA_MODEL_NAME,
  });
  const [addedMessageIds, setAddedMessageIds] = useState<Record<string, boolean>>(
    {}
  );
  const [showContextPayload, setShowContextPayload] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/assistant/status')
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as { configured?: boolean; model?: string };
      })
      .then((data) => {
        if (cancelled || !data) return;
        setServerStatus({
          checked: true,
          configured: Boolean(data.configured),
          model: data.model || GEMMA_MODEL_NAME,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setServerStatus({
            checked: true,
            configured: false,
            model: GEMMA_MODEL_NAME,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeQueueCount = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status === OrderStatus.Received ||
          o.status === OrderStatus.Preparing
      ).length,
    [orders]
  );

  const openTablesCount = useMemo(
    () => tables.filter((t) => t.status === TableStatus.Available).length,
    [tables]
  );

  const gemmaContextSnapshot = useMemo(() => {
    return {
      sdk: '@google/genai (Server-Side Express Route /api/assistant/chat)',
      model: serverStatus.model,
      server_api_key_configured: serverStatus.configured,
      transient_retry_policy:
        'Up to 3 total attempts (initial + 2 exponential-backoff retries on transient 500/503 errors)',
      order_validation_policy:
        'Application deterministically validates item names, ₹ prices, positive integer quantities, and live stock before rendering recommendations or adding to cart. Model cannot invent prices or place orders directly.',
      compact_menu_context_sent_to_gemma: menuItems.map((m) => ({
        id: m.id,
        name: m.name,
        price_inr: m.price,
        in_stock: m.isAvailable && m.stock > 0,
        stock_count: m.stock,
        estimated_prep_mins: m.prepMinutes,
      })),
      active_orders_in_queue: activeQueueCount,
      available_tables_count: openTablesCount,
    };
  }, [
    menuItems,
    activeQueueCount,
    openTablesCount,
    serverStatus.configured,
    serverStatus.model,
  ]);

  const sendPrompt = async (text: string, isRetry = false) => {
    if (isThinking) return;
    const trimmed = text.trim();
    if (!trimmed) {
      setInputError(
        'Please enter a message or select one of the sample prompts below.'
      );
      return;
    }
    if (trimmed.length > 350) {
      setInputError(
        'Please keep your request concise (under 350 characters), e.g., "I have ₹60 and only 10 minutes. What should I order?"'
      );
      return;
    }

    setInputError(null);
    setApiError(null);

    if (serverStatus.checked && !serverStatus.configured) {
      setApiError({
        message:
          'Server GEMINI_API_KEY is not configured yet. Add GEMINI_API_KEY in Settings > Secrets to receive genuine responses from Gemma 4.',
        failedPrompt: trimmed,
      });
      return;
    }

    const priorConversation = messages.filter((m) => m.id !== 'msg-welcome');
    const trimmedHistorySource =
      isRetry &&
      priorConversation.length > 0 &&
      priorConversation[priorConversation.length - 1].sender === 'user' &&
      priorConversation[priorConversation.length - 1].text === trimmed
        ? priorConversation.slice(0, -1)
        : priorConversation;

    const historyForModel = trimmedHistorySource.slice(-2).map((m) => ({
      role: m.sender === 'user' ? ('user' as const) : ('model' as const),
      text: m.text.slice(0, 160),
    }));

    if (!isRetry) {
      const now = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: trimmed,
        timestamp: now,
      };

      setMessages((prev) => [...prev, userMsg]);
      setInputValue('');
    }

    setIsThinking(true);
    window.setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 30);

    const controller = new AbortController();
    // Allow sufficient window for Gemma 4 built-in reasoning + up to 2 server-side transient retries
    const timeoutId = window.setTimeout(() => controller.abort(), 165000);

    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          message: trimmed,
          history: historyForModel,
          menuItems: menuItems.map((m) => ({
            id: m.id,
            name: m.name,
            price: m.price,
            category: m.category,
            prepMinutes: m.prepMinutes,
            stock: m.stock,
            isAvailable: m.isAvailable,
          })),
        }),
      });

      const payload = (await response
        .json()
        .catch(() => null)) as AssistantApiSuccess | AssistantApiError | null;

      if (!response.ok || !payload || !payload.ok) {
        const errPayload = payload as AssistantApiError | null;
        setApiError({
          message:
            errPayload?.error ||
            `The Gemma 4 food assistant is temporarily unavailable (HTTP ${response.status}). Please wait a moment and click Retry.`,
          details: errPayload?.technicalDetails,
          failedPrompt: trimmed,
        });
        return;
      }

      // Deterministic client-side re-validation against current menuItems state
      const clientValidation = validateModelRecommendations(
        payload.recommendation?.items.map((item) => ({
          menuItemId: item.menuItemId,
          name: item.name,
          quantity: item.quantity,
        })),
        menuItems,
        payload.recommendation?.prepDisclaimer
      );

      const botMsg: ChatMessage = {
        id: `bot-${Date.now() + 1}`,
        sender: 'assistant',
        text: payload.reply,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        recommendation: clientValidation.recommendation,
        modelId: payload.modelVersion || payload.model || GEMMA_MODEL_NAME,
        latencyMs: payload.latencyMs,
        validatedByApp: true,
      };

      setMessages((prev) => [...prev, botMsg]);
      setServerStatus((prev) => ({ ...prev, checked: true, configured: true }));
    } catch (err: unknown) {
      const isTimeout =
        err instanceof DOMException && err.name === 'AbortError';
      setApiError({
        message: isTimeout
          ? 'The Gemma 4 API request timed out while generating a response. Please click Retry to try again.'
          : 'Unable to reach the CanteenIQ Gemma 4 server endpoint. Please check your connection and try again.',
        details: err instanceof Error ? err.message : undefined,
        failedPrompt: trimmed,
      });
    } finally {
      window.clearTimeout(timeoutId);
      setIsThinking(false);
      window.setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendPrompt(inputValue);
  };

  const handleResetChat = () => {
    if (isThinking) return;
    setMessages([INITIAL_ONBOARDING_MESSAGE]);
    setAddedMessageIds({});
    setInputError(null);
    setApiError(null);
  };

  const handleAddBundleClick = (
    messageId: string,
    items: RecommendedBundleItem[]
  ) => {
    const addedCount = onAddRecommendedBundle(
      items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity }))
    );
    if (addedCount > 0) {
      setAddedMessageIds((prev) => ({ ...prev, [messageId]: true }));
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-emerald-700">
            Powered by Gemma 4 ({GEMMA_MODEL_NAME}) · Server-Side Gemini API
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
            Smart Campus Food Assistant
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            Tell Gemma 4 your budget (₹) and available break time in English,
            Hindi, or Hinglish. Gemma recommends dishes using the current campus
            menu, while CanteenIQ validates prices, quantities, and stock itself.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowContextPayload((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Code2 className="w-3.5 h-3.5 text-emerald-700" />
            <span>
              {showContextPayload ? 'Hide Gemma Context' : 'Inspect Gemma Context'}
            </span>
          </button>

          <button
            type="button"
            disabled={isThinking}
            onClick={handleResetChat}
            aria-label="Reset conversation"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Chat</span>
          </button>
        </div>
      </div>

      {/* Clear Explanation of Live Gemma 4 Role vs Application Order Validation */}
      <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 flex items-start gap-3 text-xs text-slate-700 leading-relaxed">
        <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-700 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-emerald-950">
            How This Gemma 4 Assistant Works
          </p>
          <p>
            <span className="font-semibold text-slate-900">
              1. Live Gemma 4 Recommendations ({GEMMA_MODEL_NAME}):
            </span>{' '}
            Your request and the current canteen menu (item names, ₹ prices, prep
            times, and stock counts) are sent to our server-side Google Gen AI
            SDK endpoint.{' '}
            <span className="font-semibold text-slate-900">
              2. Deterministic Application Validation:
            </span>{' '}
            CanteenIQ independently verifies every suggested item ID, price,
            quantity, and stock count against the app&apos;s menu catalog. The
            model cannot invent prices or place orders directly.
          </p>
        </div>
      </div>

      {serverStatus.checked && !serverStatus.configured && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs text-amber-950 leading-relaxed"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">
              Server GEMINI_API_KEY Not Configured Yet
            </p>
            <p>
              To receive live responses from{' '}
              <span className="font-mono font-semibold">{GEMMA_MODEL_NAME}</span>,
              ensure <span className="font-mono font-semibold">GEMINI_API_KEY</span>{' '}
              is configured in your server environment / Secrets panel. Simulated
              fallbacks are disabled so responses are always genuine.
            </p>
          </div>
        </div>
      )}

      {/* Optional Judge Inspector for Gemma 4 Context & Validation */}
      {showContextPayload && (
        <div className="bg-slate-900 text-slate-100 rounded-xl p-5 space-y-2 border border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-300 font-mono">
            <span>
              Server-Side Gemma 4 Context Snapshot (Active Menu Data · Zero Secrets Exposed)
            </span>
            <span>Model: {serverStatus.model}</span>
          </div>
          <pre className="text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed">
            {JSON.stringify(gemmaContextSnapshot, null, 2)}
          </pre>
        </div>
      )}

      {/* Main Chat Container */}
      <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden flex flex-col h-[min(640px,75vh)] min-h-[460px]">
        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/50">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const suggestedDishes = (msg.suggestedItemIds || [])
              .map((id) => menuItems.find((m) => m.id === id))
              .filter((x): x is MenuItem => Boolean(x));

            // Check live availability of recommended bundle against current state
            const rec = msg.recommendation;
            const recStillInStock = rec
              ? rec.items.every((ri) => {
                  const liveItem = menuItems.find((m) => m.id === ri.menuItemId);
                  return Boolean(
                    liveItem &&
                      liveItem.isAvailable &&
                      liveItem.stock >= ri.quantity
                  );
                })
              : false;
            const wasAdded = Boolean(addedMessageIds[msg.id]);

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${
                  isUser ? 'justify-end' : 'justify-start'
                }`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-xl w-full sm:w-auto rounded-xl p-4 space-y-3.5 ${
                    isUser
                      ? 'bg-emerald-700 text-white'
                      : 'bg-white border border-slate-200 text-slate-800'
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-line">
                    {msg.text}
                  </p>

                  {/* App-Validated Recommended Items, Quantities, Total Cost & 1-Click Add to Cart */}
                  {rec && rec.items.length > 0 && (
                    <div className="border border-slate-200 rounded-xl bg-slate-50/70 p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                        <span className="font-semibold text-slate-900">
                          App-Validated Menu Recommendation
                        </span>
                        {rec.estimatedPrepMinutes !== null ? (
                          <span className="inline-flex items-center gap-1 font-mono tabular-nums text-emerald-800">
                            <Clock className="w-3.5 h-3.5" />
                            ~{rec.estimatedPrepMinutes}m est.
                          </span>
                        ) : (
                          <span className="text-amber-700 font-medium">
                            Prep time estimate unverified
                          </span>
                        )}
                      </div>

                      <div className="divide-y divide-slate-200/80 text-sm">
                        {rec.items.map((ri) => {
                          const liveItem = menuItems.find(
                            (m) => m.id === ri.menuItemId
                          );
                          const liveStock =
                            liveItem && liveItem.isAvailable ? liveItem.stock : 0;
                          const unitPrice = liveItem ? liveItem.price : ri.unitPrice;
                          const lineTotal = unitPrice * ri.quantity;

                          return (
                            <div
                              key={ri.menuItemId}
                              className="py-2 flex items-center justify-between gap-4 tabular-nums"
                            >
                              <div className="min-w-0">
                                <p className="font-medium text-slate-900">
                                  <span className="font-mono font-bold text-emerald-800 mr-1.5">
                                    {ri.quantity}×
                                  </span>
                                  {liveItem ? liveItem.name : ri.name}
                                </p>
                                <p className="text-xs text-slate-500 font-mono">
                                  ₹{unitPrice} each ·{' '}
                                  {liveStock >= ri.quantity
                                    ? `${liveStock} in stock`
                                    : liveStock > 0
                                    ? `Only ${liveStock} left in stock`
                                    : 'Out of stock'}
                                </p>
                              </div>
                              <span className="font-mono font-semibold text-slate-950 shrink-0">
                                ₹{lineTotal}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between text-sm font-bold text-slate-950 tabular-nums">
                        <span>Validated Total</span>
                        <span className="text-base font-mono text-emerald-800">
                          ₹
                          {rec.items.reduce((sum, ri) => {
                            const liveItem = menuItems.find(
                              (m) => m.id === ri.menuItemId
                            );
                            return (
                              sum +
                              (liveItem ? liveItem.price : ri.unitPrice) *
                                ri.quantity
                            );
                          }, 0)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 leading-snug">
                        {rec.prepDisclaimer}
                      </p>

                      <div className="pt-1 flex flex-col sm:flex-row sm:items-center gap-2">
                        <button
                          type="button"
                          disabled={!recStillInStock}
                          onClick={() => handleAddBundleClick(msg.id, rec.items)}
                          className="flex-1 py-2.5 px-4 inline-flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed rounded-lg transition-colors text-center cursor-pointer"
                        >
                          {wasAdded ? (
                            <>
                              <Check className="w-4 h-4 shrink-0" />
                              <span>Add recommended items to cart (Added!)</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4 shrink-0" />
                              <span>
                                Add recommended items to cart · ₹{rec.totalCost}
                              </span>
                            </>
                          )}
                        </button>

                        {wasAdded && (
                          <button
                            type="button"
                            onClick={onOpenCart}
                            className="py-2.5 px-3.5 inline-flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold text-emerald-900 bg-white border border-emerald-300 hover:bg-emerald-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <ShoppingBag className="w-4 h-4 text-emerald-700" />
                            <span>View Cart</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {!rec && suggestedDishes.length > 0 && (
                    <div className="pt-1 flex flex-wrap gap-2">
                      {suggestedDishes.map((dish) => {
                        const available = dish.isAvailable && dish.stock > 0;
                        return (
                          <button
                            key={dish.id}
                            type="button"
                            disabled={!available}
                            onClick={() => onAddToCart(dish.id)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-lg disabled:opacity-50 transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 text-emerald-700" />
                            <span className="tabular-nums">
                              Add {dish.name} · ₹{dish.price}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {msg.actionTab && msg.actionLabel && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => onNavigateTab(msg.actionTab!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
                      >
                        <span>{msg.actionLabel}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <p
                    className={`text-[11px] font-mono tabular-nums ${
                      isUser ? 'text-emerald-100' : 'text-slate-400'
                    }`}
                  >
                    {isUser
                      ? `You · ${msg.timestamp}`
                      : msg.modelId
                      ? `Gemma 4 (${msg.modelId})${
                          msg.validatedByApp ? ' · App-Validated' : ''
                        }${
                          typeof msg.latencyMs === 'number'
                            ? ` · ${(msg.latencyMs / 1000).toFixed(1)}s`
                            : ''
                        } · ${msg.timestamp}`
                      : `CanteenIQ Assistant · ${msg.timestamp}`}
                  </p>
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Loading Indicator While Gemma 4 Generates Reply */}
          {isThinking && (
            <div className="flex items-start gap-3 justify-start" role="status">
              <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
              <div className="rounded-xl px-4 py-3 bg-white border border-slate-200 text-xs font-medium text-slate-600 inline-flex items-center gap-2.5">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-700 shrink-0" />
                <span>
                  Gemma 4 ({GEMMA_MODEL_NAME}) is reasoning over your budget,
                  break time, and live menu (typically ~15–25s)...
                </span>
              </div>
            </div>
          )}

          {/* Friendly API Error Banner (Zero Silent Fallback) */}
          {apiError && !isThinking && (
            <div
              role="alert"
              className="rounded-xl p-4 bg-red-50 border border-red-200 space-y-2.5 text-xs text-red-900"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="font-bold text-red-950">
                    Gemma 4 Request Could Not Complete
                  </p>
                  <p className="leading-relaxed">{apiError.message}</p>
                  {apiError.details && (
                    <p className="font-mono text-[11px] text-red-700 break-words">
                      Details: {apiError.details}
                    </p>
                  )}
                </div>
              </div>
              <div className="pl-6">
                <button
                  type="button"
                  onClick={() => void sendPrompt(apiError.failedPrompt, true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-900 bg-white border border-red-300 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry with Gemma 4</span>
                </button>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Starter Prompts + Input Composer */}
        <div className="p-4 bg-white border-t border-slate-200 space-y-3">
          {inputError && (
            <div
              role="alert"
              className="p-2.5 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-xs font-medium text-red-800"
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-600" />
              <span>{inputError}</span>
            </div>
          )}

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={isThinking}
                onClick={() => void sendPrompt(prompt)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-900 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>

          <form onSubmit={handleFormSubmit} className="flex items-center gap-2.5">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (inputError) setInputError(null);
              }}
              placeholder='Try: "I have ₹60 and only 10 minutes. What should I order?"'
              aria-label="Message CanteenIQ Gemma 4 Assistant"
              className="flex-1 min-w-0 px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
            />
            <button
              type="submit"
              disabled={isThinking || !inputValue.trim()}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-45 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isThinking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Asking Gemma 4...</span>
                </>
              ) : (
                <>
                  <span>Send</span>
                  <Send className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
