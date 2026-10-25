import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Clock,
  Minus,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  ActiveTab,
  CartItem,
  DiningTable,
  FoodCategory,
  MenuItem,
  Order,
  OrderStatus,
  TableStatus,
} from '../types';
import { HERO_IMAGE_URL } from '../data/demoData';
import { ResilientImage } from './ResilientImage';
import { StudentOrderTrackerCard } from './OrderTracking';
import { AboutSection } from './AboutSection';

interface HomeAndMenuProps {
  menuItems: MenuItem[];
  cart: CartItem[];
  orders: Order[];
  tables: DiningTable[];
  selectedToken: string | null;
  onSelectToken: (token: string) => void;
  onAddToCart: (menuItemId: string) => void;
  onUpdateQuantity: (menuItemId: string, delta: number) => void;
  onRemoveFromCart: (menuItemId: string) => void;
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenStaffPortal: () => void;
  onOpenCart: () => void;
}

const CATEGORIES: FoodCategory[] = [
  FoodCategory.All,
  FoodCategory.Snacks,
  FoodCategory.Sandwiches,
  FoodCategory.SouthIndian,
  FoodCategory.Beverages,
];

type SortOption = 'featured' | 'price-asc' | 'price-desc' | 'prep-asc';

export const HomeAndMenu: React.FC<HomeAndMenuProps> = ({
  menuItems,
  cart,
  orders,
  tables,
  selectedToken,
  onSelectToken,
  onAddToCart,
  onUpdateQuantity,
  onRemoveFromCart,
  onNavigateTab,
  onOpenStaffPortal,
  onOpenCart,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FoodCategory>(
    FoodCategory.All
  );
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const menuSectionRef = useRef<HTMLElement>(null);
  const trackingSectionRef = useRef<HTMLElement>(null);

  const activeQueueCount = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status === OrderStatus.Received || o.status === OrderStatus.Preparing
      ).length,
    [orders]
  );

  const readyOrdersCount = useMemo(
    () => orders.filter((o) => o.status === OrderStatus.Ready).length,
    [orders]
  );

  const availableSeatsCount = useMemo(
    () =>
      tables
        .filter((t) => t.status === TableStatus.Available)
        .reduce((acc, t) => acc + t.capacity, 0),
    [tables]
  );

  const availableMenuCount = useMemo(
    () => menuItems.filter((item) => item.isAvailable && item.stock > 0).length,
    [menuItems]
  );

  const trackedOrder = useMemo(() => {
    if (selectedToken) {
      const found = orders.find(
        (o) => o.token.toLowerCase() === selectedToken.toLowerCase()
      );
      if (found) return found;
    }
    return orders[0] ?? null;
  }, [orders, selectedToken]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = menuItems.filter((item) => {
      const matchesCategory =
        selectedCategory === FoodCategory.All ||
        item.category === selectedCategory;
      const matchesQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });

    if (sortBy === 'price-asc') {
      return [...list].sort((a, b) => a.price - b.price);
    }
    if (sortBy === 'price-desc') {
      return [...list].sort((a, b) => b.price - a.price);
    }
    if (sortBy === 'prep-asc') {
      return [...list].sort((a, b) => a.prepMinutes - b.prepMinutes);
    }
    return list;
  }, [menuItems, searchQuery, selectedCategory, sortBy]);

  const getCartQuantity = (menuItemId: string) =>
    cart.find((c) => c.menuItemId === menuItemId)?.quantity ?? 0;

  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalCartValue = cart.reduce((sum, item) => {
    const found = menuItems.find((m) => m.id === item.menuItemId);
    return sum + (found ? found.price * item.quantity : 0);
  }, 0);

  const scrollToMenu = () => {
    menuSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToTracking = () => {
    trackingSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToAbout = () => {
    document
      .getElementById('about-canteeniq')
      ?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="space-y-16 pb-20">
      {/* Section 1: Balanced 2-Column Campus Hero + Full-Width Campus Metrics Strip */}
      <section className="bg-slate-50/70 border-b border-slate-200/80 pt-8 pb-12 sm:pt-12 sm:pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            {/* Left Editorial Column */}
            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <p className="text-xs font-medium text-emerald-800 tracking-normal">
                Campus Dining Platform · Smart Canteen Operations
              </p>

              <h1
                className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-950 leading-[1.12]"
                style={{ textWrap: 'balance' }}
              >
                Your Campus Canteen, Made Smarter.
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                Skip between-lecture queues with pre-ordered campus meals, instant
                order tokens, order status tracking, and table reservations
                across the student commons.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={scrollToMenu}
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Order from Menu</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onNavigateTab(ActiveTab.GroupOrder)}
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Group Order</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigateTab(ActiveTab.Seating)}
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Reserve a Table</span>
                </button>

                <button
                  type="button"
                  onClick={scrollToTracking}
                  className="inline-flex items-center gap-1.5 px-3 py-3 text-sm font-medium text-emerald-800 hover:text-emerald-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Order Tracking</span>
                </button>

                <button
                  type="button"
                  onClick={scrollToAbout}
                  className="inline-flex items-center gap-1.5 px-3 py-3 text-sm font-medium text-slate-600 hover:text-slate-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>About CanteenIQ</span>
                </button>
              </div>

              <p className="text-xs text-slate-500 pt-1 leading-relaxed">
                Freshly prepared meals with transparent pricing (₹), live kitchen queue tracking, and express counter pickup across campus.
              </p>
            </div>

            {/* Right Architectural Hero Image */}
            <div className="lg:col-span-6">
              <div className="relative h-64 sm:h-80 lg:h-full min-h-[280px] rounded-2xl overflow-hidden border border-slate-200 bg-stone-100">
                <ResilientImage
                  src={HERO_IMAGE_URL}
                  alt="Modern sunlit college campus smart canteen counter with students ordering fresh meals"
                  fallbackTitle="CanteenIQ Smart Campus Commons"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-5 sm:p-6 text-white">
                  <p className="text-xs text-emerald-200 font-medium">
                    Main Academic Block · Ground Floor Commons
                  </p>
                  <p className="text-sm sm:text-base font-semibold mt-0.5">
                    Express Counter Pickup &amp; Study Booth Dining · 8:00 AM – 8:00 PM
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Full-Width 4-Column Campus Metrics Strip */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>Campus Canteen Snapshot · Live Operations Analytics</span>
              <span>Real-time kitchen &amp; dining state</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-white p-4 sm:p-5">
                <p className="text-xs text-slate-500">Live Order Queue</p>
                <p className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 font-mono tabular-nums">
                  {activeQueueCount} {activeQueueCount === 1 ? 'Order' : 'Orders'}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {readyOrdersCount} ready at pickup counter
                </p>
              </div>

              <div className="bg-white p-4 sm:p-5">
                <p className="text-xs text-slate-500">
                  Table Availability
                </p>
                <p className="mt-1 text-xl sm:text-2xl font-bold text-emerald-700 font-mono tabular-nums">
                  {availableSeatsCount} Seats
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Across{' '}
                  {tables.filter((t) => t.status === TableStatus.Available).length}{' '}
                  of {tables.length} dining tables
                </p>
              </div>

              <div className="bg-white p-4 sm:p-5">
                <p className="text-xs text-slate-500">Menu Dishes</p>
                <p className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 font-mono tabular-nums">
                  {availableMenuCount} / {menuItems.length} Available
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Student pricing ₹20 – ₹50
                </p>
              </div>

              <div className="bg-white p-4 sm:p-5 flex flex-col justify-between">
                <div>
                  <p className="text-xs text-slate-500">
                    Menu-Grounded AI Assistant
                  </p>
                  <p className="mt-1 text-base sm:text-lg font-bold text-slate-900">
                    EN · Hindi · Hinglish
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab(ActiveTab.Chat)}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 cursor-pointer w-fit"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ask for budget combos</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Canteen Menu & Interactive Filters */}
      <section
        ref={menuSectionRef}
        id="canteen-menu"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-emerald-700">
              Canteen Menu · Student Pricing (₹)
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Freshly Prepared Campus Favorites
            </h2>
            <p className="text-sm text-slate-600">
              Add items to your cart, adjust quantities, and complete checkout
              to receive a unique order token.
            </p>
          </div>

          {totalCartItems > 0 && (
            <button
              type="button"
              onClick={onOpenCart}
              className="inline-flex items-center justify-between sm:justify-start gap-3 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span className="tabular-nums">
                {totalCartItems} {totalCartItems === 1 ? 'item' : 'items'} selected · ₹
                {totalCartValue}
              </span>
              <span className="text-emerald-700 underline underline-offset-2">
                Proceed to Checkout
              </span>
            </button>
          )}
        </div>

        {/* Search, Category Filter Bar & Sort */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Segmented Category Filter Controls */}
          <div
            role="tablist"
            aria-label="Food Categories"
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto"
          >
            {CATEGORIES.map((category) => {
              const active = selectedCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-emerald-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>

          {/* Search Input & Sort Selector */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search samosa, dosa, coffee..."
                aria-label="Search menu items"
                className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="relative flex items-center">
              <SlidersHorizontal className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Sort menu items"
                className="w-full sm:w-auto pl-9 pr-8 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-emerald-600 cursor-pointer"
              >
                <option value="featured">Sort: Featured</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="prep-asc">Fastest Prep Time</option>
              </select>
            </div>
          </div>
        </div>

        {/* Food Cards Grid */}
        {filteredItems.length === 0 ? (
          <div className="py-16 px-6 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <p className="text-base font-semibold text-slate-900">
              No menu items match "{searchQuery}"
            </p>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Try clearing your search filter or switching back to all food
              categories.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory(FoodCategory.All);
              }}
              className="inline-flex items-center px-4 py-2 text-sm font-semibold text-emerald-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredItems.map((item) => {
              const qty = getCartQuantity(item.id);
              const outOfStock = !item.isAvailable || item.stock <= 0;
              const maxStockReached = qty >= item.stock;

              return (
                <article
                  key={item.id}
                  className="group flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden transition-transform duration-150 hover:-translate-y-0.5 hover:border-emerald-300"
                >
                  {/* 4:3 Culinary Photography */}
                  <div className="aspect-[4/3] w-full bg-stone-100 overflow-hidden border-b border-slate-100">
                    <ResilientImage
                      src={item.imageUrl}
                      alt={`${item.name} — ${item.description}`}
                      fallbackTitle={item.name}
                      className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03] ${
                        outOfStock ? 'grayscale opacity-70' : ''
                      }`}
                    />
                  </div>

                  {/* Card Details */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-5">
                    <div className="space-y-2">
                      {/* Clean Unboxed Metadata */}
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span>
                          {item.category} · {item.dietaryNote}
                        </span>
                        <span className="inline-flex items-center gap-1 tabular-nums shrink-0">
                          <Clock className="w-3 h-3 text-emerald-700" />
                          {item.prepMinutes}m
                        </span>
                      </div>

                      {/* Title & Price */}
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="text-lg font-bold text-slate-950 tracking-tight">
                          {item.name}
                        </h3>
                        <span className="text-lg font-bold text-emerald-800 font-mono tabular-nums shrink-0">
                          ₹{item.price}
                        </span>
                      </div>

                      <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
                        {item.description}
                      </p>
                    </div>

                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between text-xs text-slate-500 tabular-nums">
                        <span>{item.calories} kcal</span>
                        <span
                          className={
                            outOfStock
                              ? 'text-red-700 font-semibold'
                              : item.stock <= 8
                              ? 'text-amber-700 font-medium'
                              : 'text-emerald-700 font-medium'
                          }
                        >
                          {outOfStock
                            ? 'Unavailable (0 left)'
                            : `${item.stock} portions in stock`}
                        </span>
                      </div>

                      {outOfStock ? (
                        <button
                          type="button"
                          disabled
                          className="w-full py-2.5 px-4 text-sm font-semibold text-slate-400 bg-slate-100 rounded-lg cursor-not-allowed whitespace-nowrap"
                        >
                          Currently Unavailable
                        </button>
                      ) : qty === 0 ? (
                        <button
                          type="button"
                          onClick={() => onAddToCart(item.id)}
                          className="w-full py-2.5 px-4 inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] rounded-lg transition-all whitespace-nowrap cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add to Cart · ₹{item.price}</span>
                        </button>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center border border-emerald-600 rounded-lg bg-emerald-50/60 overflow-hidden flex-1 justify-between">
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(item.id, -1)}
                              aria-label={`Decrease quantity of ${item.name}`}
                              className="p-2.5 text-emerald-900 hover:bg-emerald-100 transition-colors cursor-pointer"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="text-sm font-bold text-emerald-950 font-mono tabular-nums px-2">
                              {qty} in cart
                            </span>
                            <button
                              type="button"
                              disabled={maxStockReached}
                              onClick={() => onUpdateQuantity(item.id, 1)}
                              aria-label={`Increase quantity of ${item.name}`}
                              className="p-2.5 text-emerald-900 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => onRemoveFromCart(item.id)}
                            aria-label={`Remove ${item.name} from cart`}
                            title="Remove item"
                            className="p-2.5 text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 3: Student Website Order Tracking Section */}
      <section
        ref={trackingSectionRef}
        id="student-order-tracking"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-emerald-700">
              Order Tracking · Live Canteen Queue
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Track Your Order Token
            </h2>
            <p className="text-sm text-slate-600 max-w-2xl">
              After checkout, your unique order token starts at{' '}
              <span className="font-semibold text-slate-900">Received</span> and
              advances across Preparing, Ready, and Delivered. Open{' '}
              <span className="font-semibold text-slate-900">My Orders</span>{' '}
              for automatic status updates while tracking.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {orders.length > 1 && (
              <div className="flex items-center gap-2">
                <label
                  htmlFor="home-token-select"
                  className="text-xs font-medium text-slate-600 whitespace-nowrap"
                >
                  Select Token:
                </label>
                <select
                  id="home-token-select"
                  value={trackedOrder?.token ?? ''}
                  onChange={(e) => onSelectToken(e.target.value)}
                  className="px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-600 cursor-pointer"
                >
                  {orders.map((ord) => (
                    <option key={ord.id} value={ord.token}>
                      {ord.token} — {ord.status} (₹{ord.totalAmount})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => onNavigateTab(ActiveTab.TrackOrder)}
              className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Open Live Tracker ({orders.length})
            </button>
          </div>
        </div>

        {trackedOrder ? (
          <StudentOrderTrackerCard order={trackedOrder} />
        ) : (
          <div className="p-10 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <p className="text-base font-semibold text-slate-900">
              No orders placed yet
            </p>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Add items from the menu above and complete checkout to
              generate your pickup token.
            </p>
            <button
              type="button"
              onClick={scrollToMenu}
              className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
            >
              Browse Menu
            </button>
          </div>
        )}
      </section>

      {/* Section 4: About CanteenIQ — Benefits for Students & Staff + Architecture Transparency */}
      <AboutSection
        onNavigateTab={onNavigateTab}
        onOpenStaffPortal={onOpenStaffPortal}
      />
    </div>
  );
};
