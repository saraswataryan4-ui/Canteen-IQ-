import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Info,
  Loader2,
  Minus,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  DiningTable,
  GroupOrderSession,
  GroupOrderStatus,
  MenuItem,
  Order,
  TableStatus,
} from '../types';
import { ResilientImage } from './ResilientImage';

interface GroupOrderPageProps {
  menuItems: MenuItem[];
  tables: DiningTable[];
  groupOrders: GroupOrderSession[];
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string) => void;
  onCreateGroupOrder: (payload: {
    organizerName: string;
    organizerRollNumber: string;
    title: string;
  }) => GroupOrderSession;
  onJoinGroupOrderByCode: (payload: {
    code: string;
    participantName: string;
  }) => {
    ok: boolean;
    group?: GroupOrderSession;
    participantId?: string;
    error?: string;
  };
  onUpdateParticipantItem: (payload: {
    groupId: string;
    participantId: string;
    menuItemId: string;
    nextQuantity: number;
  }) => { ok: boolean; error?: string };
  onRemoveParticipant: (groupId: string, participantId: string) => void;
  onUpdateGroupMetadata: (
    groupId: string,
    updates: { tableId?: string; notes?: string }
  ) => void;
  onConfirmGroupOrder: (groupId: string) => {
    ok: boolean;
    order?: Order;
    error?: string;
  };
  onTrackOrder: (token: string) => void;
}

