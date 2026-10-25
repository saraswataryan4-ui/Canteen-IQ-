import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChefHat,
  Clock,
  LogIn,
  PackageCheck,
  Receipt,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  Truck,
  UserCheck,
} from 'lucide-react';
import { ActiveTab, Order, OrderStatus } from '../types';
import { useAuth } from '../auth/AuthContext';
import { CustomerAuthModal } from './CustomerAuthModal';

export const ORDERED_STATUS_STEPS: {
  status: OrderStatus;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    status: OrderStatus.Received,
    label: 'Received',
    description: 'Order confirmed and sent to canteen kitchen',
    icon: Receipt,
  },
  {
    status: OrderStatus.Preparing,
    label: 'Preparing',
    description: 'Fresh ingredients being prepared by chefs',
    icon: ChefHat,
  },
  {
    status: OrderStatus.Ready,
    label: 'Ready',
    description: 'Hot and ready for counter pickup or delivery',
    icon: Sparkles,
  },
  {
    status: OrderStatus.Collected,
    label: 'Dispatched / Out',
    description: 'Picked up from counter or out with delivery runner',
    icon: PackageCheck,
  },
  {
    status: OrderStatus.Delivered,
    label: 'Delivered',
    description: 'Order completed and delivered to customer',
    icon: Check,
  },
];

interface StudentOrderTrackerCardProps {
  order: Order;
  lastUpdatedTime?: string | null;
}

