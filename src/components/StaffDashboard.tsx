import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Edit2,
  Eye,
  History,
  KeyRound,
  Loader2,
  LogOut,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  UserCheck,
  UserPlus,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import {
  DiningTable,
  MenuItem,
  Order,
  OrderStatus,
  StaffMember,
  StaffSection,
  TableStatus,
} from '../types';
import { useAuth } from '../auth/AuthContext';
import { Permission } from '../auth/authService';

interface StaffDashboardProps {
  orders: Order[];

  menuItems: MenuItem[];
  tables: DiningTable[];
  selectedToken: string | null;
  activeSection: StaffSection;
  onSelectSection: (section: StaffSection) => void;
  staffDisplayName: string;
  staffId: string;
  staffRoleTitle: string;
  canResetDemoData: boolean;
  onUpdateOrderStatus: (orderId: string, nextStatus: OrderStatus) => void;
  onViewOrderOnStudentSite: (token: string) => void;
  onUpdateStock: (menuItemId: string, delta: number) => void;
  onToggleItemAvailability: (menuItemId: string) => void;
  onSetTableStatus: (tableId: string, nextStatus: TableStatus) => void;
  onResetDemoData: () => void;
  onLogout: () => void;
}

const ALL_STATUSES: OrderStatus[] = [
  OrderStatus.Received,
  OrderStatus.Preparing,
  OrderStatus.Ready,
  OrderStatus.Collected,
  OrderStatus.Delivered,
];

const STAFF_ACTION_STATUSES: OrderStatus[] = [
  OrderStatus.Preparing,
  OrderStatus.Ready,
  OrderStatus.Collected,
  OrderStatus.Delivered,
];

const TABLE_STATUS_ACTIONS: TableStatus[] = [
  TableStatus.Available,
  TableStatus.Occupied,
  TableStatus.Reserved,
];