export const GroupOrderPage: React.FC<GroupOrderPageProps> = ({
  menuItems,
  tables,
  groupOrders,
  selectedGroupId,
  onSelectGroup,
  onCreateGroupOrder,
  onJoinGroupOrderByCode,
  onUpdateParticipantItem,
  onRemoveParticipant,
  onUpdateGroupMetadata,
  onConfirmGroupOrder,
  onTrackOrder,
}) => {
  // Create Group Form State
  const [organizerName, setOrganizerName] = useState('');
  const [organizerRoll, setOrganizerRoll] = useState('');
  const [groupTitle, setGroupTitle] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Join by Code Form State
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinFriendName, setJoinFriendName] = useState('');
  const [joinFeedback, setJoinFeedback] = useState<{
    type: 'error' | 'success';
    message: string;
  } | null>(null);

  // Active Group Workspace State
  const activeGroup = useMemo(() => {
    if (selectedGroupId) {
      const found = groupOrders.find((g) => g.id === selectedGroupId);
      if (found) return found;
    }
    return groupOrders[0] ?? null;
  }, [groupOrders, selectedGroupId]);

  const [activeParticipantId, setActiveParticipantId] = useState<string>(
    () => activeGroup?.participants[0]?.id ?? ''
  );
  const [quickFriendName, setQuickFriendName] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [itemError, setItemError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isOrganizerReviewOpen, setIsOrganizerReviewOpen] = useState(false);
  const [isConfirmingGroup, setIsConfirmingGroup] = useState(false);

  // Keep activeParticipantId synchronized with the selected group's participants
  useEffect(() => {
    if (!activeGroup) {
      setActiveParticipantId('');
      return;
    }
    const exists = activeGroup.participants.some(
      (p) => p.id === activeParticipantId
    );
    if (!exists) {
      setActiveParticipantId(activeGroup.participants[0]?.id ?? '');
    }
  }, [activeGroup, activeParticipantId]);

  const activeParticipant = useMemo(() => {
    if (!activeGroup) return null;
    return (
      activeGroup.participants.find((p) => p.id === activeParticipantId) ??
      activeGroup.participants[0] ??
      null
    );
  }, [activeGroup, activeParticipantId]);

  // Compute total quantity per menuItemId across ALL participants in activeGroup
  const groupItemTotalsMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (!activeGroup) return map;
    for (const part of activeGroup.participants) {
      for (const entry of part.items) {
        if (entry.quantity > 0) {
          map[entry.menuItemId] = (map[entry.menuItemId] ?? 0) + entry.quantity;
        }
      }
    }
    return map;
  }, [activeGroup]);

  // Compute detailed per-participant sub-orders & subtotals
  const detailedParticipants = useMemo(() => {
    if (!activeGroup) return [];
    return activeGroup.participants.map((part) => {
      const lines = part.items
        .filter((entry) => entry.quantity > 0)
        .map((entry) => {
          const menu = menuItems.find((m) => m.id === entry.menuItemId);
          if (!menu) return null;
          return {
            menuItemId: menu.id,
            name: menu.name,
            unitPrice: menu.price,
            quantity: entry.quantity,
            lineTotal: menu.price * entry.quantity,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
      const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);

      return {
        ...part,
        lines,
        subtotal,
        itemCount,
      };
    });
  }, [activeGroup, menuItems]);

  // Compute Combined Order Lines & Grand Total
  const combinedSummary = useMemo(() => {
    const aggregated: {
      menuItemId: string;
      name: string;
      unitPrice: number;
      quantity: number;
      lineTotal: number;
      prepMinutes: number;
    }[] = [];

    for (const menu of menuItems) {
      const qty = groupItemTotalsMap[menu.id] ?? 0;
      if (qty > 0) {
        aggregated.push({
          menuItemId: menu.id,
          name: menu.name,
          unitPrice: menu.price,
          quantity: qty,
          lineTotal: menu.price * qty,
          prepMinutes: menu.prepMinutes,
        });
      }
    }

    const totalItems = aggregated.reduce((sum, l) => sum + l.quantity, 0);
    const totalAmount = aggregated.reduce((sum, l) => sum + l.lineTotal, 0);
    const estimatedPrep =
      aggregated.length > 0
        ? Math.max(...aggregated.map((l) => l.prepMinutes)) + 3
        : 0;

    return {
      lines: aggregated,
      totalItems,
      totalAmount,
      estimatedPrep,
    };
  }, [menuItems, groupItemTotalsMap]);

  const openGroups = useMemo(
    () => groupOrders.filter((g) => g.status === GroupOrderStatus.Open),
    [groupOrders]
  );

  const selectableTables = useMemo(
    () =>
      tables.filter(
        (t) =>
          t.status === TableStatus.Available ||
          (t.status === TableStatus.Reserved && t.isCurrentUserReservation)
      ),
    [tables]
  );

  const handleCopyGroupCode = async (code: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
      }
    } catch {
      // Clipboard API may be restricted inside some sandboxed iframes
    }
    setCopiedCode(code);
    window.setTimeout(() => {
      setCopiedCode((prev) => (prev === code ? null : prev));
    }, 2200);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setConfirmError(null);
    setItemError(null);

    const trimmedOrganizer = organizerName.trim();
    const trimmedRoll = organizerRoll.trim();
    if (!trimmedOrganizer) {
      setCreateError('Please enter the organizer name to create a group order.');
      return;
    }

    const created = onCreateGroupOrder({
      organizerName: trimmedOrganizer,
      organizerRollNumber: trimmedRoll || 'CAMPUS',
      title: groupTitle.trim() || `${trimmedOrganizer}'s Group Order`,
    });

    onSelectGroup(created.id);
    if (created.participants[0]) {
      setActiveParticipantId(created.participants[0].id);
    }
    setIsOrganizerReviewOpen(false);
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setJoinFeedback(null);
    setConfirmError(null);
    setItemError(null);

    const result = onJoinGroupOrderByCode({
      code: joinCodeInput,
      participantName: joinFriendName,
    });

    if (!result.ok || !result.group) {
      setJoinFeedback({
        type: 'error',
        message:
          result.error ??
          'Unable to join group order. Check the group code and participant name.',
      });
      return;
    }

    onSelectGroup(result.group.id);
    if (result.participantId) {
      setActiveParticipantId(result.participantId);
    }
    setJoinFeedback({
      type: 'success',
      message: `${joinFriendName.trim()} joined ${result.group.code}. Select dishes from the menu below!`,
    });
    setJoinFriendName('');
    setIsOrganizerReviewOpen(false);
  };

  const handleQuickAddFriend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup || activeGroup.status !== GroupOrderStatus.Open) return;
    setItemError(null);

    const trimmed = quickFriendName.trim();
    if (!trimmed) {
      setItemError('Enter a friend name before adding them to this group.');
      return;
    }

    const result = onJoinGroupOrderByCode({
      code: activeGroup.code,
      participantName: trimmed,
    });

    if (!result.ok) {
      setItemError(result.error ?? 'Could not add participant.');
      return;
    }

    if (result.participantId) {
      setActiveParticipantId(result.participantId);
    }
    setQuickFriendName('');
  };

  const handleAdjustQuantity = (
    participantId: string,
    menuItemId: string,
    nextRawQuantity: number
  ) => {
    if (!activeGroup) return;
    setItemError(null);
    setConfirmError(null);

    if (!Number.isFinite(nextRawQuantity) || !Number.isInteger(nextRawQuantity)) {
      setItemError('Quantity must be a whole number (0 or greater).');
      return;
    }

    if (nextRawQuantity < 0) {
      setItemError('Invalid quantity: negative item counts are not allowed.');
      return;
    }

    const result = onUpdateParticipantItem({
      groupId: activeGroup.id,
      participantId,
      menuItemId,
      nextQuantity: nextRawQuantity,
    });

    if (!result.ok && result.error) {
      setItemError(result.error);
    }
  };

  const handleOrganizerConfirm = () => {
    if (!activeGroup || isConfirmingGroup) return;
    setConfirmError(null);
    setItemError(null);

    if (combinedSummary.totalItems <= 0) {
      setConfirmError(
        'Cannot confirm an empty group order. Add at least one item from the menu first.'
      );
      return;
    }

    const groupIdToConfirm = activeGroup.id;
    setIsConfirmingGroup(true);

    window.setTimeout(() => {
      const result = onConfirmGroupOrder(groupIdToConfirm);
      setIsConfirmingGroup(false);

      if (!result.ok) {
        setConfirmError(
          result.error ??
            'Could not confirm this group order. Please check items.'
        );
        return;
      }
      setIsOrganizerReviewOpen(false);
    }, 200);
  };

  const organizerParticipant = activeGroup?.participants.find(
    (p) => p.isOrganizer
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-emerald-700">
            Student Dining · Shared Campus Group Ordering
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
            Group Ordering with Friends
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            Create a group order to generate a unique group code, let friends
            join and add their own menu items separately, and confirm the
            combined order under a single pickup token.
          </p>
        </div>

        <div className="text-xs font-medium text-slate-600 tabular-nums">
          <span>{openGroups.length} Open Group Lobby</span>
          <span className="mx-2 text-slate-300" aria-hidden="true">
            ·
          </span>
          <span>
            {groupOrders.length - openGroups.length} Confirmed Group Orders
          </span>
        </div>
      </div>

      {/* Group Ordering Instructions */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5 text-xs text-slate-600">
        <Info className="w-4 h-4 shrink-0 text-emerald-700 mt-0.5" />
        <p>
          <span className="font-semibold text-slate-900">
            Group Ordering Instructions:
          </span>{' '}
          Share your unique group code (<span className="font-mono">GRP-xxxx</span>) with
          friends so they can add their dishes. Each friend&apos;s share is calculated individually, and the organizer confirms the final combined order.
        </p>
      </div>

      {/* Section 1: Create a Demo Group Order OR Join by Unique Group Code */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card A: Create Group Order */}
        <form
          onSubmit={handleCreateSubmit}
          className="border border-slate-200 rounded-xl bg-white p-6 space-y-4"
        >
          <div className="space-y-1">
            <p className="text-xs font-semibold text-emerald-700">
              01. Start as Organizer
            </p>
            <h2 className="text-lg font-bold text-slate-950">
              Create a New Group Order
            </h2>
            <p className="text-xs text-slate-500">
              Generates a unique group code that campus friends can enter to add
              their items.
            </p>
          </div>

          {createError && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-800"
            >
              {createError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="group-organizer-name"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Organizer Name
              </label>
              <input
                id="group-organizer-name"
                type="text"
                required
                value={organizerName}
                onChange={(e) => setOrganizerName(e.target.value)}
                placeholder="e.g., Ananya Sharma"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="group-organizer-roll"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Campus ID / Roll No.
              </label>
              <input
                id="group-organizer-roll"
                type="text"
                required
                value={organizerRoll}
                onChange={(e) => setOrganizerRoll(e.target.value)}
                placeholder="e.g., CS25B031"
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="group-title-input"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Group Order Label (Optional)
            </label>
            <input
              id="group-title-input"
              type="text"
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              placeholder="e.g., Robotics Team Evening Snacks"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
          >
            <Users className="w-4 h-4" />
            <span>Create Group Order &amp; Generate Code</span>
          </button>
        </form>

        {/* Card B: Join Existing Group Order via Unique Code */}
        <form
          onSubmit={handleJoinSubmit}
          className="border border-slate-200 rounded-xl bg-white p-6 space-y-4 flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-emerald-700">
                02. Join as a Friend
              </p>
              <h2 className="text-lg font-bold text-slate-950">
                Join Group Order with Code
              </h2>
              <p className="text-xs text-slate-500">
                Enter an open group code (such as{' '}
                <span className="font-mono font-semibold text-slate-700">
                  {openGroups[0]?.code ?? 'GRP-4821'}
                </span>
                ) and a friend&apos;s name to add their dishes separately.
              </p>
            </div>

            {joinFeedback && (
              <div
                role="status"
                className={`p-3 rounded-lg border text-xs font-medium ${
                  joinFeedback.type === 'error'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}
              >
                {joinFeedback.message}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="join-group-code"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Unique Group Code
                </label>
                <input
                  id="join-group-code"
                  type="text"
                  required
                  value={joinCodeInput}
                  onChange={(e) =>
                    setJoinCodeInput(e.target.value.toUpperCase())
                  }
                  placeholder="e.g., GRP-4821"
                  className="w-full px-3 py-2 text-sm font-mono uppercase bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label
                  htmlFor="join-friend-name"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Friend / Participant Name
                </label>
                <input
                  id="join-friend-name"
                  type="text"
                  required
                  value={joinFriendName}
                  onChange={(e) => setJoinFriendName(e.target.value)}
                  placeholder="e.g., Dev Patel"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            {openGroups.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>Active group codes:</span>
                {openGroups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setJoinCodeInput(g.code)}
                    className="font-mono font-semibold text-emerald-800 hover:text-emerald-950 underline underline-offset-2 cursor-pointer"
                  >
                    {g.code}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 inline-flex items-center justify-center gap-2 text-sm font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Join Group Order</span>
          </button>
        </form>
      </div>

      {/* Session Group Switcher (when 2+ group orders exist) */}
      {groupOrders.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600">
            Select Group Session ({groupOrders.length})
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {groupOrders.map((grp) => {
              const isSelected = activeGroup?.id === grp.id;
              return (
                <button
                  key={grp.id}
                  type="button"
                  onClick={() => {
                    onSelectGroup(grp.id);
                    setConfirmError(null);
                    setItemError(null);
                    setIsOrganizerReviewOpen(false);
                  }}
                  className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-700 text-white border-emerald-700 font-semibold'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-mono">{grp.code}</span>
                  <span> · {grp.title}</span>
                  <span>
                    {' '}
                    ({grp.status === GroupOrderStatus.Confirmed
                      ? `Confirmed ${grp.confirmedOrderToken ?? ''}`
                      : `${grp.participants.length} joined`})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 2: Active Group Workspace */}
      {activeGroup && (
        <div className="space-y-8 pt-2">
          {/* Active Group Code & Organizer Header Strip */}
          <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs text-slate-500">
                Active Group Session · Created at {activeGroup.createdAt} ·
                Organizer: {activeGroup.organizerName} (
                <span className="font-mono">
                  {activeGroup.organizerRollNumber}
                </span>
                )
              </p>
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-950">
                  {activeGroup.title}
                </h2>
                <span className="text-xs font-semibold text-emerald-800">
                  Status:{' '}
                  {activeGroup.status === GroupOrderStatus.Confirmed
                    ? `Confirmed (Token ${activeGroup.confirmedOrderToken})`
                    : 'Open for Participants'}
                </span>
              </div>
            </div>

            {/* Unique Shareable Group Code Display */}
            <div className="flex items-center gap-3 shrink-0 bg-white border border-slate-300 rounded-xl px-4 py-3">
              <div>
                <p className="text-[11px] text-slate-500">Unique Group Code</p>
                <p className="text-xl font-bold font-mono tabular-nums text-emerald-950 tracking-tight">
                  {activeGroup.code}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCopyGroupCode(activeGroup.code)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                {copiedCode === activeGroup.code ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-600" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* CONFIRMED STATE: Show Group Order Token & Participant Breakdown */}
          {activeGroup.status === GroupOrderStatus.Confirmed ? (
            <div className="border border-emerald-300 bg-emerald-50/40 rounded-xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-emerald-200">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                    <span>Combined Group Order Confirmed</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Group Code{' '}
                    <span className="font-mono font-semibold text-slate-900">
                      {activeGroup.code}
                    </span>{' '}
                    has been sent to the Staff Dashboard queue under a unified
                    group pickup token.
                  </p>
                </div>

                <div className="sm:text-right">
                  <p className="text-xs text-slate-500">Group Order Token</p>
                  <p className="text-3xl font-bold font-mono tabular-nums text-emerald-950">
                    {activeGroup.confirmedOrderToken}
                  </p>
                </div>
              </div>

              {/* Participant Breakdown & Combined Summary Side by Side */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 space-y-3">
                  <h3 className="text-sm font-bold text-slate-900">
                    Each Participant&apos;s Items ({detailedParticipants.length}{' '}
                    Participants)
                  </h3>
                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white">
                    {detailedParticipants.map((part) => (
                      <div key={part.id} className="p-4 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-slate-900">
                            {part.name}{' '}
                            <span className="text-xs font-normal text-slate-500">
                              · {part.isOrganizer ? 'Organizer' : 'Friend'}
                            </span>
                          </span>
                          <span className="font-mono font-semibold text-slate-900 tabular-nums">
                            ₹{part.subtotal}
                          </span>
                        </div>
                        {part.lines.length === 0 ? (
                          <p className="text-xs text-slate-400">
                            No items ordered
                          </p>
                        ) : (
                          <ul className="space-y-1 text-xs text-slate-600 tabular-nums">
                            {part.lines.map((line) => (
                              <li
                                key={line.menuItemId}
                                className="flex justify-between"
                              >
                                <span>
                                  {line.quantity}× {line.name}
                                </span>
                                <span className="font-mono">
                                  ₹{line.lineTotal}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-5 space-y-4">
                  <div className="border border-slate-200 rounded-xl bg-white p-5 space-y-4">
                    <h3 className="text-sm font-bold text-slate-900">
                      Combined Kitchen Ticket
                    </h3>
                    <div className="divide-y divide-slate-100 text-sm">
                      {combinedSummary.lines.map((line) => (
                        <div
                          key={line.menuItemId}
                          className="py-2 flex justify-between tabular-nums"
                        >
                          <span className="text-slate-700">
                            <span className="font-mono font-semibold text-emerald-800 mr-1.5">
                              {line.quantity}×
                            </span>
                            {line.name}
                          </span>
                          <span className="font-mono font-medium text-slate-900">
                            ₹{line.lineTotal}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-3 border-t border-slate-200 flex justify-between text-base font-bold text-slate-950 tabular-nums">
                      <span>Combined Demo Total</span>
                      <span className="font-mono text-emerald-800">
                        ₹{combinedSummary.totalAmount}
                      </span>
                    </div>
                  </div>

                  {activeGroup.confirmedOrderToken && (
                    <button
                      type="button"
                      onClick={() =>
                        onTrackOrder(activeGroup.confirmedOrderToken!)
                      }
                      className="w-full py-3 px-4 inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
                    >
                      <span>
                        Track Group Order ({activeGroup.confirmedOrderToken})
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* OPEN STATE: Participant Picker + Menu Builder + Separate Participant Lists + Combined Review */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left 7 Columns: Participant Selector, Menu Item Adder & Separate Participant Breakdown */}
              <div className="lg:col-span-7 space-y-8">
                {/* Step A: Active Participant Selector & Quick Friend Join */}
                <div className="border border-slate-200 rounded-xl bg-white p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-950">
                        Who Is Adding Items Right Now?
                      </h3>
                      <p className="text-xs text-slate-500">
                        Switch between the organizer and joined friends to add
                        each person&apos;s items separately.
                      </p>
                    </div>
                    <span className="text-xs font-mono text-slate-500 tabular-nums">
                      {activeGroup.participants.length}{' '}
                      {activeGroup.participants.length === 1
                        ? 'Participant'
                        : 'Participants'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {detailedParticipants.map((part) => {
                      const isCurrent = activeParticipant?.id === part.id;
                      return (
                        <button
                          key={part.id}
                          type="button"
                          onClick={() => {
                            setActiveParticipantId(part.id);
                            setItemError(null);
                          }}
                          className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                            isCurrent
                              ? 'bg-emerald-700 text-white border-emerald-700 font-semibold'
                              : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <span>{part.name}</span>
                          <span className="opacity-85">
                            {' '}
                            · {part.isOrganizer ? 'Organizer' : 'Friend'} (₹
                            {part.subtotal})
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Quick inline friend adder for single-screen demo convenience */}
                  <form
                    onSubmit={handleQuickAddFriend}
                    className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
                  >
                    <input
                      type="text"
                      value={quickFriendName}
                      onChange={(e) => setQuickFriendName(e.target.value)}
                      placeholder={`Simulate another friend joining ${activeGroup.code} (e.g., Neha Gupta)`}
                      aria-label="Add friend to current group order"
                      className="flex-1 px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      + Add Friend to {activeGroup.code}
                    </button>
                  </form>
                </div>

                {/* Step B: Add Menu Items for Active Participant */}
                {activeParticipant && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                      <h3 className="text-base font-bold text-slate-950">
                        Add Menu Items for{' '}
                        <span className="text-emerald-800">
                          {activeParticipant.name}
                        </span>
                      </h3>
                      <span className="text-xs text-slate-500">
                        Sample Campus Menu · Quantities validated against sample
                        demo stock
                      </span>
                    </div>

                    {itemError && (
                      <div
                        role="alert"
                        className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-800"
                      >
                        {itemError}
                      </div>
                    )}

                    <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white overflow-hidden">
                      {menuItems.map((item) => {
                        const myCurrentQty =
                          activeParticipant.items.find(
                            (i) => i.menuItemId === item.id
                          )?.quantity ?? 0;
                        const totalGroupQty = groupItemTotalsMap[item.id] ?? 0;
                        const otherParticipantsQty =
                          totalGroupQty - myCurrentQty;
                        const maxAllowedForMe = item.isAvailable
                          ? Math.max(0, item.stock - otherParticipantsQty)
                          : 0;
                        const isUnavailable =
                          !item.isAvailable || item.stock <= 0;

                        return (
                          <div
                            key={item.id}
                            className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div className="w-14 h-14 rounded-lg overflow-hidden bg-stone-100 border border-slate-200 shrink-0">
                                <ResilientImage
                                  src={item.imageUrl}
                                  alt={item.name}
                                  fallbackTitle={item.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="min-w-0 space-y-0.5">
                                <div className="flex items-baseline gap-2">
                                  <p className="text-sm font-bold text-slate-950 truncate">
                                    {item.name}
                                  </p>
                                  <span className="text-sm font-bold font-mono text-emerald-800 tabular-nums">
                                    ₹{item.price}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 tabular-nums">
                                  {item.category} · ~{item.prepMinutes} mins ·{' '}
                                  {isUnavailable
                                    ? 'Out of stock'
                                    : `${Math.max(
                                        0,
                                        item.stock - totalGroupQty
                                      )} left in demo stock`}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 shrink-0">
                              {isUnavailable && myCurrentQty === 0 ? (
                                <span className="text-xs font-semibold text-slate-400 px-3 py-1.5 bg-slate-100 rounded-lg">
                                  Unavailable
                                </span>
                              ) : myCurrentQty === 0 ? (
                                <button
                                  type="button"
                                  disabled={maxAllowedForMe <= 0}
                                  onClick={() =>
                                    handleAdjustQuantity(
                                      activeParticipant.id,
                                      item.id,
                                      1
                                    )
                                  }
                                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                                >
                                  {maxAllowedForMe <= 0
                                    ? 'Max Stock in Group'
                                    : `Add for ${
                                        activeParticipant.name.split(' ')[0]
                                      }`}
                                </button>
                              ) : (
                                <div className="inline-flex items-center gap-2">
                                  <div className="inline-flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleAdjustQuantity(
                                          activeParticipant.id,
                                          item.id,
                                          myCurrentQty - 1
                                        )
                                      }
                                      aria-label={`Decrease ${item.name} for ${activeParticipant.name}`}
                                      className="p-2 text-slate-700 hover:bg-slate-100 cursor-pointer"
                                    >
                                      <Minus className="w-3.5 h-3.5" />
                                    </button>
                                    <input
                                      type="number"
                                      min={0}
                                      max={maxAllowedForMe}
                                      step={1}
                                      value={myCurrentQty}
                                      aria-label={`${item.name} quantity for ${activeParticipant.name}`}
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        if (raw === '') {
                                          handleAdjustQuantity(
                                            activeParticipant.id,
                                            item.id,
                                            0
                                          );
                                          return;
                                        }
                                        const parsed = Number(raw);
                                        handleAdjustQuantity(
                                          activeParticipant.id,
                                          item.id,
                                          parsed
                                        );
                                      }}
                                      className="w-12 text-center text-xs font-bold font-mono tabular-nums text-slate-950 focus:outline-none py-1.5"
                                    />
                                    <button
                                      type="button"
                                      disabled={myCurrentQty >= maxAllowedForMe}
                                      onClick={() =>
                                        handleAdjustQuantity(
                                          activeParticipant.id,
                                          item.id,
                                          myCurrentQty + 1
                                        )
                                      }
                                      aria-label={`Increase ${item.name} for ${activeParticipant.name}`}
                                      className="p-2 text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  <span className="text-xs font-mono font-semibold text-slate-700 tabular-nums w-12 text-right">
                                    ₹{myCurrentQty * item.price}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Step C: Display Each Participant's Items Separately */}
                <div className="space-y-4">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-base font-bold text-slate-950">
                      Individual Participant Breakdown
                    </h3>
                    <span className="text-xs text-slate-500">
                      Each friend&apos;s selections &amp; individual share
                    </span>
                  </div>

                  <div className="space-y-3">
                    {detailedParticipants.map((part) => {
                      const isCurrent = activeParticipant?.id === part.id;
                      return (
                        <div
                          key={part.id}
                          className={`border rounded-xl p-4 space-y-3 transition-colors ${
                            isCurrent
                              ? 'border-emerald-600 bg-emerald-50/30'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-bold text-slate-950">
                                {part.name}
                              </span>
                              <span className="text-xs text-slate-500">
                                ·{' '}
                                {part.isOrganizer
                                  ? 'Group Organizer'
                                  : `Joined at ${part.joinedAt}`}
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold font-mono text-emerald-800 tabular-nums">
                                Share: ₹{part.subtotal}
                              </span>

                              {!isCurrent && (
                                <button
                                  type="button"
                                  onClick={() => setActiveParticipantId(part.id)}
                                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-950 underline underline-offset-2 cursor-pointer"
                                >
                                  Edit Items
                                </button>
                              )}

                              {!part.isOrganizer && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onRemoveParticipant(activeGroup.id, part.id)
                                  }
                                  aria-label={`Remove participant ${part.name}`}
                                  className="p-1 text-slate-400 hover:text-red-600 rounded-md cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {part.lines.length === 0 ? (
                            <p className="text-xs text-slate-500">
                              No items added by {part.name} yet.
                            </p>
                          ) : (
                            <div className="divide-y divide-slate-100 border-t border-slate-200/80 pt-2">
                              {part.lines.map((line) => (
                                <div
                                  key={line.menuItemId}
                                  className="py-2 flex items-center justify-between gap-3 text-xs sm:text-sm tabular-nums"
                                >
                                  <div className="text-slate-800">
                                    <span className="font-mono font-semibold text-emerald-800 mr-1.5">
                                      {line.quantity}×
                                    </span>
                                    <span className="font-medium">
                                      {line.name}
                                    </span>
                                    <span className="text-xs text-slate-400 font-mono ml-1.5">
                                      (₹{line.unitPrice} each)
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <div className="inline-flex items-center border border-slate-300 rounded-md overflow-hidden bg-white">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleAdjustQuantity(
                                            part.id,
                                            line.menuItemId,
                                            line.quantity - 1
                                          )
                                        }
                                        aria-label={`Decrease ${line.name} for ${part.name}`}
                                        className="px-1.5 py-1 text-slate-600 hover:bg-slate-100 cursor-pointer"
                                      >
                                        <Minus className="w-3 h-3" />
                                      </button>
                                      <span className="px-2 text-xs font-mono font-semibold text-slate-900">
                                        {line.quantity}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleAdjustQuantity(
                                            part.id,
                                            line.menuItemId,
                                            line.quantity + 1
                                          )
                                        }
                                        aria-label={`Increase ${line.name} for ${part.name}`}
                                        className="px-1.5 py-1 text-slate-600 hover:bg-slate-100 cursor-pointer"
                                      >
                                        <Plus className="w-3 h-3" />
                                      </button>
                                    </div>

                                    <span className="font-mono font-semibold text-slate-900 w-12 text-right">
                                      ₹{line.lineTotal}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right 5 Columns: Combined Order Summary & Organizer Review/Confirmation */}
              <div className="lg:col-span-5">
                <div className="border border-slate-200 rounded-xl bg-white p-6 space-y-6">
                  <div className="space-y-1 border-b border-slate-200 pb-4">
                    <p className="text-xs font-medium text-emerald-700">
                      Unified Kitchen Ticket · {activeGroup.code}
                    </p>
                    <h3 className="text-lg font-bold text-slate-950">
                      Combined Group Order
                    </h3>
                  </div>

                  {confirmError && (
                    <div
                      role="alert"
                      className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-800"
                    >
                      {confirmError}
                    </div>
                  )}

                  {/* Combined Aggregated Items */}
                  {combinedSummary.lines.length === 0 ? (
                    <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1.5">
                      <p className="text-sm font-semibold text-slate-900">
                        Combined Group Order Is Empty
                      </p>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Have the organizer or joined friends add at least one
                        menu item on the left. Empty group orders cannot be
                        confirmed.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-semibold text-slate-500">
                          <span>Combined Menu Items</span>
                          <span className="font-mono tabular-nums">
                            {combinedSummary.totalItems} total portions
                          </span>
                        </div>

                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl px-4 py-1 bg-slate-50/60">
                          {combinedSummary.lines.map((line) => (
                            <div
                              key={line.menuItemId}
                              className="py-2.5 flex items-center justify-between text-sm tabular-nums"
                            >
                              <div className="text-slate-800">
                                <span className="font-mono font-bold text-emerald-800 mr-2">
                                  {line.quantity}×
                                </span>
                                <span className="font-medium">{line.name}</span>
                                <span className="text-xs text-slate-400 font-mono ml-1.5">
                                  (₹{line.unitPrice})
                                </span>
                              </div>
                              <span className="font-mono font-semibold text-slate-950">
                                ₹{line.lineTotal}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Participant Share Split Summary */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-200 text-xs">
                        <p className="font-semibold text-slate-600">
                          Split by Participant
                        </p>
                        {detailedParticipants.map((part) => (
                          <div
                            key={part.id}
                            className="flex justify-between text-slate-600 tabular-nums"
                          >
                            <span>
                              {part.name}
                              {part.isOrganizer ? ' (Organizer)' : ''}
                            </span>
                            <span className="font-mono font-medium text-slate-900">
                              ₹{part.subtotal}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Optional Dining Preference & Group Note */}
                  <div className="space-y-3 pt-3 border-t border-slate-200">
                    <div>
                      <label
                        htmlFor="group-dining-table"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        Group Pickup / Seating (Optional)
                      </label>
                      <select
                        id="group-dining-table"
                        value={activeGroup.tableId ?? ''}
                        onChange={(e) =>
                          onUpdateGroupMetadata(activeGroup.id, {
                            tableId: e.target.value || undefined,
                          })
                        }
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 cursor-pointer"
                      >
                        <option value="">
                          Express Counter Pickup (Group Tray)
                        </option>
                        {selectableTables.map((t) => (
                          <option key={t.id} value={t.label}>
                            {t.label} ({t.capacity} seats · {t.zone})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="group-kitchen-note"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        Group Kitchen Note (Optional)
                      </label>
                      <input
                        id="group-kitchen-note"
                        type="text"
                        value={activeGroup.notes ?? ''}
                        onChange={(e) =>
                          onUpdateGroupMetadata(activeGroup.id, {
                            notes: e.target.value,
                          })
                        }
                        placeholder="e.g., Extra paper cups, label items"
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                  </div>

                  {/* Automatic Total Calculation */}
                  <div className="pt-4 border-t border-slate-200 space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-500 tabular-nums">
                      <span>Estimated Group Prep Time</span>
                      <span className="font-mono">
                        {combinedSummary.totalItems > 0
                          ? `~${combinedSummary.estimatedPrep} mins`
                          : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline text-lg font-bold text-slate-950 tabular-nums">
                      <span>Combined Total</span>
                      <span className="font-mono text-emerald-800 text-xl">
                        ₹{combinedSummary.totalAmount}
                      </span>
                    </div>
                  </div>

                  {/* Organizer Review & Confirm Gate */}
                  {activeParticipant && !activeParticipant.isOrganizer ? (
                    <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-3">
                      <p className="text-xs text-amber-950 leading-relaxed">
                        You are currently adding items as{' '}
                        <span className="font-semibold">
                          {activeParticipant.name}
                        </span>
                        . Only the Group Organizer (
                        <span className="font-semibold">
                          {activeGroup.organizerName}
                        </span>
                        ) can review and confirm the combined group order.
                      </p>
                      {organizerParticipant && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveParticipantId(organizerParticipant.id);
                            setIsOrganizerReviewOpen(true);
                          }}
                          className="w-full py-2.5 px-4 text-xs font-semibold text-amber-950 bg-white border border-amber-300 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
                        >
                          Switch to Organizer ({activeGroup.organizerName}) to
                          Review
                        </button>
                      )}
                    </div>
                  ) : !isOrganizerReviewOpen ? (
                    <button
                      type="button"
                      disabled={combinedSummary.totalItems <= 0}
                      onClick={() => {
                        setConfirmError(null);
                        setIsOrganizerReviewOpen(true);
                      }}
                      className="w-full py-3 px-4 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 rounded-lg transition-colors cursor-pointer"
                    >
                      {combinedSummary.totalItems <= 0
                        ? 'Add Items to Review Group Order'
                        : `Organizer Review Combined Order (₹${combinedSummary.totalAmount})`}
                    </button>
                  ) : (
                    <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-emerald-950">
                          Organizer Final Review · {activeGroup.organizerName}
                        </p>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Confirming will lock{' '}
                          <span className="font-mono font-semibold">
                            {activeGroup.code}
                          </span>{' '}
                          ({detailedParticipants.length} participants,{' '}
                          {combinedSummary.totalItems} items, ₹
                          {combinedSummary.totalAmount} total), generate a
                          group order token, and send it to the Staff Dashboard.
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          disabled={
                            combinedSummary.totalItems <= 0 || isConfirmingGroup
                          }
                          onClick={handleOrganizerConfirm}
                          className="flex-1 py-2.5 px-4 inline-flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-600/80 rounded-lg transition-colors cursor-pointer disabled:cursor-wait"
                        >
                          {isConfirmingGroup ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Confirming Group Order...</span>
                            </>
                          ) : (
                            <span>
                              Confirm Group Order · ₹{combinedSummary.totalAmount}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={isConfirmingGroup}
                          onClick={() => setIsOrganizerReviewOpen(false)}
                          className="py-2.5 px-3.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                        >
                          Keep Editing
                        </button>
                      </div>
                    </div>
                  )}

                  <p className="text-[11px] text-slate-500 text-center">
                    Demo Checkout · No real payment is processed when confirming
                    a group order.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
