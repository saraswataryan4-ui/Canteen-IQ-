/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import {
  ActiveTab,
  CartItem,
  DiningTable,
  GroupOrderSession,
  GroupOrderStatus,
  GroupParticipantOrderSummary,
  MenuItem,
  Order,
  OrderStatus,
  OrderLineItem,
  PortalMode,
  StaffSection,
  TableStatus,
} from './types';
import {
  INITIAL_DEMO_ORDERS,
  INITIAL_DINING_TABLES,
  INITIAL_GROUP_ORDERS,
  INITIAL_MENU_ITEMS,
} from './data/demoData';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { Permission } from './auth/authService';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, testFirestoreConnection } from './firebase';
import { Navbar } from './components/Navbar';
import { StaffNavbar } from './components/StaffNavbar';
import { RequireStaffAuth } from './components/RequireStaffAuth';
import { HomeAndMenu } from './components/HomeAndMenu';
import { GroupOrderPage } from './components/GroupOrderPage';
import { CartDrawer } from './components/CartDrawer';
import {
  OrderRefreshResult,
  OrderTracking,
} from './components/OrderTracking';
import {
  ConfirmedReservationReceipt,
  SeatReservation,
} from './components/SeatReservation';
import { GemmaChat } from './components/GemmaChat';
import { StaffDashboard } from './components/StaffDashboard';
import { Footer } from './components/Footer';

const STORAGE_KEYS = {
  menu: 'canteeniq_demo_menu_v2',
  orders: 'canteeniq_demo_orders_v3',
  tables: 'canteeniq_demo_tables_v3',
  cart: 'canteeniq_demo_cart_v2',
  tokenCounter: 'canteeniq_demo_counter_v2',
  resCounter: 'canteeniq_demo_res_counter_v3',
  groupOrders: 'canteeniq_demo_group_orders_v1',
  groupCounter: 'canteeniq_demo_group_counter_v1',
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function mergeOrdersPreservingLocalFlags(
  localOrders: Order[],
  incomingOrders: Order[]
): Order[] {
  const localByIdOrToken = new Map<string, Order>();
  for (const ord of localOrders) {
    localByIdOrToken.set(ord.id, ord);
    localByIdOrToken.set(ord.token.toLowerCase(), ord);
  }

  return incomingOrders.map((serverOrd) => {
    const localMatch =
      localByIdOrToken.get(serverOrd.id) ??
      localByIdOrToken.get(serverOrd.token.toLowerCase());
    if (!localMatch) return serverOrd;
    const mergedIsUserOrder = Boolean(
      serverOrd.isUserOrder || localMatch.isUserOrder
    );
    if (mergedIsUserOrder === Boolean(serverOrd.isUserOrder)) {
      return serverOrd;
    }
    return {
      ...serverOrd,
      isUserOrder: mergedIsUserOrder,
    };
  });
}

function areOrdersEqual(a: Order[], b: Order[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i];
    const right = b[i];
    if (
      left.id !== right.id ||
      left.token !== right.token ||
      left.status !== right.status ||
      left.totalAmount !== right.totalAmount ||
      Boolean(left.isUserOrder) !== Boolean(right.isUserOrder) ||
      left.items.length !== right.items.length
    ) {
      return false;
    }
  }
  return true;
}