export const StaffDashboard: React.FC<StaffDashboardProps> = ({
  orders,
  menuItems,
  tables,
  selectedToken,
  activeSection,
  onSelectSection,
  staffDisplayName,
  staffId,
  staffRoleTitle,
  canResetDemoData,
  onUpdateOrderStatus,
  onViewOrderOnStudentSite,
  onUpdateStock,
  onToggleItemAvailability,
  onSetTableStatus,
  onResetDemoData,
  onLogout,
}) => {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  // Admin staff management state
  const {
    isAdmin,
    staffList,
    auditLogs,
    createStaffMember,
    toggleStaffStatus,
    updateStaffMember,
  } = useAuth();
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [staffFormSubmitting, setStaffFormSubmitting] = useState(false);
  const [staffFormError, setStaffFormError] = useState<string | null>(null);

  // New staff fields
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPasscode, setNewStaffPasscode] = useState('staff2026');
  const [newStaffRole, setNewStaffRole] = useState('Kitchen Counter Lead');
  const [newStaffPermissions, setNewStaffPermissions] = useState<string[]>([
    'staff:view_dashboard',
    'orders:update_status',
  ]);

  const metrics = useMemo(() => {
    const pendingCount = orders.filter(
      (o) =>
        o.status === OrderStatus.Received || o.status === OrderStatus.Preparing
    ).length;
    const readyCount = orders.filter(
      (o) => o.status === OrderStatus.Ready
    ).length;
    const demoRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const lowStockCount = menuItems.filter(
      (m) => !m.isAvailable || m.stock <= 8
    ).length;
    const openTablesCount = tables.filter(
      (t) => t.status === TableStatus.Available
    ).length;

    return {
      pendingCount,
      readyCount,
      demoRevenue,
      lowStockCount,
      openTablesCount,
    };
  }, [orders, menuItems, tables]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus =
        statusFilter === 'All' || order.status === statusFilter;
      const matchesSearch =
        !q ||
        order.token.toLowerCase().includes(q) ||
        order.studentName.toLowerCase().includes(q) ||
        order.rollNumber.toLowerCase().includes(q) ||
        Boolean(order.groupCode && order.groupCode.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [orders, statusFilter, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Verified Admin Authorization Banner */}
      <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-2.5 text-xs text-emerald-950">
          <ShieldAlert className="w-4 h-4 shrink-0 text-emerald-700 mt-0.5 sm:mt-0" />
          <p>
            <span className="font-bold">VERIFIED ADMINISTRATOR</span> · Signed in
            as <span className="font-semibold">{staffDisplayName}</span> (
            <span className="font-mono">{staffId}</span> · {staffRoleTitle}).
            Real-time synchronization with Cloud Firestore.
          </p>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-950 bg-white border border-emerald-300 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer w-fit"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out Admin</span>
        </button>
      </div>

      {/* Staff Console Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-emerald-700">
            Authenticated Staff Panel · Shared Demo Orders, Inventory &amp; Tables
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
            Staff Management Dashboard
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            Manage incoming student orders, update statuses (Preparing, Ready,
            Collected), adjust inventory, and toggle floor table
            availability.
          </p>
        </div>

        {/* Reset Queue Action (Guarded by ResetDemoData permission) */}
        {canResetDemoData && (
          <div className="flex items-center gap-2 shrink-0">
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-slate-500" />
                <span>Reset Order Queue</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-1.5">
                <span className="text-xs font-medium text-red-900 px-2">
                  Reset all queued orders?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onResetDemoData();
                    setConfirmReset(false);
                  }}
                  className="px-3 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md cursor-pointer"
                >
                  Confirm Reset
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-white rounded-md cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4-Column Operations Analytics Strip */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
          <span className="font-semibold text-slate-800">
            Operations Analytics
          </span>
          <span className="text-slate-500">
            Live figures computed from current kitchen orders, inventory,
            and dining tables
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 p-4 sm:p-5">
            <p className="text-xs text-slate-500">Active Kitchen Queue</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {metrics.pendingCount}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {metrics.readyCount} awaiting student pickup
            </p>
          </div>

          <div className="bg-slate-50 p-4 sm:p-5">
            <p className="text-xs text-slate-500">Total Order Revenue</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700 font-mono tabular-nums">
              ₹{metrics.demoRevenue}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Across {orders.length} total orders
            </p>
          </div>

          <div className="bg-slate-50 p-4 sm:p-5">
            <p className="text-xs text-slate-500">Inventory Alerts</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {metrics.lowStockCount}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {metrics.lowStockCount === 0
                ? 'All dishes well stocked'
                : 'Dishes low or paused'}
            </p>
          </div>

          <div className="bg-slate-50 p-4 sm:p-5">
            <p className="text-xs text-slate-500">Table Availability</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {metrics.openTablesCount} / {tables.length}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Open tables on dining floor
            </p>
          </div>
        </div>
      </div>

      {/* Staff Workspace Sub-Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => onSelectSection('orders')}
            className={`px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeSection === 'orders'
                ? 'bg-white text-emerald-950 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Orders Queue ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => onSelectSection('inventory')}
            className={`px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeSection === 'inventory'
                ? 'bg-white text-emerald-950 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Inventory ({menuItems.length})
          </button>
          <button
            type="button"
            onClick={() => onSelectSection('tables')}
            className={`px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeSection === 'tables'
                ? 'bg-white text-emerald-950 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Floor Tables ({tables.length})
          </button>

          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => onSelectSection('staff')}
                className={`px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  activeSection === 'staff'
                    ? 'bg-white text-emerald-950 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Staff Management ({staffList.length})</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectSection('audit')}
                className={`px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  activeSection === 'audit'
                    ? 'bg-white text-emerald-950 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <History className="w-3.5 h-3.5 text-slate-500" />
                <span>Audit Trail ({auditLogs.length})</span>
              </button>
            </>
          )}
        </div>


        {activeSection === 'orders' && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative sm:w-60">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter token or student..."
                aria-label="Filter orders"
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as OrderStatus | 'All')
              }
              aria-label="Filter by order status"
              className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-emerald-600 cursor-pointer"
            >
              <option value="All">Status: All Orders</option>
              {ALL_STATUSES.map((st) => (
                <option key={st} value={st}>
                  Status: {st}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: DEMO ORDERS TABLE WITH WORKING PREPARING / READY / COLLECTED BUTTONS */}
      {activeSection === 'orders' && (
        <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                  <th className="py-3.5 px-4">Token</th>
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">Ordered Items</th>
                  <th className="py-3.5 px-4 text-right">Total</th>
                  <th className="py-3.5 px-4">Current Status</th>
                  <th className="py-3.5 px-4 text-right">
                    Set Order Status (Staff Only)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-12 px-4 text-center"
                    >
                      <div className="space-y-2.5 max-w-sm mx-auto">
                        <p className="text-sm font-semibold text-slate-900">
                          No orders match your current filter
                        </p>
                        <p className="text-xs text-slate-500">
                          Clear your search term or status filter to view all{' '}
                          {orders.length} orders.
                        </p>
                        {(searchQuery.trim() !== '' ||
                          statusFilter !== 'All') && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchQuery('');
                              setStatusFilter('All');
                            }}
                            className="mt-1 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                          >
                            Reset Order Filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const isTracked =
                      selectedToken?.toLowerCase() === order.token.toLowerCase();
                    return (
                      <tr
                        key={order.id}
                        className={`transition-colors ${
                          isTracked
                            ? 'bg-emerald-50/40 hover:bg-emerald-50/70'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-3.5 px-4 align-top whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-950 tabular-nums">
                              {order.token}
                            </span>
                            {order.isGroupOrder && order.groupCode ? (
                              <span className="text-xs font-semibold text-emerald-800 font-mono">
                                · {order.groupCode}
                              </span>
                            ) : (
                              order.isUserOrder && (
                                <span className="text-xs font-medium text-emerald-800">
                                  · New
                                </span>
                              )
                            )}
                          </div>
                          <p className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
                            {order.createdAt}
                            {order.isGroupOrder ? ' · Group Order' : ''}
                          </p>
                          <button
                            type="button"
                            onClick={() => onViewOrderOnStudentSite(order.token)}
                            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-950 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Preview on Student Site</span>
                          </button>
                        </td>

                        <td className="py-3.5 px-4 align-top">
                          <p className="font-medium text-slate-900">
                            {order.studentName}
                            {order.isGroupOrder ? ' (Organizer)' : ''}
                          </p>
                          <p className="text-xs text-slate-500 font-mono">
                            {order.rollNumber}
                            {order.tableId
                              ? ` · ${
                                  order.tableId.startsWith('Table')
                                    ? order.tableId
                                    : `Table ${order.tableId}`
                                }`
                              : ' · Counter'}
                          </p>
                          {order.isGroupOrder &&
                            order.groupParticipants &&
                            order.groupParticipants.length > 0 && (
                              <p className="text-xs text-emerald-800 font-medium mt-0.5">
                                {order.groupParticipants.length} group
                                participants
                              </p>
                            )}
                        </td>

                        <td className="py-3.5 px-4 align-top">
                          <ul className="space-y-0.5 text-slate-700 tabular-nums">
                            {order.items.map((item) => (
                              <li key={item.menuItemId}>
                                <span className="font-mono font-semibold text-emerald-800">
                                  {item.quantity}×
                                </span>{' '}
                                {item.name}
                              </li>
                            ))}
                          </ul>
                          {order.isGroupOrder &&
                            order.groupParticipants &&
                            order.groupParticipants.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-slate-100 space-y-0.5 text-xs text-slate-500">
                                {order.groupParticipants.map((part) => (
                                  <p key={part.participantId}>
                                    <span className="font-medium text-slate-700">
                                      {part.participantName}:
                                    </span>{' '}
                                    {part.items.length === 0
                                      ? 'No items'
                                      : part.items
                                          .map(
                                            (i) => `${i.quantity}× ${i.name}`
                                          )
                                          .join(', ')}
                                  </p>
                                ))}
                              </div>
                            )}
                          {order.notes && (
                            <p className="text-xs text-amber-800 mt-1">
                              Note: {order.notes}
                            </p>
                          )}
                        </td>

                        <td className="py-3.5 px-4 align-top text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                          ₹{order.totalAmount}
                        </td>

                        <td className="py-3.5 px-4 align-top whitespace-nowrap">
                          <span
                            className={`text-xs font-bold ${
                              order.status === OrderStatus.Ready
                                ? 'text-emerald-700'
                                : order.status === OrderStatus.Preparing
                                ? 'text-amber-700'
                                : order.status === OrderStatus.Collected
                                ? 'text-slate-500'
                                : 'text-slate-900'
                            }`}
                          >
                            {order.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                            {STAFF_ACTION_STATUSES.map((targetStatus) => {
                              const isActive = order.status === targetStatus;
                              return (
                                <button
                                  key={targetStatus}
                                  type="button"
                                  onClick={() =>
                                    onUpdateOrderStatus(order.id, targetStatus)
                                  }
                                  aria-pressed={isActive}
                                  className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                    isActive
                                      ? 'bg-emerald-700 text-white border-emerald-700'
                                      : 'bg-white text-slate-700 border-slate-300 hover:border-emerald-600 hover:text-emerald-900 hover:bg-emerald-50/50'
                                  }`}
                                >
                                  {isActive && <Check className="w-3.5 h-3.5" />}
                                  <span>{targetStatus}</span>
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: INVENTORY MANAGEMENT */}
      {activeSection === 'inventory' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
            <p>
              <span className="font-semibold text-slate-900">
                Menu Pricing &amp; Portion Inventory
              </span>{' '}
              · Manage dish prices (₹) and live portion counts. Stock updates
              apply immediately to the Student Menu, Group Ordering, and AI
              Food Assistant.
            </p>
            <span className="font-mono font-medium text-emerald-800 whitespace-nowrap">
              {menuItems.filter((i) => i.isAvailable && i.stock > 0).length} /{' '}
              {menuItems.length} Active Dishes
            </span>
          </div>

          <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                  <th className="py-3.5 px-4">Dish Name</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4 text-right">Price</th>
                  <th className="py-3.5 px-4 text-right">Portions in Stock</th>
                  <th className="py-3.5 px-4">Stock State</th>
                  <th className="py-3.5 px-4 text-right">Inventory Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {menuItems.map((item) => {
                  const isOut = !item.isAvailable || item.stock <= 0;
                  const isLow = item.isAvailable && item.stock > 0 && item.stock <= 8;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {item.name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {item.category}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900">
                        ₹{item.price}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold tabular-nums text-slate-950">
                        {item.stock}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
                            <XCircle className="w-4 h-4" />
                            <span>Unavailable / Out of Stock</span>
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                            <AlertTriangle className="w-4 h-4" />
                            <span>Low Stock</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Healthy Stock</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <div className="inline-flex items-center border border-slate-300 rounded-lg overflow-hidden">
                            <button
                              type="button"
                              disabled={item.stock <= 0}
                              onClick={() => onUpdateStock(item.id, -1)}
                              aria-label={`Decrease stock for ${item.name}`}
                              className="p-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onUpdateStock(item.id, 1)}
                              aria-label={`Increase stock for ${item.name}`}
                              className="p-1.5 text-slate-700 hover:bg-slate-100 border-l border-slate-300 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => onUpdateStock(item.id, 10)}
                            className="px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                          >
                            +10 Restock
                          </button>

                          <button
                            type="button"
                            onClick={() => onToggleItemAvailability(item.id)}
                            className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                          >
                            {item.isAvailable ? 'Pause Item' : 'Enable Item'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </div>
        </div>
      )}

      {/* TAB 3: DINING HALL TABLE AVAILABILITY (STAFF-ONLY CONTROLS) */}
      {activeSection === 'tables' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
            <p>
              <span className="font-semibold text-slate-900">
                Dining Hall Seating Controls
              </span>{' '}
              · Updates to Table 01 – Table 04 immediately sync with the Student
              Seat Reservation view in real time.
            </p>
            <span className="font-mono font-medium text-emerald-800 whitespace-nowrap">
              {metrics.openTablesCount} Available ·{' '}
              {tables.filter((t) => t.status === TableStatus.Reserved).length}{' '}
              Reserved ·{' '}
              {tables.filter((t) => t.status === TableStatus.Occupied).length}{' '}
              Occupied
            </span>
          </div>

          <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                    <th className="py-3.5 px-4">Table</th>
                    <th className="py-3.5 px-4">Campus Zone</th>
                    <th className="py-3.5 px-4 text-right">Capacity</th>
                    <th className="py-3.5 px-4">Current Status</th>
                    <th className="py-3.5 px-4">Reservation / Occupancy Info</th>
                    <th className="py-3.5 px-4 text-right">
                      Update Table Availability (Staff Only)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {tables.map((table) => {
                    const isAvailable = table.status === TableStatus.Available;
                    const isReserved = table.status === TableStatus.Reserved;
                    return (
                      <tr
                        key={table.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-950 whitespace-nowrap">
                          {table.label}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {table.zone}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                          {table.capacity} seats
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isAvailable ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Available</span>
                            </span>
                          ) : isReserved ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                              <AlertTriangle className="w-4 h-4" />
                              <span>Reserved</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                              <XCircle className="w-4 h-4 text-slate-500" />
                              <span>Occupied</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 text-xs">
                          {isAvailable ? (
                            <span>Open for student reservation or walk-in</span>
                          ) : isReserved ? (
                            <div className="space-y-0.5">
                              <p className="font-medium text-slate-900">
                                {table.reservationId && (
                                  <span className="font-mono font-bold text-emerald-900 mr-1.5">
                                    {table.reservationId}
                                  </span>
                                )}
                                {table.occupantName || 'Reserved Guest'}
                                {table.partySize
                                  ? ` (${table.partySize} ${
                                      table.partySize === 1 ? 'guest' : 'guests'
                                    })`
                                  : ''}
                              </p>
                              {table.timeSlot && (
                                <p className="text-slate-500 font-mono">
                                  Slot: {table.timeSlot}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <p className="font-medium text-slate-900">
                                {table.occupantName || 'Walk-in Campus Group'}
                              </p>
                              {table.timeSlot && (
                                <p className="text-slate-500">
                                  {table.timeSlot}
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                            {TABLE_STATUS_ACTIONS.map((targetStatus) => {
                              const isActive = table.status === targetStatus;
                              return (
                                <button
                                  key={targetStatus}
                                  type="button"
                                  onClick={() =>
                                    onSetTableStatus(table.id, targetStatus)
                                  }
                                  aria-pressed={isActive}
                                  className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                    isActive
                                      ? 'bg-emerald-700 text-white border-emerald-700'
                                      : 'bg-white text-slate-700 border-slate-300 hover:border-emerald-600 hover:text-emerald-900 hover:bg-emerald-50/50'
                                  }`}
                                >
                                  {isActive && (
                                    <Check className="w-3.5 h-3.5" />
                                  )}
                                  <span>{targetStatus}</span>
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Admin Section: Staff Management */}
      {isAdmin && activeSection === 'staff' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <span>Canteen Staff Directory &amp; Role Management</span>
                </h2>
                <p className="text-xs text-slate-600">
                  Manage kitchen and counter staff accounts. Each staff member has a unique Staff ID and Staff UID. Deactivated staff immediately lose system access.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setStaffFormError(null);
                  setNewStaffName('');
                  setNewStaffEmail('');
                  setNewStaffPasscode('staff2026');
                  setNewStaffRole('Kitchen Counter Lead');
                  setIsAddStaffOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm rounded-lg transition-colors cursor-pointer shadow-xs w-fit"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add Staff Member</span>
              </button>
            </div>

            {/* Staff Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Staff ID &amp; UID</th>
                    <th className="py-3 px-4">Name &amp; Email</th>
                    <th className="py-3 px-4">Role Title</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Permissions</th>
                    <th className="py-3 px-4">Created</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {staffList.map((staff) => {
                    const isActive = staff.status === 'active';
                    return (
                      <tr
                        key={staff.staffId}
                        className={isActive ? 'hover:bg-slate-50/50' : 'bg-red-50/30'}
                      >
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="space-y-0.5">
                            <span className="font-mono font-bold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              {staff.staffId}
                            </span>
                            <p className="text-[10px] text-slate-500 font-mono">
                              {staff.staffUid}
                            </p>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <p className="font-semibold text-slate-900">{staff.name}</p>
                          <p className="text-slate-500">{staff.email}</p>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-800">
                          {staff.role}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${
                              isActive
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-red-100 text-red-800 border border-red-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isActive ? 'bg-emerald-600' : 'bg-red-600'
                              }`}
                            />
                            {staff.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {staff.permissions.map((p) => (
                              <span
                                key={p}
                                className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-mono"
                              >
                                {p.replace(/^(staff|orders|inventory|tables|system):/, '')}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                          <p>{new Date(staff.createdAt).toLocaleDateString()}</p>
                          <p className="text-slate-400 truncate max-w-[120px]">
                            by {staff.createdBy.split('@')[0]}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingStaff(staff)}
                              className="px-2.5 py-1 text-slate-700 hover:text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-xs font-medium cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void toggleStaffStatus(
                                  staff.staffId,
                                  isActive ? 'inactive' : 'active'
                                )
                              }
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer border ${
                                isActive
                                  ? 'text-red-700 bg-red-50 border-red-200 hover:bg-red-100'
                                  : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                              }`}
                            >
                              {isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Admin Section: Audit Trail */}
      {isAdmin && activeSection === 'audit' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-600" />
                <span>Administrative Actions Audit Trail</span>
              </h2>
              <p className="text-xs text-slate-600">
                Immutable record of administrative operations, staff account lifecycle events, and permission updates.
              </p>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Target Staff</th>
                    <th className="py-3 px-4">Admin Email</th>
                    <th className="py-3 px-4">Audit Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] text-slate-600">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                            log.action.includes('CREATE')
                              ? 'bg-blue-100 text-blue-800'
                              : log.action.includes('DEACTIVATE')
                              ? 'bg-red-100 text-red-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-900">
                        <span className="font-mono">{log.targetStaffId}</span> · {log.targetStaffName}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                        {log.adminEmail}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 border border-slate-200 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setIsAddStaffOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-600" />
                <span>Add New Canteen Staff</span>
              </h3>
              <p className="text-xs text-slate-600">
                A unique Staff ID (STF-XXX) and Staff UID will be assigned automatically.
              </p>
            </div>

            {staffFormError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{staffFormError}</span>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setStaffFormError(null);
                setStaffFormSubmitting(true);
                try {
                  await createStaffMember({
                    name: newStaffName.trim(),
                    email: newStaffEmail.trim().toLowerCase(),
                    passcode: newStaffPasscode.trim(),
                    role: newStaffRole.trim(),
                    permissions: newStaffPermissions,
                  });
                  setIsAddStaffOpen(false);
                } catch (err: unknown) {
                  setStaffFormError(
                    err instanceof Error ? err.message : 'Failed to create staff member'
                  );
                } finally {
                  setStaffFormSubmitting(false);
                }
              }}
              className="space-y-4 text-xs"
            >
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Full Name</label>
                <input
                  type="text"
                  required
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  placeholder="e.g. Anand Sharma"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-emerald-600"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Staff Email</label>
                <input
                  type="email"
                  required
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  placeholder="staff@canteeniq.campus"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-emerald-600"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Job Role Title</label>
                <input
                  type="text"
                  required
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value)}
                  placeholder="Kitchen Counter Lead"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-emerald-600"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Staff Passcode</label>
                <input
                  type="text"
                  required
                  value={newStaffPasscode}
                  onChange={(e) => setNewStaffPasscode(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl font-mono focus:bg-white focus:outline-emerald-600"
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="font-semibold text-slate-700">Granted Permissions</label>
                <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  {[
                    { id: 'staff:view_dashboard', label: 'View Staff Dashboard' },
                    { id: 'orders:update_status', label: 'Update Food Order Status' },
                    { id: 'inventory:manage', label: 'Manage Food Stock & Availability' },
                    { id: 'tables:manage', label: 'Manage Floor Dining Tables' },
                    { id: 'system:reset_demo', label: 'Reset Demo Data Defaults' },
                  ].map((perm) => (
                    <label key={perm.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newStaffPermissions.includes(perm.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewStaffPermissions([...newStaffPermissions, perm.id]);
                          } else {
                            setNewStaffPermissions(
                              newStaffPermissions.filter((p) => p !== perm.id)
                            );
                          }
                        }}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-slate-800">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={staffFormSubmitting}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {staffFormSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Provisioning Staff...</span>
                  </>
                ) : (
                  <span>Create Staff Account</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 border border-slate-200 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setEditingStaff(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-emerald-600" />
                <span>Edit Staff Member · {editingStaff.staffId}</span>
              </h3>
              <p className="text-xs text-slate-600">
                Update job role, passcode, or granted operations permissions.
              </p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setStaffFormSubmitting(true);
                try {
                  await updateStaffMember(editingStaff.staffId, {
                    name: editingStaff.name,
                    role: editingStaff.role,
                    passcode: editingStaff.passcode,
                    permissions: editingStaff.permissions,
                  });
                  setEditingStaff(null);
                } catch (err: unknown) {
                  alert(err instanceof Error ? err.message : 'Failed to update staff');
                } finally {
                  setStaffFormSubmitting(false);
                }
              }}
              className="space-y-4 text-xs"
            >
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Full Name</label>
                <input
                  type="text"
                  required
                  value={editingStaff.name}
                  onChange={(e) =>
                    setEditingStaff({ ...editingStaff, name: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Job Role Title</label>
                <input
                  type="text"
                  required
                  value={editingStaff.role}
                  onChange={(e) =>
                    setEditingStaff({ ...editingStaff, role: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Passcode</label>
                <input
                  type="text"
                  value={editingStaff.passcode || ''}
                  onChange={(e) =>
                    setEditingStaff({ ...editingStaff, passcode: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl font-mono"
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="font-semibold text-slate-700">Granted Permissions</label>
                <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  {[
                    { id: 'staff:view_dashboard', label: 'View Staff Dashboard' },
                    { id: 'orders:update_status', label: 'Update Food Order Status' },
                    { id: 'inventory:manage', label: 'Manage Food Stock & Availability' },
                    { id: 'tables:manage', label: 'Manage Floor Dining Tables' },
                    { id: 'system:reset_demo', label: 'Reset Demo Data Defaults' },
                  ].map((perm) => (
                    <label key={perm.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingStaff.permissions.includes(perm.id)}
                        onChange={(e) => {
                          const perms = e.target.checked
                            ? [...editingStaff.permissions, perm.id]
                            : editingStaff.permissions.filter((p) => p !== perm.id);
                          setEditingStaff({ ...editingStaff, permissions: perms });
                        }}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-slate-800">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={staffFormSubmitting}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer"
              >
                {staffFormSubmitting ? 'Saving Changes...' : 'Save Staff Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

