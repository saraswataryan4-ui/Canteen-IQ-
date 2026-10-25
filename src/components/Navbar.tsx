import React, { useState } from 'react';
import { Lock, LogOut, Menu, Shield, ShoppingBag, User as UserIcon, X } from 'lucide-react';
import { ActiveTab } from '../types';
import { useAuth } from '../auth/AuthContext';
import { CustomerAuthModal } from './CustomerAuthModal';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenStaffPortal: () => void;
  isStaffAuthenticated: boolean;
  cartCount: number;
  cartTotal: number;
  onOpenCart: () => void;
}

const STUDENT_NAV_LINKS: { id: ActiveTab; label: string }[] = [
  { id: ActiveTab.Menu, label: 'Menu' },
  { id: ActiveTab.TrackOrder, label: 'My Orders' },
  { id: ActiveTab.GroupOrder, label: 'Group Order' },
  { id: ActiveTab.Seating, label: 'Seating' },
  { id: ActiveTab.Chat, label: 'AI Assistant' },
];

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onOpenStaffPortal,
  cartCount,
  cartTotal,
  onOpenCart,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCustomerAuthOpen, setIsCustomerAuthOpen] = useState(false);
  const { user, customer, isAuthenticated, isAdmin, signInWithGoogle, signOutUser, authLoading } =
    useAuth();


  const handleNavClick = (tab: ActiveTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 sm:gap-6">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => handleNavClick(ActiveTab.Menu)}
          className="text-xl font-bold tracking-tight text-emerald-950 hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600 cursor-pointer"
        >
          CanteenIQ
        </button>

        {/* Zone 2: Concise single-line navigation + Admin access */}
        <nav
          aria-label="Public Navigation"
          className="hidden lg:flex items-center gap-6 text-sm font-medium"
        >
          {STUDENT_NAV_LINKS.map((link) => {
            const isActive = activeTab === link.id;
            return (
              <button
                key={link.id}
                type="button"
                onClick={() => handleNavClick(link.id)}
                className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                  isActive
                    ? 'border-emerald-600 text-emerald-800 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {link.label}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenStaffPortal();
            }}
            className="py-5 border-b-2 border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Staff Login</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenStaffPortal();
            }}
            className={`py-5 border-b-2 border-transparent transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
              isAdmin
                ? 'text-emerald-700 font-semibold hover:text-emerald-900'
                : 'text-slate-500 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            {isAdmin && <Shield className="w-3.5 h-3.5 text-emerald-600" />}
            <span>{isAdmin ? 'Admin Dashboard' : 'Admin Login'}</span>
          </button>
        </nav>

        {/* Zone 3: User Auth Profile + Cart Action (+ Mobile Menu Button) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Auth Status / Actions */}
          {!authLoading && (
            <>
              {isAuthenticated && (user || customer) ? (
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                    {user?.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'User profile'}
                        className="w-5 h-5 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px]">
                        {((customer?.name || user?.displayName || customer?.email || user?.email || 'U')[0]).toUpperCase()}
                      </div>
                    )}
                    <span className="font-medium text-slate-800 max-w-[120px] truncate">
                      {customer?.name?.split(' ')[0] || user?.displayName?.split(' ')[0] || customer?.email?.split('@')[0] || user?.email?.split('@')[0]}
                    </span>
                    {customer?.customerId && (
                      <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-200">
                        {customer.customerId}
                      </span>
                    )}
                    {isAdmin && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 uppercase">
                        Admin
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => void signOutUser()}
                    title="Sign Out"
                    className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsCustomerAuthOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-950 transition-colors whitespace-nowrap cursor-pointer shadow-xs"
                >
                  <UserIcon className="w-4 h-4 text-emerald-600" />
                  <span>Sign In / Register</span>
                </button>
              )}
            </>
          )}


          {/* Primary Cart Action */}
          <button
            type="button"
            onClick={onOpenCart}
            className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 active:scale-[0.99] transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            <ShoppingBag className="w-4 h-4 shrink-0" />
            {cartCount > 0 ? (
              <span className="tabular-nums font-mono text-xs sm:text-sm">
                Cart ({cartCount}) · ₹{cartTotal}
              </span>
            ) : (
              <span>View Cart</span>
            )}
          </button>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={
              mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'
            }
            aria-expanded={mobileMenuOpen}
            className="lg:hidden p-2.5 text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Responsive Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-2 shadow-lg">
          {isAuthenticated && user && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2.5">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    {user.displayName || 'Google Account'}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate max-w-[180px]">
                    {user.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  void signOutUser();
                  setMobileMenuOpen(false);
                }}
                className="text-xs font-semibold text-red-600 hover:text-red-700 px-2 py-1 rounded"
              >
                Sign Out
              </button>
            </div>
          )}

          {!isAuthenticated && !authLoading && (
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                void signInWithGoogle();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50"
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
              <span>Continue with Google</span>
            </button>
          )}

          {STUDENT_NAV_LINKS.map((link) => {
            const isActive = activeTab === link.id;
            return (
              <button
                key={link.id}
                type="button"
                onClick={() => handleNavClick(link.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-800 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {link.label}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenStaffPortal();
            }}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-between"
          >
            <span>Staff Login</span>
            <Lock className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenStaffPortal();
            }}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-between"
          >
            <span>{isAdmin ? 'Admin Dashboard' : 'Admin Login'}</span>
            {isAdmin && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                Authorized
              </span>
            )}
          </button>
        </div>
      )}

      {/* Customer Registration & Login Modal */}
      <CustomerAuthModal
        isOpen={isCustomerAuthOpen}
        onClose={() => setIsCustomerAuthOpen(false)}
      />
    </header>
  );
};