function parseRouteFromHash(): {
  portal: PortalMode;
  studentTab: ActiveTab;
  staffSection: StaffSection;
} {
  const hash = window.location.hash.replace(/^#/, '').toLowerCase();
  if (hash.startsWith('staff')) {
    if (hash.includes('inventory')) {
      return {
        portal: PortalMode.Staff,
        studentTab: ActiveTab.Menu,
        staffSection: 'inventory',
      };
    }
    if (hash.includes('tables')) {
      return {
        portal: PortalMode.Staff,
        studentTab: ActiveTab.Menu,
        staffSection: 'tables',
      };
    }
    return {
      portal: PortalMode.Staff,
      studentTab: ActiveTab.Menu,
      staffSection: 'orders',
    };
  }

  if (hash.includes('group')) {
    return {
      portal: PortalMode.Student,
      studentTab: ActiveTab.GroupOrder,
      staffSection: 'orders',
    };
  }
  if (hash.includes('orders') || hash.includes('track')) {
    return {
      portal: PortalMode.Student,
      studentTab: ActiveTab.TrackOrder,
      staffSection: 'orders',
    };
  }
  if (hash.includes('seating')) {
    return {
      portal: PortalMode.Student,
      studentTab: ActiveTab.Seating,
      staffSection: 'orders',
    };
  }
  if (hash.includes('assistant') || hash.includes('chat')) {
    return {
      portal: PortalMode.Student,
      studentTab: ActiveTab.Chat,
      staffSection: 'orders',
    };
  }
  return {
    portal: PortalMode.Student,
    studentTab: ActiveTab.Menu,
    staffSection: 'orders',
  };
}

function CanteenIQWorkspace() {
  const {
    staffSession,
    isStaffAuthenticated,
    logoutStaff,
    can,
    user,
    customer,
    isAuthenticated,
    isAdmin,
  } = useAuth();

  const initialRoute = useMemo(() => parseRouteFromHash(), []);
  const [portalMode, setPortalMode] = useState<PortalMode>(initialRoute.portal);
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    initialRoute.studentTab
  );
  const [staffSection, setStaffSection] = useState<StaffSection>(
    initialRoute.staffSection
  );
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [menuItems, setMenuItems] = useState<MenuItem[]>(() =>
    loadFromStorage(STORAGE_KEYS.menu, INITIAL_MENU_ITEMS)
  );
  const [orders, setOrders] = useState<Order[]>(() =>
    loadFromStorage(STORAGE_KEYS.orders, INITIAL_DEMO_ORDERS)
  );
  const [tables, setTables] = useState<DiningTable[]>(() =>
    loadFromStorage(STORAGE_KEYS.tables, INITIAL_DINING_TABLES)
  );
  const [cart, setCart] = useState<CartItem[]>(() =>
    loadFromStorage(STORAGE_KEYS.cart, [])
  );
  const [tokenCounter, setTokenCounter] = useState<number>(() =>
    loadFromStorage(STORAGE_KEYS.tokenCounter, 106)
  );
  const [reservationCounter, setReservationCounter] = useState<number>(() =>
    loadFromStorage(STORAGE_KEYS.resCounter, 301)
  );
  const [groupOrders, setGroupOrders] = useState<GroupOrderSession[]>(() =>
    loadFromStorage(STORAGE_KEYS.groupOrders, INITIAL_GROUP_ORDERS)
  );
  const [groupCodeCounter, setGroupCodeCounter] = useState<number>(() =>
    loadFromStorage(STORAGE_KEYS.groupCounter, 4822)
  );
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(() => {
    const initialGroups = loadFromStorage(
      STORAGE_KEYS.groupOrders,
      INITIAL_GROUP_ORDERS
    );
    return initialGroups[0]?.id ?? null;
  });
  const [selectedOrderToken, setSelectedOrderToken] = useState<string | null>(
    () => {
      const initialOrders = loadFromStorage(
        STORAGE_KEYS.orders,
        INITIAL_DEMO_ORDERS
      );
      return initialOrders[0]?.token ?? null;
    }
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync browser hash navigation cleanly
  useEffect(() => {
    const onHashChange = () => {
      const next = parseRouteFromHash();
      setPortalMode(next.portal);
      if (next.portal === PortalMode.Student) {
        setActiveTab(next.studentTab);
      } else {
        setStaffSection(next.staffSection);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    let targetHash = '#student/menu';
    if (portalMode === PortalMode.Staff) {
      targetHash = isStaffAuthenticated
        ? `#staff/${staffSection}`
        : '#staff/login';
    } else {
      if (activeTab === ActiveTab.GroupOrder) targetHash = '#student/group';
      else if (activeTab === ActiveTab.TrackOrder)
        targetHash = '#student/orders';
      else if (activeTab === ActiveTab.Seating) targetHash = '#student/seating';
      else if (activeTab === ActiveTab.Chat) targetHash = '#student/assistant';
      else targetHash = '#student/menu';
    }
    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, '', targetHash);
    }
  }, [portalMode, activeTab, staffSection, isStaffAuthenticated]);

  // Persist orders separately so non-order state edits (e.g., cart changes) never overwrite newer cross-tab order statuses
  useEffect(() => {
    try {
      const serialized = JSON.stringify(orders);
      if (localStorage.getItem(STORAGE_KEYS.orders) !== serialized) {
        localStorage.setItem(STORAGE_KEYS.orders, serialized);
      }
    } catch {
      // Ignore storage quota errors in restricted sandboxes
    }
  }, [orders]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.menu, JSON.stringify(menuItems));
      localStorage.setItem(STORAGE_KEYS.tables, JSON.stringify(tables));
      localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(cart));
      localStorage.setItem(
        STORAGE_KEYS.tokenCounter,
        JSON.stringify(tokenCounter)
      );
      localStorage.setItem(
        STORAGE_KEYS.resCounter,
        JSON.stringify(reservationCounter)
      );
      localStorage.setItem(
        STORAGE_KEYS.groupOrders,
        JSON.stringify(groupOrders)
      );
      localStorage.setItem(
        STORAGE_KEYS.groupCounter,
        JSON.stringify(groupCodeCounter)
      );
    } catch {
      // Ignore storage quota errors in restricted sandboxes
    }
  }, [
    menuItems,
    tables,
    cart,
    tokenCounter,
    reservationCounter,
    groupOrders,
    groupCodeCounter,
  ]);

  // Listen for same-browser cross-tab storage updates cleanly
  useEffect(() => {
    const handleStorageEvent = (event: StorageEvent) => {
      if (!event.newValue) return;
      try {
        if (event.key === STORAGE_KEYS.orders) {
          const parsed = JSON.parse(event.newValue) as Order[];
          if (Array.isArray(parsed)) {
            setOrders((prev) => {
              const merged = mergeOrdersPreservingLocalFlags(prev, parsed);
              return areOrdersEqual(prev, merged) ? prev : merged;
            });
          }
        } else if (event.key === STORAGE_KEYS.menu) {
          const parsed = JSON.parse(event.newValue) as MenuItem[];
          if (Array.isArray(parsed)) setMenuItems(parsed);
        } else if (event.key === STORAGE_KEYS.tables) {
          const parsed = JSON.parse(event.newValue) as DiningTable[];
          if (Array.isArray(parsed)) setTables(parsed);
        } else if (event.key === STORAGE_KEYS.groupOrders) {
          const parsed = JSON.parse(event.newValue) as GroupOrderSession[];
          if (Array.isArray(parsed)) setGroupOrders(parsed);
        }
      } catch {
        // Ignore malformed storage values
      }
    };

    window.addEventListener('storage', handleStorageEvent);
    return () => window.removeEventListener('storage', handleStorageEvent);
  }, []);

  // Re-fetch latest orders from the Express endpoint (/api/orders)
  const refreshOrders = useCallback(
    async (signal?: AbortSignal): Promise<OrderRefreshResult> => {
      try {
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (isStaffAuthenticated && staffSession) {
          headers['x-staff-id'] = staffSession.staffId;
        }
        if (isAdmin && (user?.email || customer?.email)) {
          headers['x-admin-email'] = user?.email || customer?.email || '';
        }
        if (user?.uid) {
          headers['x-customer-uid'] = user.uid;
        }
        if (customer?.customerId) {
          headers['x-customer-id'] = customer.customerId;
        }
        if (customer?.uid) {
          headers['x-customer-uid'] = customer.uid;
        }
        if (customer?.email || user?.email) {
          headers['x-customer-email'] = customer?.email || user?.email || '';
        }

        const res = await fetch('/api/orders', {
          method: 'GET',
          headers,
          cache: 'no-store',
          signal,
        });

        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          orders?: Order[];
          error?: string;
        } | null;

        if (!res.ok || !data || !data.ok || !Array.isArray(data.orders)) {
          return {
            ok: false,
            error:
              data?.error ||
              "Couldn't check for the latest order status right now. Showing your last known order details — retrying automatically every 3 seconds.",
          };
        }

        const serverList = data.orders;
        setOrders((prev) => {
          const merged = mergeOrdersPreservingLocalFlags(prev, serverList);
          return areOrdersEqual(prev, merged) ? prev : merged;
        });

        return { ok: true };
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw err;
        }
        return {
          ok: false,
          error:
            "Couldn't reach the CanteenIQ order tracker right now. Showing your last known order details — retrying automatically every 3 seconds.",
        };
      }
    },
    [isStaffAuthenticated, staffSession, isAdmin, user, customer]
  );

  // Trigger order refresh whenever authenticated user or staff changes
  useEffect(() => {
    const controller = new AbortController();
    void refreshOrders(controller.signal).catch(() => {});
    return () => controller.abort();
  }, [user, customer, isStaffAuthenticated, refreshOrders]);

  // Initial sync on mount: register any locally stored session orders on the server & reconcile latest statuses
  useEffect(() => {
    const controller = new AbortController();
    const initialLocalOrders = loadFromStorage(
      STORAGE_KEYS.orders,
      INITIAL_DEMO_ORDERS
    );

    fetch('/api/orders/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders: initialLocalOrders }),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ok?: boolean; orders?: Order[] } | null) => {
        if (!data?.ok || !Array.isArray(data.orders)) return;
        const syncedOrders = data.orders;
        setOrders((prev) => {
          const merged = mergeOrdersPreservingLocalFlags(prev, syncedOrders);
          return areOrdersEqual(prev, merged) ? prev : merged;
        });
      })
      .catch(() => {
        // Offline or initial warmup; local demo state remains intact
      });

    return () => controller.abort();
  }, []);

  // Refresh queue when switching into Staff Portal so Staff sees orders placed from any open Student tab
  useEffect(() => {
    if (portalMode !== PortalMode.Staff) return;
    const controller = new AbortController();
    void refreshOrders(controller.signal).catch(() => {});
    return () => controller.abort();
  }, [portalMode, refreshOrders]);

  // Verify Firebase Firestore connectivity on mount
  useEffect(() => {
    testFirestoreConnection().catch((err) => {
      console.warn('Initial Firestore connection notice:', err);
    });
  }, []);

  // Real-time Cloud Firestore synchronization:
  // - Admin (e.g. saraswataryan2312@gmail.com): listens to all orders in Firestore
  // - Customer: listens to their own orders (filtered by userId == user.uid)
  // - Preserves live status updates (Received -> Preparing -> Ready -> Dispatched -> Delivered)
  useEffect(() => {
    if (!user) return;

    try {
      const ordersCol = collection(db, 'orders');
      const q = isAdmin
        ? query(ordersCol)
        : query(ordersCol, where('userId', '==', user.uid));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const remoteOrders: Order[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            remoteOrders.push({
              id: docSnap.id,
              token: data.token || docSnap.id,
              studentName: data.studentName || data.customerName || 'Customer',
              rollNumber: data.rollNumber || '',
              items: Array.isArray(data.items) ? data.items : [],
              totalAmount:
                typeof data.totalAmount === 'number' ? data.totalAmount : 0,
              status: (data.status as OrderStatus) || OrderStatus.Received,
              createdAt:
                data.createdAtText ||
                (data.createdAt?.toDate
                  ? data.createdAt
                      .toDate()
                      .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : new Date().toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })),
              estimatedMinutes: data.estimatedMinutes ?? 10,
              tableId: data.tableId || undefined,
              notes: data.notes || undefined,
              isUserOrder: data.userId === user.uid || Boolean(data.isUserOrder),
              userId: data.userId,
              customerEmail: data.customerEmail,
              customerPhone: data.customerPhone,
              deliveryAddress: data.deliveryAddress,
              deliveryNotes: data.deliveryNotes,
            });
          });

          // Sort descending by id
          remoteOrders.sort((a, b) => b.id.localeCompare(a.id));

          setOrders((prev) => {
            const remoteMap = new Map<string, Order>();
            remoteOrders.forEach((ro) => {
              remoteMap.set(ro.id, ro);
              remoteMap.set(ro.token.toLowerCase(), ro);
            });
            const merged = [
              ...remoteOrders,
              ...prev.filter(
                (p) =>
                  !remoteMap.has(p.id) &&
                  !remoteMap.has(p.token.toLowerCase())
              ),
            ];
            return areOrdersEqual(prev, merged) ? prev : merged;
          });
        },
        (error) => {
          console.warn('Firestore orders subscription notice:', error.message);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.warn('Failed to attach Firestore listener:', err);
    }
  }, [user, isAdmin]);

  const showToast = (message: string) => {
    setToastMessage(message);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const cartSummary = useMemo(() => {
    let count = 0;
    let total = 0;
    for (const entry of cart) {
      const item = menuItems.find((m) => m.id === entry.menuItemId);
      if (item && item.isAvailable && item.stock > 0) {
        count += entry.quantity;
        total += item.price * entry.quantity;
      }
    }
    return { count, total };
  }, [cart, menuItems]);

  // Private customer orders: filtered strictly by authenticated customer identity
  const customerOrders = useMemo(() => {
    if (!isAuthenticated && !user && !customer) {
      return [];
    }
    const currentUid = user?.uid || customer?.uid;
    const currentCustId = customer?.customerId;
    const currentEmail = (customer?.email || user?.email || '').toLowerCase().trim();

    return orders.filter((o) => {
      if (currentUid && o.userId === currentUid) return true;
      if (currentCustId && o.customerId === currentCustId) return true;
      if (currentEmail && o.customerEmail && o.customerEmail.toLowerCase().trim() === currentEmail) return true;
      if (o.isUserOrder && !o.userId) return true;
      return false;
    });
  }, [orders, user, customer, isAuthenticated]);

  // Portal Navigation Helpers
  const openStudentTab = (tab: ActiveTab) => {
    setPortalMode(PortalMode.Student);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openStaffPortal = () => {
    setIsCartOpen(false);
    setPortalMode(PortalMode.Staff);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStaffLogout = async () => {
    await logoutStaff();
    setPortalMode(PortalMode.Student);
    setActiveTab(ActiveTab.Menu);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Signed out of Staff session');
  };

  // Student Cart Actions
  const handleAddToCart = (menuItemId: string) => {
    const item = menuItems.find((m) => m.id === menuItemId);
    if (!item || !item.isAvailable || item.stock <= 0) return;

    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === menuItemId);
      if (existing) {
        if (existing.quantity >= item.stock) return prev;
        return prev.map((c) =>
          c.menuItemId === menuItemId ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { menuItemId, quantity: 1 }];
    });
    showToast(`Added ${item.name} (₹${item.price}) to your cart`);
  };

  const handleAddRecommendedBundle = (
    bundle: { menuItemId: string; quantity: number }[]
  ): number => {
    let totalUnitsAdded = 0;
    let totalCostAdded = 0;
    const nextCart = [...cart];

    for (const req of bundle) {
      const item = menuItems.find((m) => m.id === req.menuItemId);
      if (!item || !item.isAvailable || item.stock <= 0 || req.quantity <= 0) {
        continue;
      }
      const idx = nextCart.findIndex((c) => c.menuItemId === req.menuItemId);
      const currentQty = idx >= 0 ? nextCart[idx].quantity : 0;
      const allowedToAdd = Math.max(
        0,
        Math.min(req.quantity, item.stock - currentQty)
      );
      if (allowedToAdd > 0) {
        totalUnitsAdded += allowedToAdd;
        totalCostAdded += allowedToAdd * item.price;
        if (idx >= 0) {
          nextCart[idx] = {
            ...nextCart[idx],
            quantity: currentQty + allowedToAdd,
          };
        } else {
          nextCart.push({
            menuItemId: req.menuItemId,
            quantity: allowedToAdd,
          });
        }
      }
    }

    if (totalUnitsAdded > 0) {
      setCart(nextCart);
      showToast(
        `Added ${totalUnitsAdded} recommended ${
          totalUnitsAdded === 1 ? 'item' : 'items'
        } (₹${totalCostAdded}) to your cart`
      );
    } else {
      showToast('Selected items are already at maximum available stock');
    }

    return totalUnitsAdded;
  };

  const handleUpdateCartQuantity = (menuItemId: string, delta: number) => {
    const item = menuItems.find((m) => m.id === menuItemId);
    if (!item) return;

    setCart((prev) =>
      prev
        .map((c) => {
          if (c.menuItemId !== menuItemId) return c;
          const nextQty = Math.min(item.stock, c.quantity + delta);
          return { ...c, quantity: nextQty };
        })
        .filter((c) => c.quantity > 0)
    );
  };

  const handleRemoveFromCart = (menuItemId: string) => {
    setCart((prev) => prev.filter((c) => c.menuItemId !== menuItemId));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  // Student Checkout & Unique Order Token Generation (Initial status = Received)
  const handlePlaceOrder = async (payload: {
    studentName: string;
    rollNumber: string;
    tableId?: string;
    notes?: string;
    customerEmail?: string;
    customerPhone?: string;
    deliveryAddress?: string;
    deliveryNotes?: string;
  }): Promise<Order> => {
    const lineItems = cart
      .map((entry) => {
        const item = menuItems.find((m) => m.id === entry.menuItemId);
        if (!item) return null;
        return {
          menuItemId: item.id,
          name: item.name,
          unitPrice: item.price,
          quantity: entry.quantity,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const totalAmount = lineItems.reduce(
      (sum, li) => sum + li.unitPrice * li.quantity,
      0
    );

    const maxPrep = cart.reduce((max, entry) => {
      const item = menuItems.find((m) => m.id === entry.menuItemId);
      return item ? Math.max(max, item.prepMinutes) : max;
    }, 4);

    let nextNum = tokenCounter;
    let uniqueToken = `CIQ-${nextNum}`;
    const existingTokens = new Set(orders.map((o) => o.token.toUpperCase()));
    while (existingTokens.has(uniqueToken.toUpperCase())) {
      nextNum += 1;
      uniqueToken = `CIQ-${nextNum}`;
    }
    setTokenCounter(nextNum + 1);

    const formattedTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const selectedTable = payload.tableId
      ? tables.find(
          (t) => t.id === payload.tableId || t.label === payload.tableId
        )
      : undefined;

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      token: uniqueToken,
      studentName: payload.studentName,
      rollNumber: payload.rollNumber,
      items: lineItems,
      totalAmount,
      status: OrderStatus.Received,
      createdAt: formattedTime,
      estimatedMinutes: maxPrep + 2,
      tableId: selectedTable ? selectedTable.label : payload.tableId,
      notes: payload.notes,
      isUserOrder: true,
      userId: user?.uid || customer?.uid,
      customerId: customer?.customerId,
      customerEmail: payload.customerEmail || customer?.email || user?.email || undefined,
      customerPhone: payload.customerPhone || customer?.phone,
      deliveryAddress: payload.deliveryAddress,
      deliveryNotes: payload.deliveryNotes,
    };

    setMenuItems((prev) =>
      prev.map((item) => {
        const ordered = lineItems.find((li) => li.menuItemId === item.id);
        if (!ordered) return item;
        const nextStock = Math.max(0, item.stock - ordered.quantity);
        return {
          ...item,
          stock: nextStock,
          isAvailable: nextStock > 0 ? item.isAvailable : false,
        };
      })
    );

    if (selectedTable && selectedTable.status === TableStatus.Available) {
      let nextResNum = reservationCounter;
      let uniqueResId = `RES-${nextResNum}`;
      const existingResIds = new Set(
        tables
          .map((t) => t.reservationId?.toUpperCase())
          .filter((x): x is string => Boolean(x))
      );
      while (existingResIds.has(uniqueResId.toUpperCase())) {
        nextResNum += 1;
        uniqueResId = `RES-${nextResNum}`;
      }
      setReservationCounter(nextResNum + 1);

      setTables((prev) =>
        prev.map((t) =>
          t.id === selectedTable.id && t.status === TableStatus.Available
            ? {
                ...t,
                status: TableStatus.Reserved,
                occupantName: payload.studentName,
                timeSlot: 'Immediate Dining (30 mins)',
                partySize: Math.min(2, t.capacity),
                reservationId: uniqueResId,
                isCurrentUserReservation: true,
              }
            : t
        )
      );
    }

    setOrders((prev) => [newOrder, ...prev]);
    setSelectedOrderToken(uniqueToken);
    setCart([]);
    showToast(`Order ${uniqueToken} placed — Status: Received`);

    // Persist order in Cloud Firestore under /orders/{orderId}
    // if (user || customer) {
    //   try {
    //     const orderDocRef = doc(db, 'orders', newOrder.id);
    //     await setDoc(orderDocRef, {
    //       id: newOrder.id,
    //       token: newOrder.token,
    //       studentName: newOrder.studentName,
    //       customerName: newOrder.studentName,
    //       rollNumber: newOrder.rollNumber || '',
    //       items: newOrder.items,
    //       totalAmount: newOrder.totalAmount,
    //       status: newOrder.status,
    //       createdAtText: formattedTime,
    //       createdAt: serverTimestamp(),
    //       estimatedMinutes: newOrder.estimatedMinutes,
    //       tableId: newOrder.tableId || null,
    //       notes: newOrder.notes || null,
    //       isUserOrder: true,
    //       userId: user?.uid || customer?.uid || 'authenticated',
    //       customerId: customer?.customerId || null,
    //       customerEmail: newOrder.customerEmail || customer?.email || user?.email || '',
    //       customerPhone: newOrder.customerPhone || '',
    //       deliveryAddress: newOrder.deliveryAddress || '',
    //       deliveryNotes: newOrder.deliveryNotes || '',
    //     });
    //   } catch (firestoreErr) {
    //     console.warn('Error saving order to Cloud Firestore:', firestoreErr);
    //   }
    // }

    
    // Persist order in Cloud Firestore under /orders/{orderId}
    const firebaseUid = user?.uid;

    console.log('Firebase user:', user);
    console.log('Firebase UID:', firebaseUid);
    console.log('Customer UID:', customer?.uid);
    console.log('Customer ID:', customer?.customerId);
    console.log('Customer session:', customer);


    if (!firebaseUid) {
      console.warn(
        'Order saved locally/API only: a Firebase-authenticated user is required for Firestore.'
      );
    } else {
      try {
        const orderDocRef = doc(db, 'orders', newOrder.id);

        await setDoc(orderDocRef, {
          id: newOrder.id,
          token: newOrder.token,
          studentName: newOrder.studentName,
          customerName: newOrder.studentName,
          rollNumber: newOrder.rollNumber || '',
          items: newOrder.items,
          totalAmount: newOrder.totalAmount,
          status: 'Received',
          createdAtText: formattedTime,
          createdAt: serverTimestamp(),
          estimatedMinutes: newOrder.estimatedMinutes,
          tableId: newOrder.tableId || null,
          notes: newOrder.notes || null,
          isUserOrder: true,
          userId: firebaseUid,
          customerId: customer?.customerId || null,
          customerEmail:
            newOrder.customerEmail ||
            customer?.email ||
            user?.email ||
            '',
          customerPhone: newOrder.customerPhone || '',
          deliveryAddress: newOrder.deliveryAddress || '',
          deliveryNotes: newOrder.deliveryNotes || '',
        });

        console.info('Order saved to Cloud Firestore:', newOrder.id);
      } catch (firestoreErr) {
        console.error('Error saving order to Cloud Firestore:', firestoreErr);
      }
    }


    const orderHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (user?.uid) orderHeaders['x-customer-uid'] = user.uid;
    if (customer?.customerId) orderHeaders['x-customer-id'] = customer.customerId;
    if (customer?.uid) orderHeaders['x-customer-uid'] = customer.uid;
    if (customer?.email || user?.email) orderHeaders['x-customer-email'] = customer?.email || user?.email || '';

    void fetch('/api/orders', {
      method: 'POST',
      headers: orderHeaders,
      body: JSON.stringify({ order: newOrder }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ok?: boolean; orders?: Order[] } | null) => {
        if (data?.ok && Array.isArray(data.orders)) {
          const synced = data.orders;
          setOrders((prev) => {
            const merged = mergeOrdersPreservingLocalFlags(prev, synced);
            return areOrdersEqual(prev, merged) ? prev : merged;
          });
        }
      })
      .catch(() => {});

    return newOrder;
  };

  // Student Seat Reservation Handlers (Prevents booking Occupied/Reserved tables & generates unique RES-xxx ID)
  const handleConfirmReservation = (payload: {
    tableId: string;
    studentName: string;
    timeSlot: string;
    partySize: number;
  }): ConfirmedReservationReceipt | null => {
    const targetTable = tables.find((t) => t.id === payload.tableId);
    if (!targetTable || targetTable.status !== TableStatus.Available) {
      showToast(
        'Cannot reserve this table — it is already Occupied or Reserved'
      );
      return null;
    }

    let nextResNum = reservationCounter;
    let uniqueResId = `RES-${nextResNum}`;
    const existingResIds = new Set(
      tables
        .map((t) => t.reservationId?.toUpperCase())
        .filter((x): x is string => Boolean(x))
    );
    while (existingResIds.has(uniqueResId.toUpperCase())) {
      nextResNum += 1;
      uniqueResId = `RES-${nextResNum}`;
    }
    setReservationCounter(nextResNum + 1);

    const sanitizedGuestCount = Math.max(
      1,
      Math.min(payload.partySize, targetTable.capacity)
    );

    setTables((prev) =>
      prev.map((t) =>
        t.id === targetTable.id && t.status === TableStatus.Available
          ? {
              ...t,
              status: TableStatus.Reserved,
              occupantName: payload.studentName,
              timeSlot: payload.timeSlot,
              partySize: sanitizedGuestCount,
              reservationId: uniqueResId,
              isCurrentUserReservation: true,
            }
          : t
      )
    );

    showToast(
      `${targetTable.label} reserved (${uniqueResId}) for ${payload.timeSlot}`
    );

    return {
      reservationId: uniqueResId,
      tableId: targetTable.id,
      tableLabel: targetTable.label,
      timeSlot: payload.timeSlot,
      studentName: payload.studentName,
      partySize: sanitizedGuestCount,
    };
  };

  const handleCancelStudentReservation = (tableId: string) => {
    const targetTable = tables.find((t) => t.id === tableId);
    if (
      !targetTable ||
      targetTable.status !== TableStatus.Reserved ||
      !targetTable.isCurrentUserReservation
    ) {
      showToast('Only your active session reservations can be cancelled here');
      return;
    }

    setTables((prev) =>
      prev.map((t) =>
        t.id === tableId &&
        t.status === TableStatus.Reserved &&
        t.isCurrentUserReservation
          ? {
              ...t,
              status: TableStatus.Available,
              occupantName: undefined,
              timeSlot: undefined,
              partySize: undefined,
              reservationId: undefined,
              isCurrentUserReservation: false,
            }
          : t
      )
    );
    showToast(
      `Cancelled demo reservation ${
        targetTable.reservationId ?? ''
      } — ${targetTable.label} is now Available`.trim()
    );
  };

  // =========================================================================
  // STUDENT GROUP ORDERING HANDLERS (Demo Single-Browser Shared State)
  // =========================================================================

  const handleCreateGroupOrder = (payload: {
    organizerName: string;
    organizerRollNumber: string;
    title: string;
  }): GroupOrderSession => {
    let nextCodeNum = groupCodeCounter;
    let uniqueCode = `GRP-${nextCodeNum}`;
    const existingCodes = new Set(groupOrders.map((g) => g.code.toUpperCase()));
    while (existingCodes.has(uniqueCode.toUpperCase())) {
      nextCodeNum += 1;
      uniqueCode = `GRP-${nextCodeNum}`;
    }
    setGroupCodeCounter(nextCodeNum + 1);

    const formattedTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const newGroup: GroupOrderSession = {
      id: `grp-${Date.now()}`,
      code: uniqueCode,
      title: payload.title,
      organizerName: payload.organizerName,
      organizerRollNumber: payload.organizerRollNumber,
      status: GroupOrderStatus.Open,
      createdAt: formattedTime,
      participants: [
        {
          id: `part-org-${Date.now()}`,
          name: payload.organizerName,
          isOrganizer: true,
          joinedAt: formattedTime,
          items: [],
        },
      ],
    };

    setGroupOrders((prev) => [newGroup, ...prev]);
    setSelectedGroupId(newGroup.id);
    showToast(`Created Group Order ${uniqueCode} — share code with friends`);
    return newGroup;
  };

  const handleJoinGroupOrderByCode = (payload: {
    code: string;
    participantName: string;
  }): {
    ok: boolean;
    group?: GroupOrderSession;
    participantId?: string;
    error?: string;
  } => {
    const cleanCode = payload.code.trim().toUpperCase();
    const cleanName = payload.participantName.trim();

    if (!cleanCode) {
      return { ok: false, error: 'Please enter a valid group code (e.g., GRP-4821).' };
    }
    if (!cleanName) {
      return { ok: false, error: 'Please enter the friend / participant name.' };
    }

    const targetGroup = groupOrders.find(
      (g) => g.code.toUpperCase() === cleanCode
    );
    if (!targetGroup) {
      return {
        ok: false,
        error: `No demo group order found with code "${cleanCode}".`,
      };
    }
    if (targetGroup.status !== GroupOrderStatus.Open) {
      return {
        ok: false,
        error: `Group order ${targetGroup.code} has already been confirmed and closed.`,
      };
    }

    const existingParticipant = targetGroup.participants.find(
      (p) => p.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (existingParticipant) {
      showToast(`Switched to ${existingParticipant.name} in ${targetGroup.code}`);
      return {
        ok: true,
        group: targetGroup,
        participantId: existingParticipant.id,
      };
    }

    const formattedTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const newParticipant = {
      id: `part-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      isOrganizer: false,
      joinedAt: formattedTime,
      items: [],
    };

    const updatedGroup: GroupOrderSession = {
      ...targetGroup,
      participants: [...targetGroup.participants, newParticipant],
    };

    setGroupOrders((prev) =>
      prev.map((g) => (g.id === targetGroup.id ? updatedGroup : g))
    );
    showToast(`${cleanName} joined group order ${targetGroup.code}`);
    return {
      ok: true,
      group: updatedGroup,
      participantId: newParticipant.id,
    };
  };

  const handleUpdateParticipantItem = (payload: {
    groupId: string;
    participantId: string;
    menuItemId: string;
    nextQuantity: number;
  }): { ok: boolean; error?: string } => {
    if (
      !Number.isFinite(payload.nextQuantity) ||
      !Number.isInteger(payload.nextQuantity) ||
      payload.nextQuantity < 0
    ) {
      return {
        ok: false,
        error: 'Quantity must be a valid non-negative whole number.',
      };
    }

    const targetGroup = groupOrders.find((g) => g.id === payload.groupId);
    if (!targetGroup || targetGroup.status !== GroupOrderStatus.Open) {
      return {
        ok: false,
        error: 'This group order is no longer open for editing.',
      };
    }

    const menuItem = menuItems.find((m) => m.id === payload.menuItemId);
    if (!menuItem) {
      return { ok: false, error: 'Selected menu item does not exist.' };
    }
    if ((!menuItem.isAvailable || menuItem.stock <= 0) && payload.nextQuantity > 0) {
      return {
        ok: false,
        error: `${menuItem.name} is currently unavailable in demo stock.`,
      };
    }

    const otherParticipantsQty = targetGroup.participants
      .filter((p) => p.id !== payload.participantId)
      .reduce((sum, p) => {
        const entry = p.items.find((i) => i.menuItemId === payload.menuItemId);
        return sum + (entry ? entry.quantity : 0);
      }, 0);

    const maxAllowed = Math.max(0, menuItem.stock - otherParticipantsQty);
    if (payload.nextQuantity > maxAllowed) {
      return {
        ok: false,
        error: `Only ${menuItem.stock} ${menuItem.name} portions available across the whole group (${otherParticipantsQty} already added by friends).`,
      };
    }

    setGroupOrders((prev) =>
      prev.map((g) => {
        if (g.id !== payload.groupId) return g;
        return {
          ...g,
          participants: g.participants.map((p) => {
            if (p.id !== payload.participantId) return p;
            if (payload.nextQuantity === 0) {
              return {
                ...p,
                items: p.items.filter(
                  (i) => i.menuItemId !== payload.menuItemId
                ),
              };
            }
            const exists = p.items.some(
              (i) => i.menuItemId === payload.menuItemId
            );
            if (exists) {
              return {
                ...p,
                items: p.items.map((i) =>
                  i.menuItemId === payload.menuItemId
                    ? { ...i, quantity: payload.nextQuantity }
                    : i
                ),
              };
            }
            return {
              ...p,
              items: [
                ...p.items,
                {
                  menuItemId: payload.menuItemId,
                  quantity: payload.nextQuantity,
                },
              ],
            };
          }),
        };
      })
    );

    return { ok: true };
  };

  const handleRemoveParticipant = (groupId: string, participantId: string) => {
    setGroupOrders((prev) =>
      prev.map((g) => {
        if (g.id !== groupId || g.status !== GroupOrderStatus.Open) return g;
        return {
          ...g,
          participants: g.participants.filter(
            (p) => p.id !== participantId || p.isOrganizer
          ),
        };
      })
    );
  };

  const handleUpdateGroupMetadata = (
    groupId: string,
    updates: { tableId?: string; notes?: string }
  ) => {
    setGroupOrders((prev) =>
      prev.map((g) =>
        g.id === groupId && g.status === GroupOrderStatus.Open
          ? { ...g, ...updates }
          : g
      )
    );
  };

  const handleConfirmGroupOrder = (
    groupId: string
  ): { ok: boolean; order?: Order; error?: string } => {
    const targetGroup = groupOrders.find((g) => g.id === groupId);
    if (!targetGroup) {
      return { ok: false, error: 'Group order session not found.' };
    }
    if (targetGroup.status !== GroupOrderStatus.Open) {
      return {
        ok: false,
        error: 'This group order has already been confirmed.',
      };
    }

    // Aggregate items & build per-participant breakdown
    const aggregatedQtyMap: Record<string, number> = {};
    const participantSummaries: GroupParticipantOrderSummary[] = [];

    for (const part of targetGroup.participants) {
      const partLines: OrderLineItem[] = [];
      let partSubtotal = 0;

      for (const entry of part.items) {
        if (!Number.isInteger(entry.quantity) || entry.quantity <= 0) continue;
        const menu = menuItems.find((m) => m.id === entry.menuItemId);
        if (!menu) continue;
        aggregatedQtyMap[menu.id] =
          (aggregatedQtyMap[menu.id] ?? 0) + entry.quantity;
        partLines.push({
          menuItemId: menu.id,
          name: menu.name,
          unitPrice: menu.price,
          quantity: entry.quantity,
        });
        partSubtotal += menu.price * entry.quantity;
      }

      participantSummaries.push({
        participantId: part.id,
        participantName: part.name,
        isOrganizer: part.isOrganizer,
        items: partLines,
        subtotal: partSubtotal,
      });
    }

    const combinedLines: OrderLineItem[] = [];
    let maxPrep = 4;

    for (const menu of menuItems) {
      const totalQty = aggregatedQtyMap[menu.id] ?? 0;
      if (totalQty <= 0) continue;
      if (!menu.isAvailable || totalQty > menu.stock) {
        return {
          ok: false,
          error: `${menu.name} only has ${menu.stock} portions left in demo stock. Adjust quantities before confirming.`,
        };
      }
      combinedLines.push({
        menuItemId: menu.id,
        name: menu.name,
        unitPrice: menu.price,
        quantity: totalQty,
      });
      maxPrep = Math.max(maxPrep, menu.prepMinutes);
    }

    if (combinedLines.length === 0) {
      return {
        ok: false,
        error:
          'Cannot confirm an empty group order. Add at least one menu item first.',
      };
    }

    const totalAmount = combinedLines.reduce(
      (sum, li) => sum + li.unitPrice * li.quantity,
      0
    );

    let nextNum = tokenCounter;
    let uniqueGroupToken = `CIQ-G${nextNum}`;
    const existingTokens = new Set(orders.map((o) => o.token.toUpperCase()));
    while (existingTokens.has(uniqueGroupToken.toUpperCase())) {
      nextNum += 1;
      uniqueGroupToken = `CIQ-G${nextNum}`;
    }
    setTokenCounter(nextNum + 1);

    const formattedTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const newGroupOrder: Order = {
      id: `ord-grp-${Date.now()}`,
      token: uniqueGroupToken,
      studentName: targetGroup.organizerName,
      rollNumber: targetGroup.organizerRollNumber,
      items: combinedLines,
      totalAmount,
      status: OrderStatus.Received,
      createdAt: formattedTime,
      estimatedMinutes: maxPrep + 3,
      tableId: targetGroup.tableId,
      notes: targetGroup.notes?.trim() || undefined,
      isUserOrder: true,
      isGroupOrder: true,
      groupCode: targetGroup.code,
      groupParticipants: participantSummaries,
    };

    // Deduct stock from sample menu
    setMenuItems((prev) =>
      prev.map((item) => {
        const ordered = combinedLines.find((li) => li.menuItemId === item.id);
        if (!ordered) return item;
        const nextStock = Math.max(0, item.stock - ordered.quantity);
        return {
          ...item,
          stock: nextStock,
          isAvailable: nextStock > 0 ? item.isAvailable : false,
        };
      })
    );

    if (targetGroup.tableId) {
      const chosenTable = tables.find(
        (t) =>
          (t.label === targetGroup.tableId || t.id === targetGroup.tableId) &&
          t.status === TableStatus.Available
      );
      if (chosenTable) {
        let nextResNum = reservationCounter;
        let uniqueResId = `RES-${nextResNum}`;
        const existingResIds = new Set(
          tables
            .map((t) => t.reservationId?.toUpperCase())
            .filter((x): x is string => Boolean(x))
        );
        while (existingResIds.has(uniqueResId.toUpperCase())) {
          nextResNum += 1;
          uniqueResId = `RES-${nextResNum}`;
        }
        setReservationCounter(nextResNum + 1);

        setTables((prev) =>
          prev.map((t) =>
            t.id === chosenTable.id && t.status === TableStatus.Available
              ? {
                  ...t,
                  status: TableStatus.Reserved,
                  occupantName: `${targetGroup.organizerName} (${targetGroup.code})`,
                  timeSlot: 'Immediate Dining (30 mins)',
                  partySize: Math.min(
                    targetGroup.participants.length,
                    t.capacity
                  ),
                  reservationId: uniqueResId,
                  isCurrentUserReservation: true,
                }
              : t
          )
        );
      }
    }

    // Mark group session Confirmed and link token
    setGroupOrders((prev) =>
      prev.map((g) =>
        g.id === targetGroup.id
          ? {
              ...g,
              status: GroupOrderStatus.Confirmed,
              confirmedOrderToken: uniqueGroupToken,
            }
          : g
      )
    );

    setOrders((prev) => [newGroupOrder, ...prev]);
    setSelectedOrderToken(uniqueGroupToken);
    showToast(
      `Group Order ${targetGroup.code} confirmed — Token ${uniqueGroupToken} sent to Staff Dashboard`
    );

    void fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: newGroupOrder }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ok?: boolean; orders?: Order[] } | null) => {
        if (data?.ok && Array.isArray(data.orders)) {
          const synced = data.orders;
          setOrders((prev) => {
            const merged = mergeOrdersPreservingLocalFlags(prev, synced);
            return areOrdersEqual(prev, merged) ? prev : merged;
          });
        }
      })
      .catch(() => {});

    return { ok: true, order: newGroupOrder };
  };

  // =========================================================================
  // STAFF-ONLY MUTATION HANDLERS (Enforced via RBAC Permission Checks)
  // =========================================================================

  const handleUpdateOrderStatus = (
    orderId: string,
    nextStatus: OrderStatus
  ) => {
    if (!can(Permission.UpdateOrderStatus)) {
      showToast('Unauthorized: Staff sign-in required to update order status');
      return;
    }

    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId ? { ...order, status: nextStatus } : order
      )
    );
    const target = orders.find((o) => o.id === orderId);
    if (target) {
      setSelectedOrderToken(target.token);
      showToast(`Token ${target.token} status set to ${nextStatus}`);
    }

    // Persist status update to Cloud Firestore
    try {
      const orderDocRef = doc(db, 'orders', orderId);
      updateDoc(orderDocRef, {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      }).catch((firestoreErr) => {
        // Ignored for purely local demo fixture orders
        console.warn('Firestore order status sync notice:', firestoreErr);
      });
    } catch {
      // Ignore if document not present
    }

    void fetch(`/api/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ok?: boolean; orders?: Order[] } | null) => {
        if (data?.ok && Array.isArray(data.orders)) {
          const synced = data.orders;
          setOrders((prev) => {
            const merged = mergeOrdersPreservingLocalFlags(prev, synced);
            return areOrdersEqual(prev, merged) ? prev : merged;
          });
        }
      })
      .catch(() => {});
  };

  const handleUpdateStock = (menuItemId: string, delta: number) => {
    if (!can(Permission.ManageInventory)) {
      showToast('Unauthorized: Staff sign-in required to manage inventory');
      return;
    }

    setMenuItems((prev) =>
      prev.map((item) => {
        if (item.id !== menuItemId) return item;
        const nextStock = Math.max(0, item.stock + delta);
        return {
          ...item,
          stock: nextStock,
          isAvailable: nextStock > 0 ? true : false,
        };
      })
    );
  };

  const handleToggleItemAvailability = (menuItemId: string) => {
    if (!can(Permission.ManageInventory)) {
      showToast('Unauthorized: Staff sign-in required to manage inventory');
      return;
    }

    setMenuItems((prev) =>
      prev.map((item) => {
        if (item.id !== menuItemId) return item;
        const nextAvail = !item.isAvailable;
        return {
          ...item,
          isAvailable: nextAvail,
          stock: nextAvail && item.stock === 0 ? 15 : item.stock,
        };
      })
    );
  };

  const handleStaffSetTableStatus = (
    tableId: string,
    nextStatus: TableStatus
  ) => {
    if (!can(Permission.ManageTables)) {
      showToast('Unauthorized: Staff sign-in required to manage floor tables');
      return;
    }

    const targetTable = tables.find((t) => t.id === tableId);
    if (!targetTable || targetTable.status === nextStatus) return;

    let staffGeneratedResId: string | undefined;
    if (nextStatus === TableStatus.Reserved && !targetTable.reservationId) {
      let nextResNum = reservationCounter;
      let candidate = `RES-${nextResNum}`;
      const existingResIds = new Set(
        tables
          .map((t) => t.reservationId?.toUpperCase())
          .filter((x): x is string => Boolean(x))
      );
      while (existingResIds.has(candidate.toUpperCase())) {
        nextResNum += 1;
        candidate = `RES-${nextResNum}`;
      }
      staffGeneratedResId = candidate;
      setReservationCounter(nextResNum + 1);
    }

    setTables((prev) =>
      prev.map((t) => {
        if (t.id !== tableId) return t;
        if (nextStatus === TableStatus.Available) {
          return {
            ...t,
            status: TableStatus.Available,
            occupantName: undefined,
            timeSlot: undefined,
            partySize: undefined,
            reservationId: undefined,
            isCurrentUserReservation: false,
          };
        }
        if (nextStatus === TableStatus.Occupied) {
          return {
            ...t,
            status: TableStatus.Occupied,
            occupantName:
              t.status === TableStatus.Reserved && t.occupantName
                ? `${t.occupantName} (Seated)`
                : 'Walk-in Campus Group (Demo)',
            timeSlot: 'Currently Seated',
            partySize: t.partySize ?? t.capacity,
            reservationId: undefined,
            isCurrentUserReservation: false,
          };
        }
        return {
          ...t,
          status: TableStatus.Reserved,
          occupantName: t.occupantName || 'Staff Hold (Demo)',
          timeSlot: t.timeSlot || 'Next Dining Slot (30 mins)',
          partySize: t.partySize ?? t.capacity,
          reservationId: t.reservationId ?? staffGeneratedResId,
          isCurrentUserReservation: false,
        };
      })
    );

    showToast(`${targetTable.label} status updated to ${nextStatus}`);
  };

  const handleResetDemoData = () => {
    if (!can(Permission.ResetDemoData)) {
      showToast('Unauthorized: Supervisor permission required to reset demo');
      return;
    }

    setMenuItems(INITIAL_MENU_ITEMS);
    setOrders(INITIAL_DEMO_ORDERS);
    setTables(INITIAL_DINING_TABLES);
    setGroupOrders(INITIAL_GROUP_ORDERS);
    setSelectedGroupId(INITIAL_GROUP_ORDERS[0]?.id ?? null);
    setCart([]);
    setTokenCounter(106);
    setReservationCounter(301);
    setGroupCodeCounter(4822);
    setSelectedOrderToken(INITIAL_DEMO_ORDERS[0]?.token ?? null);
    showToast(
      'All demo menu, orders, group orders, and tables restored to initial defaults'
    );

    void fetch('/api/orders/reset', {
      method: 'POST',
    }).catch(() => {});
  };

  // Render Separate Staff Panel (Staff Login when logged out, Staff Dashboard when authenticated)
  if (portalMode === PortalMode.Staff) {
    return (
      <RequireStaffAuth
        onLoginSuccess={() => {
          setStaffSection('orders');
          showToast('Signed in to CanteenIQ Staff Dashboard (Demo)');
        }}
        onReturnToStudentSite={() => openStudentTab(ActiveTab.Menu)}
      >
        <div className="min-h-screen flex flex-col bg-white text-slate-900">
          <StaffNavbar
            activeSection={staffSection}
            onSelectSection={setStaffSection}
            onSwitchToStudentSite={() => openStudentTab(ActiveTab.Menu)}
            onLogout={handleStaffLogout}
          />

          <main className="flex-1">
            <StaffDashboard
              orders={orders}
              menuItems={menuItems}
              tables={tables}
              selectedToken={selectedOrderToken}
              activeSection={staffSection}
              onSelectSection={setStaffSection}
              staffDisplayName={staffSession?.displayName ?? 'Canteen Staff'}
              staffId={staffSession?.staffId ?? 'STAFF'}
              staffRoleTitle={staffSession?.roleTitle ?? 'Staff'}
              canResetDemoData={can(Permission.ResetDemoData)}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onViewOrderOnStudentSite={(token) => {
                setSelectedOrderToken(token);
                openStudentTab(ActiveTab.TrackOrder);
              }}
              onUpdateStock={handleUpdateStock}
              onToggleItemAvailability={handleToggleItemAvailability}
              onSetTableStatus={handleStaffSetTableStatus}
              onResetDemoData={handleResetDemoData}
              onLogout={handleStaffLogout}
            />
          </main>

          <Footer
            portalMode={PortalMode.Staff}
            isStaffAuthenticated={isStaffAuthenticated}
            onSelectStudentTab={openStudentTab}
            onOpenStaffPortal={openStaffPortal}
            onSwitchToStudentSite={() => openStudentTab(ActiveTab.Menu)}
          />

          {toastMessage && (
            <div
              role="status"
              aria-live="polite"
              className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-5 sm:max-w-md z-50 px-4 py-3 bg-emerald-950 text-white text-xs sm:text-sm font-medium rounded-xl shadow-lg border border-emerald-800 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="leading-snug">{toastMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                aria-label="Dismiss notification"
                className="p-1 text-emerald-200 hover:text-white rounded-md transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </RequireStaffAuth>
    );
  }

  // Render Student Panel (Zero Staff Dashboard or Staff Management Controls)
  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      <Navbar
        activeTab={activeTab}
        onSelectTab={openStudentTab}
        onOpenStaffPortal={openStaffPortal}
        isStaffAuthenticated={isStaffAuthenticated}
        cartCount={cartSummary.count}
        cartTotal={cartSummary.total}
        onOpenCart={() => setIsCartOpen(true)}
      />

      <main className="flex-1">
        {activeTab === ActiveTab.Menu && (
          <HomeAndMenu
            menuItems={menuItems}
            cart={cart}
            orders={customerOrders}
            tables={tables}
            selectedToken={selectedOrderToken}
            onSelectToken={setSelectedOrderToken}
            onAddToCart={handleAddToCart}
            onUpdateQuantity={handleUpdateCartQuantity}
            onRemoveFromCart={handleRemoveFromCart}
            onNavigateTab={openStudentTab}
            onOpenCart={() => setIsCartOpen(true)}
            onOpenStaffPortal={openStaffPortal}
          />
        )}

        {activeTab === ActiveTab.GroupOrder && (
          <GroupOrderPage
            menuItems={menuItems}
            tables={tables}
            groupOrders={groupOrders}
            selectedGroupId={selectedGroupId}
            onSelectGroup={setSelectedGroupId}
            onCreateGroupOrder={handleCreateGroupOrder}
            onJoinGroupOrderByCode={handleJoinGroupOrderByCode}
            onUpdateParticipantItem={handleUpdateParticipantItem}
            onRemoveParticipant={handleRemoveParticipant}
            onUpdateGroupMetadata={handleUpdateGroupMetadata}
            onConfirmGroupOrder={handleConfirmGroupOrder}
            onTrackOrder={(token) => {
              setSelectedOrderToken(token);
              openStudentTab(ActiveTab.TrackOrder);
            }}
          />
        )}

        {activeTab === ActiveTab.TrackOrder && (
          <OrderTracking
            orders={customerOrders}
            selectedToken={selectedOrderToken}
            onSelectToken={setSelectedOrderToken}
            onNavigateTab={openStudentTab}
            onRefreshOrders={refreshOrders}
          />
        )}

        {activeTab === ActiveTab.Seating && (
          <SeatReservation
            tables={tables}
            onConfirmReservation={handleConfirmReservation}
            onCancelStudentReservation={handleCancelStudentReservation}
          />
        )}

        {activeTab === ActiveTab.Chat && (
          <GemmaChat
            menuItems={menuItems}
            orders={customerOrders}
            tables={tables}
            onAddToCart={handleAddToCart}
            onAddRecommendedBundle={handleAddRecommendedBundle}
            onOpenCart={() => setIsCartOpen(true)}
            onNavigateTab={openStudentTab}
          />
        )}
      </main>

      <Footer
        portalMode={PortalMode.Student}
        isStaffAuthenticated={isStaffAuthenticated}
        onSelectStudentTab={openStudentTab}
        onOpenStaffPortal={openStaffPortal}
        onSwitchToStudentSite={() => openStudentTab(ActiveTab.Menu)}
      />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        menuItems={menuItems}
        tables={tables}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveFromCart}
        onClearCart={handleClearCart}
        onPlaceOrder={handlePlaceOrder}
        onTrackOrder={(token) => {
          setSelectedOrderToken(token);
          openStudentTab(ActiveTab.TrackOrder);
        }}
      />

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-5 sm:max-w-md z-50 px-4 py-3 bg-emerald-950 text-white text-xs sm:text-sm font-medium rounded-xl shadow-lg border border-emerald-800 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="leading-snug">{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            aria-label="Dismiss notification"
            className="p-1 text-emerald-200 hover:text-white rounded-md transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CanteenIQWorkspace />
    </AuthProvider>
  );
}
