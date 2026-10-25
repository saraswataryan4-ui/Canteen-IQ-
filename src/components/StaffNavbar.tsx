import React, { useState } from 'react';
import { History, LogOut, Menu, ShieldCheck, X } from 'lucide-react';
import { StaffSection } from '../types';
import { useAuth } from '../auth/AuthContext';

interface StaffNavbarProps {
  activeSection: StaffSection;
  onSelectSection: (section: StaffSection) => void;
  onSwitchToStudentSite: () => void;
  onLogout: () => void;
}

const BASE_STAFF_LINKS: { id: StaffSection; label: string }[] = [
  { id: 'orders', label: 'Orders' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'tables', label: 'Floor Tables' },
];

export const StaffNavbar: React.FC<StaffNavbarProps> = ({
  activeSection,
  onSelectSection,
  onSwitchToStudentSite,
  onLogout,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAdmin } = useAuth();

  const links: { id: StaffSection; label: string }[] = isAdmin
    ? [
        ...BASE_STAFF_LINKS,
        { id: 'staff', label: 'Staff Management' },
        { id: 'audit', label: 'Audit Trail' },
      ]
    : BASE_STAFF_LINKS;

  const handleSectionClick = (section: StaffSection) => {
    onSelectSection(section);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 sm:gap-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => handleSectionClick('orders')}
          className="text-xl font-bold tracking-tight text-emerald-950 hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {isAdmin ? 'CanteenIQ Admin' : 'CanteenIQ Staff'}
        </button>

        {/* Zone 2: Navigation links */}
        <nav
          aria-label="Staff Dashboard Navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium"
        >
          {links.map((link) => {
            const isActive = activeSection === link.id;
            return (
              <button
                key={link.id}
                type="button"
                onClick={() => handleSectionClick(link.id)}
                className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
              onSwitchToStudentSite();
            }}
            className="py-5 border-b-2 border-transparent text-slate-600 hover:text-emerald-800 hover:border-slate-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Student Site
          </button>
        </nav>

        {/* Zone 3: Staff Logout Primary Action */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-red-50 hover:text-red-700 border border-slate-300 hover:border-red-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Logout</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close staff menu' : 'Open staff menu'}
            aria-expanded={mobileMenuOpen}
            className="md:hidden p-2.5 text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Staff Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1 shadow-lg">
          {links.map((link) => {
            const isActive = activeSection === link.id;
            return (
              <button
                key={link.id}
                type="button"
                onClick={() => handleSectionClick(link.id)}
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
              onSwitchToStudentSite();
            }}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-emerald-800 transition-colors cursor-pointer"
          >
            Switch to Student Website
          </button>
        </div>
      )}
    </header>
  );
};