export const StudentOrderTrackerCard: React.FC<StudentOrderTrackerCardProps> = ({
  order,
  lastUpdatedTime,
}) => {
  const currentStepIndex = ORDERED_STATUS_STEPS.findIndex(
    (s) => s.status === order.status
  );

  return (
    <div className="border border-slate-200 rounded-xl bg-white p-6 sm:p-8 space-y-8 shadow-xs">
      {/* Top Summary: Token + Current Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>Order Token · Placed at {order.createdAt}</span>
            {order.id && (
              <span className="font-mono text-[11px] text-slate-400">
                · ID: {order.id}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-baseline gap-3">
            <h3 className="text-3xl font-bold font-mono tabular-nums text-slate-950">
              {order.token}
            </h3>
            <span
              aria-live="polite"
              className={`text-sm font-semibold px-2.5 py-0.5 rounded-full ${
                order.status === OrderStatus.Delivered ||
                order.status === OrderStatus.Collected
                  ? 'bg-slate-100 text-slate-800'
                  : order.status === OrderStatus.Ready
                  ? 'bg-emerald-100 text-emerald-800 font-bold'
                  : order.status === OrderStatus.Preparing
                  ? 'bg-amber-100 text-amber-900 font-bold'
                  : 'bg-blue-50 text-blue-900'
              }`}
            >
              Status: {order.status}
            </span>
          </div>

          <p className="text-sm text-slate-600">
            Customer: <span className="font-medium text-slate-900">{order.studentName}</span>
            {order.customerPhone ? ` · 📞 ${order.customerPhone}` : ''}
          </p>

          {order.deliveryAddress && (
            <p className="text-xs text-slate-600 flex items-center gap-1.5 mt-1">
              <Truck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>Location: <strong className="text-slate-800">{order.deliveryAddress}</strong></span>
            </p>
          )}
        </div>

        <div className="flex flex-col sm:items-end gap-1 shrink-0 text-xs font-medium text-slate-600">
          {order.status === OrderStatus.Delivered ||
          order.status === OrderStatus.Collected ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
              <Check className="w-4 h-4 text-emerald-700" />
              <span>Order Fulfilled</span>
            </span>
          ) : (
            <span className="text-emerald-800 font-semibold">Active Kitchen Order</span>
          )}
          {lastUpdatedTime && (
            <span className="text-[11px] font-mono tabular-nums text-slate-400">
              Synced: {lastUpdatedTime}
            </span>
          )}
        </div>
      </div>

      {/* 5 Ordered Status Stages: Received -> Preparing -> Ready -> Dispatched -> Delivered */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>Order Progression Pipeline</span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock className="w-3.5 h-3.5 text-emerald-700" />
            {order.status === OrderStatus.Delivered ||
            order.status === OrderStatus.Collected
              ? 'Completed & Delivered'
              : order.status === OrderStatus.Ready
              ? 'Ready now for collection / delivery'
              : `Est. prep: ~${order.estimatedMinutes} mins`}
          </span>
        </div>

        <ol className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {ORDERED_STATUS_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;

            return (
              <li
                key={step.status}
                aria-current={isCurrent ? 'step' : undefined}
                className={`p-3.5 rounded-xl border transition-colors ${
                  isCurrent
                    ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                    : isCompleted
                    ? 'border-emerald-200 bg-white'
                    : 'border-slate-200 bg-slate-50/60 opacity-75'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-mono tabular-nums text-slate-500">
                    0{index + 1}
                  </span>
                  {isCompleted ? (
                    <Check className="w-4 h-4 text-emerald-700" />
                  ) : (
                    <Icon
                      className={`w-4 h-4 ${
                        isCurrent ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    />
                  )}
                </div>
                <p
                  className={`text-xs sm:text-sm font-bold ${
                    isCurrent
                      ? 'text-emerald-950'
                      : isCompleted
                      ? 'text-slate-900'
                      : 'text-slate-500'
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                  {step.description}
                </p>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Ordered Items & Total Price */}
      <div className="pt-6 border-t border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900">Ordered Food Items</h4>
          <span className="text-xs text-slate-500 tabular-nums">
            {order.items.reduce((sum, i) => sum + i.quantity, 0)} total items
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {order.items.map((item) => (
            <div
              key={item.menuItemId}
              className="py-2.5 flex items-center justify-between text-sm tabular-nums"
            >
              <div className="text-slate-800">
                <span className="font-mono font-semibold text-emerald-800 mr-2">
                  {item.quantity}×
                </span>
                <span className="font-medium">{item.name}</span>
                <span className="text-xs text-slate-400 ml-2 font-mono">
                  (₹{item.unitPrice} each)
                </span>
              </div>
              <span className="font-mono font-semibold text-slate-900">
                ₹{item.unitPrice * item.quantity}
              </span>
            </div>
          ))}
        </div>

        {order.notes && (
          <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
            Instructions / Notes: {order.notes}
          </p>
        )}

        <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-base font-bold text-slate-950 tabular-nums">
          <span>Total Paid</span>
          <span className="font-mono text-emerald-800 text-lg">
            ₹{order.totalAmount}
          </span>
        </div>
      </div>
    </div>
  );
};

export interface OrderRefreshResult {
  ok: boolean;
  error?: string;
}

interface OrderTrackingProps {
  orders: Order[];
  selectedToken: string | null;
  onSelectToken: (token: string) => void;
  onNavigateTab: (tab: ActiveTab) => void;
  onRefreshOrders: (signal?: AbortSignal) => Promise<OrderRefreshResult>;
}

export const OrderTracking: React.FC<OrderTrackingProps> = ({
  orders,
  selectedToken,
  onSelectToken,
  onNavigateTab,
  onRefreshOrders,
}) => {
  const { user, customer, isAuthenticated, signInWithGoogle } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [tokenSearch, setTokenSearch] = useState('');
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await onRefreshOrders();
      if (res.ok) {
        setLastUpdatedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        setFetchError(null);
      }
    } catch {
      // Ignore
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredOrders = useMemo(() => {
    const q = tokenSearch.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.token.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        o.studentName.toLowerCase().includes(q) ||
        (o.deliveryAddress && o.deliveryAddress.toLowerCase().includes(q))
    );
  }, [orders, tokenSearch]);

  const activeOrder = useMemo(() => {
    if (selectedToken) {
      const exact = filteredOrders.find(
        (o) => o.token.toLowerCase() === selectedToken.toLowerCase() || o.id === selectedToken
      );
      if (exact) return exact;
    }
    return filteredOrders[0] ?? null;
  }, [filteredOrders, selectedToken]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-emerald-700">
            Real-Time Campus Orders Tracker
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
            My Orders &amp; Food Tracking
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            Track your meal preparation from Received to Delivered in real-time.
            Orders are private and linked to your authenticated customer account.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleManualRefresh}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-emerald-700 shrink-0 ${
                isRefreshing ? 'animate-spin' : ''
              }`}
            />
            <span>Refresh Status</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab(ActiveTab.Menu)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Order Food</span>
          </button>
        </div>
      </div>

      {/* Guest Authentication Prompt */}
      {!isAuthenticated && (
        <div className="p-6 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-emerald-950">
              Sign In to View Your Order History
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-xl">
              Orders placed with your customer account are private and update in real time as the canteen prepares and delivers your meal.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsAuthModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-xs cursor-pointer whitespace-nowrap shrink-0"
          >
            <LogIn className="w-4 h-4 text-emerald-700" />
            <span>Sign In / Register</span>
          </button>
        </div>
      )}

      {/* Authenticated user indicator */}
      {isAuthenticated && (user || customer) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 gap-2">
          <div className="flex items-center gap-2 font-medium">
            <UserCheck className="w-4 h-4 text-emerald-700" />
            <span>
              Signed in as <strong className="text-slate-900">{customer?.name || user?.displayName || customer?.email || user?.email}</strong>
              {customer?.customerId && (
                <span className="font-mono text-emerald-800 ml-1.5 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                  {customer.customerId}
                </span>
              )} · Viewing your private orders
            </span>
          </div>
          <span className="font-mono text-emerald-800 font-bold">
            {orders.length} {orders.length === 1 ? 'order' : 'orders'} found
          </span>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={tokenSearch}
            onChange={(e) => setTokenSearch(e.target.value)}
            placeholder="Search by order token (e.g. CIQ-106) or order ID..."
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-600"
          />
        </div>
      </div>

      {fetchError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* Active Order Spotlight Tracker */}
      {activeOrder ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-950">
              Active Order Tracker
            </h2>
            <span className="text-xs text-slate-500 font-mono">
              Token {activeOrder.token}
            </span>
          </div>

          <StudentOrderTrackerCard
            order={activeOrder}
            lastUpdatedTime={lastUpdatedTime}
          />
        </div>
      ) : (
        <div className="border border-slate-200 rounded-2xl bg-white p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-base font-bold text-slate-900">
              No orders found
            </h3>
            <p className="text-xs text-slate-500">
              {isAuthenticated
                ? "You haven't placed any orders yet. Head to our public menu to choose delicious dishes!"
                : "You don't have any active orders right now. Sign in or browse the menu to order."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab(ActiveTab.Menu)}
            className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors cursor-pointer"
          >
            Browse Public Food Menu
          </button>
        </div>
      )}

      {/* All Orders List */}
      {filteredOrders.length > 1 && (
        <div className="space-y-4 pt-6 border-t border-slate-200">
          <h3 className="text-base font-bold text-slate-950">
            Order History ({filteredOrders.length})
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.map((ord) => (
              <div
                key={ord.id}
                onClick={() => onSelectToken(ord.token)}
                className={`p-4 rounded-xl border text-left cursor-pointer transition-all space-y-3 ${
                  activeOrder?.id === ord.id
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-950">
                    {ord.token}
                  </span>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      ord.status === OrderStatus.Ready
                        ? 'bg-emerald-100 text-emerald-800'
                        : ord.status === OrderStatus.Preparing
                        ? 'bg-amber-100 text-amber-900'
                        : ord.status === OrderStatus.Delivered ||
                          ord.status === OrderStatus.Collected
                        ? 'bg-slate-100 text-slate-700'
                        : 'bg-blue-50 text-blue-900'
                    }`}
                  >
                    {ord.status}
                  </span>
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  <p>Placed at: {ord.createdAt}</p>
                  <p className="truncate">
                    {ord.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs font-bold text-slate-900">
                  <span>Total Amount</span>
                  <span className="font-mono text-emerald-800">
                    ₹{ord.totalAmount}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <CustomerAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
};
