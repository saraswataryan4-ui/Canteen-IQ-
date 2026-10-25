import React from 'react';
import {
  Bot,
  ChefHat,
  Info,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { ActiveTab } from '../types';

interface AboutSectionProps {
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenStaffPortal: () => void;
}

export const AboutSection: React.FC<AboutSectionProps> = ({
  onNavigateTab,
  onOpenStaffPortal,
}) => {
  return (
    <section
      id="about-canteeniq"
      aria-labelledby="about-canteeniq-heading"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4"
    >
      <div className="border border-slate-200 rounded-2xl bg-slate-50/70 p-6 sm:p-10 space-y-8">
        {/* Section Header */}
        <div className="space-y-2 border-b border-slate-200 pb-6">
          <p className="text-xs font-medium text-emerald-700">
            About CanteenIQ · Smart Campus Dining Platform
          </p>
          <h2
            id="about-canteeniq-heading"
            className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950"
            style={{ textWrap: 'balance' }}
          >
            Smarter Campus Dining for Students and Canteen Teams
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-3xl leading-relaxed">
            CanteenIQ is a campus canteen management and online ordering platform
            designed to eliminate between-lecture waiting lines, coordinate group snack
            runs, and provide kitchen staff with a structured digital order queue.
          </p>
        </div>

        {/* 3-Column Value Breakdown: Students, Staff, and AI + Validation Architecture */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Benefits for Students */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-sm font-bold text-slate-950">
                <Users className="w-4 h-4 text-emerald-700 shrink-0" />
                <h3>For Campus Students</h3>
              </div>
              <ul className="space-y-2.5 text-sm text-slate-600 leading-relaxed">
                <li>
                  <span className="font-semibold text-slate-900">
                    Queue-Free Pre-Ordering:
                  </span>{' '}
                  Browse available dishes, check estimated prep times, and
                  receive an instant pickup token (<span className="font-mono">CIQ-xxx</span>)
                  without waiting at the billing counter.
                </li>
                <li>
                  <span className="font-semibold text-slate-900">
                    Group Ordering &amp; Split Shares:
                  </span>{' '}
                  Create a shared group code (<span className="font-mono">GRP-xxxx</span>) so
                  friends can add items separately while calculating each
                  person&apos;s share and one combined total.
                </li>
                <li>
                  <span className="font-semibold text-slate-900">
                    Table Reservation:
                  </span>{' '}
                  Reserve available study booths or commons tables for
                  short break slots before arriving.
                </li>
              </ul>
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-3 text-xs font-semibold">
              <button
                type="button"
                onClick={() => onNavigateTab(ActiveTab.GroupOrder)}
                className="text-emerald-800 hover:text-emerald-950 underline underline-offset-4 cursor-pointer"
              >
                Try Group Ordering
              </button>
              <span className="text-slate-300" aria-hidden="true">
                ·
              </span>
              <button
                type="button"
                onClick={() => onNavigateTab(ActiveTab.Seating)}
                className="text-emerald-800 hover:text-emerald-950 underline underline-offset-4 cursor-pointer"
              >
                Try Seat Reservation
              </button>
            </div>
          </div>

          {/* Column 2: Benefits for Canteen Staff */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-sm font-bold text-slate-950">
                <ChefHat className="w-4 h-4 text-emerald-700 shrink-0" />
                <h3>For Canteen Staff</h3>
              </div>
              <ul className="space-y-2.5 text-sm text-slate-600 leading-relaxed">
                <li>
                  <span className="font-semibold text-slate-900">
                    Structured Token Queue:
                  </span>{' '}
                  View solo and group orders in one queue and advance statuses
                  through <span className="font-medium text-slate-800">Received</span>,{' '}
                  <span className="font-medium text-slate-800">Preparing</span>,{' '}
                  <span className="font-medium text-slate-800">Ready</span>, and{' '}
                  <span className="font-medium text-slate-800">Collected</span>.
                </li>
                <li>
                  <span className="font-semibold text-slate-900">
                    Portion Stock Controls:
                  </span>{' '}
                  Adjust portion counts or pause unavailable dishes so students
                  only order items currently in stock.
                </li>
                <li>
                  <span className="font-semibold text-slate-900">
                    Floor Table Management:
                  </span>{' '}
                  Update table statuses (<span className="font-medium text-slate-800">Available</span>,{' '}
                  <span className="font-medium text-slate-800">Occupied</span>,{' '}
                  <span className="font-medium text-slate-800">Reserved</span>) from a
                  dedicated staff-only panel.
                </li>
              </ul>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onOpenStaffPortal}
                className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 underline underline-offset-4 cursor-pointer"
              >
                Open Staff Portal →
              </button>
            </div>
          </div>

          {/* Column 3: AI Assistant & Application Validation */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-sm font-bold text-slate-950">
                <Bot className="w-4 h-4 text-emerald-700 shrink-0" />
                <h3>Gemma 4 Assistant &amp; Order Validation</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Students can describe their budget and break time in{' '}
                <span className="font-semibold text-slate-900">
                  English, Hindi, or Hinglish
                </span>
                . Server-side{' '}
                <span className="font-mono font-semibold text-slate-900">
                  gemma-4-26b-a4b-it
                </span>{' '}
                recommends combinations using current menu items, ₹ prices,
                and availability.
              </p>
              <div className="p-3.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 leading-relaxed space-y-1">
                <p className="font-bold inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>Deterministic Order Validation</span>
                </p>
                <p>
                  While Gemma 4 suggests dishes, the CanteenIQ application
                  independently validates item names, ₹ prices, quantities, and
                  stock availability. The model cannot invent prices or place
                  orders directly.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => onNavigateTab(ActiveTab.Chat)}
                className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 underline underline-offset-4 cursor-pointer"
              >
                Open AI Food Assistant →
              </button>
            </div>
          </div>
        </div>

        {/* System Architecture Transparency */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed">
          <Info className="w-4 h-4 shrink-0 text-emerald-700 mt-0.5" />
          <p>
            <span className="font-semibold text-slate-900">
              Architecture &amp; Access Control:
            </span>{' '}
            Orders are securely persisted with real-time status updates, private customer order tracking, and role-based access for kitchen staff and administrators. The AI Food Assistant connects server-side to{' '}
            <span className="font-mono font-semibold text-slate-800">
              gemma-4-26b-a4b-it
            </span>{' '}
            via the Google Gen AI SDK, with all item prices and stock deterministically validated by the application.
          </p>
        </div>
      </div>
    </section>
  );
};
