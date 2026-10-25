import React from 'react';
import { ActiveTab, PortalMode } from '../types';

interface FooterProps {
  portalMode: PortalMode;
  isStaffAuthenticated: boolean;
  onSelectStudentTab: (tab: ActiveTab) => void;
  onOpenStaffPortal: () => void;
  onSwitchToStudentSite: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  portalMode,
  isStaffAuthenticated,
  onSelectStudentTab,
  onOpenStaffPortal,
  onSwitchToStudentSite,
}) => {
  return (
    <footer className="border-t border-slate-200 bg-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-1 max-w-xl">
          <p className="text-sm font-bold text-emerald-950">
            CanteenIQ — Smart Campus Dining
          </p>
          <p className="text-xs text-slate-500 leading-relaxed">
            Campus Dining Platform · Powered server-side by Gemma 4 (
            <span className="font-mono">gemma-4-26b-a4b-it</span>). Secure
            ordering, real-time kitchen tracking, and seat reservations across campus.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5 text-xs font-medium text-slate-600">
          {portalMode === PortalMode.Student ? (
            <>
              <button
                type="button"
                onClick={() => onSelectStudentTab(ActiveTab.Menu)}
                className="hover:text-emerald-800 transition-colors cursor-pointer"
              >
                Menu
              </button>
              <button
                type="button"
                onClick={() => onSelectStudentTab(ActiveTab.GroupOrder)}
                className="hover:text-emerald-800 transition-colors cursor-pointer"
              >
                Group Ordering
              </button>
              <button
                type="button"
                onClick={() => onSelectStudentTab(ActiveTab.TrackOrder)}
                className="hover:text-emerald-800 transition-colors cursor-pointer"
              >
                My Orders &amp; Tracking
              </button>
              <button
                type="button"
                onClick={() => onSelectStudentTab(ActiveTab.Seating)}
                className="hover:text-emerald-800 transition-colors cursor-pointer"
              >
                Seat Reservation
              </button>
              <button
                type="button"
                onClick={() => onSelectStudentTab(ActiveTab.Chat)}
                className="hover:text-emerald-800 transition-colors cursor-pointer"
              >
                AI Food Assistant
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectStudentTab(ActiveTab.Menu);
                  window.setTimeout(() => {
                    document
                      .getElementById('about-canteeniq')
                      ?.scrollIntoView({ behavior: 'smooth' });
                  }, 80);
                }}
                className="hover:text-emerald-800 transition-colors cursor-pointer"
              >
                About CanteenIQ
              </button>
              <button
                type="button"
                onClick={onOpenStaffPortal}
                className="text-slate-500 hover:text-slate-900 underline underline-offset-4 transition-colors cursor-pointer"
              >
                {isStaffAuthenticated
                  ? 'Staff Portal (Active Session)'
                  : 'Staff Login'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onSwitchToStudentSite}
              className="text-emerald-800 hover:text-emerald-950 font-semibold transition-colors cursor-pointer"
            >
              Switch to Student Website
            </button>
          )}
        </div>
      </div>
    </footer>
  );
};
