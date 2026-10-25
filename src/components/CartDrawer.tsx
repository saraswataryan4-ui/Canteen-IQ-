import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { CartItem, DiningTable, MenuItem, Order, TableStatus } from '../types';
import { ResilientImage } from './ResilientImage';
import { useAuth } from '../auth/AuthContext';
import { CustomerAuthModal } from './CustomerAuthModal';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  menuItems: MenuItem[];
  tables: DiningTable[];
  onUpdateQuantity: (menuItemId: string, delta: number) => void;
  onRemoveItem: (menuItemId: string) => void;
  onClearCart: () => void;
  onPlaceOrder: (payload: {
    studentName: string;
    rollNumber: string;
    customerPhone: string;
    deliveryAddress: string;
    deliveryNotes?: string;
    tableId?: string;
    notes?: string;
  }) => Promise<Order>;
  onTrackOrder: (orderToken: string) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cart,
  menuItems,
  tables,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onPlaceOrder,
  onTrackOrder,
}) => {
  const { user, customer, isAuthenticated, signInWithGoogle } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('Express Pickup Counter');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  // Pre-fill customer name & phone when authenticated
  useEffect(() => {
    if (customer?.name && !customerName) {
      setCustomerName(customer.name);
    } else if (user?.displayName && !customerName) {
      setCustomerName(user.displayName);
    }
    if (customer?.phone && !customerPhone) {
      setCustomerPhone(customer.phone);
    }
  }, [user, customer, customerName, customerPhone]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setConfirmedOrder(null);
        setCheckoutError(null);
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Calculate cart line items using trusted menu prices
  const detailedCart = cart
    .map((c) => {
      const item = menuItems.find((m) => m.id === c.menuItemId);
      return item ? { ...item, quantity: c.quantity } : null;
    })
    .filter((x): x is MenuItem & { quantity: number } => x !== null);

  const subtotal = detailedCart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const estimatedMinutes =
    detailedCart.length > 0
      ? Math.max(...detailedCart.map((i) => i.prepMinutes)) + 2
      : 0;

  const userReservedTables = tables.filter(
    (t) => t.status === TableStatus.Reserved && Boolean(t.isCurrentUserReservation)
  );

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPlacingOrder) return;
    setCheckoutError(null);

    if (!isAuthenticated || (!user && !customer)) {
      setCheckoutError('Please sign in or register an account before placing your order.');
      return;
    }

    if (detailedCart.length === 0) {
      setCheckoutError('Your cart is empty. Please add at least one food item.');
      return;
    }

    const cleanName = customerName.trim();
    const cleanPhone = customerPhone.trim();
    const cleanAddress = deliveryAddress.trim();

    if (!cleanName) {
      setCheckoutError('Please enter your full name for the order.');
      return;
    }

    if (!cleanPhone || cleanPhone.length < 7) {
      setCheckoutError('Please enter a valid contact phone number.');
      return;
    }

    if (!cleanAddress || cleanAddress.length < 3) {
      setCheckoutError('Please specify your delivery location or counter pickup.');
      return;
    }

    const invalidStockItem = detailedCart.find(
      (item) => !item.isAvailable || item.quantity > item.stock || item.quantity <= 0
    );
    if (invalidStockItem) {
      setCheckoutError(
        `${invalidStockItem.name} only has ${invalidStockItem.stock} portions available. Please adjust your quantity.`
      );
      return;
    }

    setIsPlacingOrder(true);
    try {
      const created = await onPlaceOrder({
        studentName: cleanName,
        rollNumber: user?.email
          ? user.email.split('@')[0].toUpperCase()
          : customer?.customerId || 'CUSTOMER',
        customerPhone: cleanPhone,
        deliveryAddress: cleanAddress,
        deliveryNotes: deliveryNotes.trim() || undefined,
        tableId: selectedTableId || undefined,
        notes: deliveryNotes.trim() || undefined,
      });
      setConfirmedOrder(created);
      onClearCart();
      setDeliveryNotes('');
    } catch (err: unknown) {
      console.error('Order submission error:', err);
      setCheckoutError(
        err instanceof Error
          ? err.message
          : 'Unable to save order to Firestore. Please try again.'
      );
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleCloseDrawer = () => {
    setConfirmedOrder(null);
    setCheckoutError(null);
    setIsPlacingOrder(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-drawer-title"
    >
      {/* Backdrop click target */}
      <div className="flex-1" onClick={handleCloseDrawer} />

      <div className="w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between overflow-hidden">
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2
              id="cart-drawer-title"
              className="text-lg font-bold text-slate-950"
            >
              {confirmedOrder ? 'Order Confirmed' : 'Your Food Cart'}
            </h2>
            <p className="text-xs text-slate-500">
              Fresh Campus Dining · Firestore Persistent Ordering
            </p>
          </div>
          <button
            type="button"
            onClick={handleCloseDrawer}
            aria-label="Close cart drawer"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        {confirmedOrder ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="p-6 bg-emerald-50/70 border border-emerald-200 rounded-xl text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-700 mx-auto" />
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                Order Placed in Cloud Firestore
              </p>
              <p className="text-3xl font-bold font-mono tabular-nums text-emerald-950 tracking-tight">
                {confirmedOrder.token}
              </p>
              <p className="text-xs font-mono text-slate-500 break-all">
                Order ID: {confirmedOrder.id}
              </p>
              <p className="text-sm text-slate-600">
                Status:{' '}
                <span className="font-semibold text-emerald-800">
                  {confirmedOrder.status}
                </span>{' '}
                · Estimated prep time: ~{confirmedOrder.estimatedMinutes} mins
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 space-y-3 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Customer</span>
                <span className="font-medium text-slate-900">
                  {confirmedOrder.studentName}
                </span>
              </div>
              {confirmedOrder.customerPhone && (
                <div className="flex justify-between text-slate-600">
                  <span>Phone</span>
                  <span className="font-mono text-slate-900">
                    {confirmedOrder.customerPhone}
                  </span>
                </div>
              )}
              {confirmedOrder.deliveryAddress && (
                <div className="flex justify-between text-slate-600">
                  <span>Delivery Address</span>
                  <span className="font-medium text-slate-900 text-right max-w-[200px]">
                    {confirmedOrder.deliveryAddress}
                  </span>
                </div>
              )}

              <div className="border-t border-slate-200 pt-3 space-y-2">
                {confirmedOrder.items.map((line) => (
                  <div
                    key={line.menuItemId}
                    className="flex justify-between text-slate-700 tabular-nums"
                  >
                    <span>
                      {line.quantity} × {line.name}
                    </span>
                    <span className="font-mono font-medium">
                      ₹{line.unitPrice * line.quantity}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-200 pt-3 flex justify-between text-base font-bold text-slate-950 tabular-nums">
                <span>Total Amount Paid</span>
                <span className="font-mono text-emerald-800">
                  ₹{confirmedOrder.totalAmount}
                </span>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  const token = confirmedOrder.token;
                  setConfirmedOrder(null);
                  onClose();
                  onTrackOrder(token);
                }}
                className="w-full py-3 px-4 inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
              >
                <span>View in My Orders</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : detailedCart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-slate-900">
                Your food cart is empty
              </p>
              <p className="text-sm text-slate-500 max-w-xs">
                Browse our delicious canteen menu to add fresh snacks, hot meals,
                and beverages.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCloseDrawer}
              className="px-4 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
            >
              Browse Public Menu
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleCheckoutSubmit}
            className="flex-1 flex flex-col justify-between overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Itemized Cart List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">
                    Selected Food Items ({detailedCart.length})
                  </span>
                  <button
                    type="button"
                    onClick={onClearCart}
                    className="text-xs font-medium text-red-600 hover:text-red-800 cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>

                <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white">
                  {detailedCart.map((item) => (
                    <div key={item.id} className="p-3.5 flex items-center gap-3.5">
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-stone-100 shrink-0 border border-slate-100">
                        <ResilientImage
                          src={item.imageUrl}
                          alt={item.name}
                          fallbackTitle={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-slate-500 font-mono tabular-nums">
                          ₹{item.price} each · Subtotal ₹
                          {item.price * item.quantity}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden">
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(item.id, -1)}
                            aria-label={`Decrease ${item.name}`}
                            className="p-1.5 text-slate-700 hover:bg-slate-100 cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2 text-xs font-bold font-mono tabular-nums text-slate-900">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={item.quantity >= item.stock}
                            onClick={() => onUpdateQuantity(item.id, 1)}
                            aria-label={`Increase ${item.name}`}
                            className="p-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.id)}
                          aria-label={`Remove ${item.name}`}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Authentication Gate or Customer Checkout Fields */}
              {!isAuthenticated || (!user && !customer) ? (
                <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 space-y-3 text-center">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-emerald-950">
                      Sign In to Complete Checkout
                    </p>
                    <p className="text-xs text-slate-600">
                      Sign in with Google or your email address to place your order and track it in real time.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void signInWithGoogle()}
                      className="py-2.5 px-3 inline-flex items-center justify-center gap-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span>Google Login</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAuthModalOpen(true)}
                      className="py-2.5 px-3 inline-flex items-center justify-center gap-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
                    >
                      <span>Email Sign In / Register</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pt-2 border-t border-slate-200">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-2 rounded-lg">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    <span>
                      Ordering as{' '}
                      <strong>
                        {customer?.name || user?.displayName || customer?.email || user?.email}
                      </strong>
                      {customer?.customerId && (
                        <span className="ml-1 font-mono text-[10px] bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded">
                          {customer.customerId}
                        </span>
                      )}
                    </span>
                  </div>

                  <div>
                    <label
                      htmlFor="customer-name-input"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Customer Full Name *
                    </label>
                    <input
                      id="customer-name-input"
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Aryan Saraswat"
                      className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="customer-phone-input"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Contact Phone Number *
                    </label>
                    <input
                      id="customer-phone-input"
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="e.g. +91 98765 43210"
                      className="w-full px-3.5 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="delivery-address-input"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Delivery Address / Location *
                    </label>
                    <input
                      id="delivery-address-input"
                      type="text"
                      required
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="e.g. Hostel Block B, Room 304 OR Express Counter"
                      className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="delivery-notes-input"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Delivery Instructions / Dietary Notes (Optional)
                    </label>
                    <input
                      id="delivery-notes-input"
                      type="text"
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      placeholder="e.g. Extra chutney, deliver before 1:30 PM"
                      className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  {userReservedTables.length > 0 && (
                    <div>
                      <label
                        htmlFor="table-pickup-select"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        Link to Reserved Table (Optional)
                      </label>
                      <select
                        id="table-pickup-select"
                        value={selectedTableId}
                        onChange={(e) => setSelectedTableId(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-600"
                      >
                        <option value="">Express Counter Pickup</option>
                        {userReservedTables.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label} ({t.zone})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {checkoutError && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 text-xs font-medium text-red-800"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                  <span>{checkoutError}</span>
                </div>
              )}
            </div>

            {/* Drawer Footer Checkout CTA */}
            <div className="p-6 border-t border-slate-200 bg-slate-50/70 space-y-3 shrink-0">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-mono tabular-nums text-slate-900">
                  ₹{subtotal}
                </span>
              </div>
              <div className="flex items-center justify-between text-base font-bold text-slate-950">
                <span>Total Amount</span>
                <span className="font-mono text-emerald-800 text-lg tabular-nums">
                  ₹{subtotal}
                </span>
              </div>

              {isAuthenticated && (user || customer) ? (
                <button
                  type="submit"
                  disabled={isPlacingOrder || detailedCart.length === 0}
                  className="w-full py-3 px-4 inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
                >
                  {isPlacingOrder ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Order to Firestore...</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      <span>Place Order (₹{subtotal})</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setIsAuthModalOpen(true)}
                    className="w-full py-3 px-4 inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer shadow-sm"
                  >
                    <span>Sign In to Place Order</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <p className="text-center text-xs text-slate-500">
                    Sign in with Google or Email OTP to complete your checkout
                  </p>
                </div>
              )}
            </div>
          </form>
        )}
      </div>

      <CustomerAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
};
