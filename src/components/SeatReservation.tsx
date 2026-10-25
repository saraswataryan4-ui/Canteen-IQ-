import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  Lock,
  Users,
  XCircle,
} from 'lucide-react';
import { DiningTable, TableStatus } from '../types';
import { DEMO_RESERVATION_SLOTS } from '../data/demoData';

export interface ConfirmedReservationReceipt {
  reservationId: string;
  tableId: string;
  tableLabel: string;
  timeSlot: string;
  studentName: string;
  partySize: number;
}

interface SeatReservationProps {
  tables: DiningTable[];
  onConfirmReservation: (payload: {
    tableId: string;
    studentName: string;
    timeSlot: string;
    partySize: number;
  }) => ConfirmedReservationReceipt | null;
  onCancelStudentReservation: (tableId: string) => void;
}

export const SeatReservation: React.FC<SeatReservationProps> = ({
  tables,
  onConfirmReservation,
  onCancelStudentReservation,
}) => {
  const availableTables = useMemo(
    () => tables.filter((t) => t.status === TableStatus.Available),
    [tables]
  );

  const [selectedTableId, setSelectedTableId] = useState<string>(
    () => availableTables[0]?.id ?? ''
  );
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>(
    DEMO_RESERVATION_SLOTS[1]
  );
  const [studentName, setStudentName] = useState('');
  const [partySize, setPartySize] = useState<number>(2);
  const [latestReceipt, setLatestReceipt] =
    useState<ConfirmedReservationReceipt | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // Keep selectedTableId pointing to a valid Available table when availability changes
  useEffect(() => {
    const currentlySelected = tables.find((t) => t.id === selectedTableId);
    if (
      !currentlySelected ||
      currentlySelected.status !== TableStatus.Available
    ) {
      setSelectedTableId(availableTables[0]?.id ?? '');
    }
  }, [tables, availableTables, selectedTableId]);

  const selectedTable = useMemo(
    () =>
      tables.find(
        (t) => t.id === selectedTableId && t.status === TableStatus.Available
      ) ?? null,
    [tables, selectedTableId]
  );

  // Clamp party size when switching to a smaller table
  useEffect(() => {
    if (selectedTable && partySize > selectedTable.capacity) {
      setPartySize(selectedTable.capacity);
    }
  }, [selectedTable, partySize]);

  const statusCounts = useMemo(() => {
    const available = tables.filter(
      (t) => t.status === TableStatus.Available
    ).length;
    const occupied = tables.filter(
      (t) => t.status === TableStatus.Occupied
    ).length;
    const reserved = tables.filter(
      (t) => t.status === TableStatus.Reserved
    ).length;
    return { available, occupied, reserved };
  }, [tables]);

  const mySessionReservations = useMemo(
    () =>
      tables.filter(
        (t) =>
          t.status === TableStatus.Reserved && Boolean(t.isCurrentUserReservation)
      ),
    [tables]
  );

  const handleSelectAvailableTable = (table: DiningTable) => {
    if (table.status !== TableStatus.Available) return;
    setValidationError(null);
    setLatestReceipt(null);
    setSelectedTableId(table.id);
    if (partySize > table.capacity) {
      setPartySize(table.capacity);
    }
  };

  const handleReservationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isConfirming) return;
    setValidationError(null);

    if (!selectedTable || selectedTable.status !== TableStatus.Available) {
      setValidationError(
        'Please select an Available table. Occupied or Reserved tables cannot be booked.'
      );
      return;
    }

    const cleanName = studentName.trim();
    if (!cleanName) {
      setValidationError('Please enter your student name for the reservation.');
      return;
    }

    setIsConfirming(true);
    const tableIdToBook = selectedTable.id;
    const clampedParty = Math.min(Math.max(1, partySize), selectedTable.capacity);
    const slotToBook = selectedTimeSlot;

    window.setTimeout(() => {
      const receipt = onConfirmReservation({
        tableId: tableIdToBook,
        studentName: cleanName,
        timeSlot: slotToBook,
        partySize: clampedParty,
      });

      setIsConfirming(false);

      if (!receipt) {
        setValidationError(
          'That table is no longer available. Please select an Available table.'
        );
        return;
      }

      setLatestReceipt(receipt);
    }, 180);
  };

  const handleCancelClick = (tableId: string) => {
    onCancelStudentReservation(tableId);
    if (latestReceipt && latestReceipt.tableId === tableId) {
      setLatestReceipt(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header & Illustrative Demo Disclaimer */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-emerald-700">
            Student Dining · Table Reservation
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
            Campus Canteen Table Reservation
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            Select an available table and reservation time slot, review your
            booking summary, and confirm to receive a unique reservation ID.
          </p>
        </div>

        {/* Status Summary Legend */}
        <div className="flex flex-wrap items-center gap-5 text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5 text-emerald-700 tabular-nums">
            <CheckCircle2 className="w-4 h-4" />
            <span>Available ({statusCounts.available})</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-600 tabular-nums">
            <Lock className="w-4 h-4 text-slate-400" />
            <span>Occupied ({statusCounts.occupied})</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-amber-800 tabular-nums">
            <CalendarClock className="w-4 h-4 text-amber-700" />
            <span>Reserved ({statusCounts.reserved})</span>
          </span>
        </div>
      </div>

      {/* Table Reservation Guidelines */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5 text-xs text-slate-600">
        <Info className="w-4 h-4 shrink-0 text-emerald-700 mt-0.5" />
        <p>
          <span className="font-semibold text-slate-900">
            Reservation Guidelines:
          </span>{' '}
          Reserved tables are held for 15 minutes past the booking slot. Please check in with canteen staff or proceed directly to your numbered table.
        </p>
      </div>

      {/* My Active Session Reservations Strip (Supports Full Cancellation Flow) */}
      {mySessionReservations.length > 0 && (
        <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-emerald-950">
              Your Active Reservations ({mySessionReservations.length})
            </h2>
            <span className="text-xs text-emerald-800">
              Synced with Staff Dashboard
            </span>
          </div>

          <div className="divide-y divide-emerald-200/70">
            {mySessionReservations.map((res) => (
              <div
                key={res.id}
                className="py-3 first:pt-1 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-0.5 text-sm">
                  <p className="font-semibold text-slate-900">
                    <span className="font-mono text-emerald-900 mr-2">
                      {res.reservationId}
                    </span>
                    · {res.label} ({res.partySize ?? res.capacity}{' '}
                    {(res.partySize ?? res.capacity) === 1 ? 'Guest' : 'Guests'})
                  </p>
                  <p className="text-xs text-slate-600">
                    Time Slot: <span className="font-medium">{res.timeSlot}</span>{' '}
                    · Booked by {res.occupantName} · Status:{' '}
                    <span className="font-semibold text-amber-800">
                      {res.status}
                    </span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleCancelClick(res.id)}
                  className="px-3.5 py-2 text-xs font-semibold text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer w-fit"
                >
                  Cancel Reservation
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main 2-Column Layout: 4 Demo Tables (Left) + Booking Form & Summary (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: 4 Demo Tables (Table 01, Table 02, Table 03, Table 04) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-950">
              Select a Table ({tables.length} Tables)
            </h2>
            <span className="text-xs text-slate-500">
              Only Available tables can be selected
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {tables.map((table) => {
              const isAvailable = table.status === TableStatus.Available;
              const isOccupied = table.status === TableStatus.Occupied;
              const isReserved = table.status === TableStatus.Reserved;
              const isSelected = isAvailable && selectedTable?.id === table.id;

              return (
                <div
                  key={table.id}
                  className={`p-5 rounded-xl border flex flex-col justify-between space-y-5 transition-colors ${
                    isSelected
                      ? 'bg-emerald-50/50 border-emerald-600'
                      : isAvailable
                      ? 'bg-white border-slate-200 hover:border-emerald-400'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="space-y-2.5">
                    {/* Zone + Explicit Status Label */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-500">{table.zone}</span>

                      {isAvailable && (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Available</span>
                        </span>
                      )}

                      {isOccupied && (
                        <span className="inline-flex items-center gap-1 font-bold text-slate-600">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Occupied</span>
                        </span>
                      )}

                      {isReserved && (
                        <span className="inline-flex items-center gap-1 font-bold text-amber-800">
                          <CalendarClock className="w-3.5 h-3.5" />
                          <span>Reserved</span>
                        </span>
                      )}
                    </div>

                    {/* Table Title & Capacity */}
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-xl font-bold font-mono text-slate-950">
                        {table.label}
                      </h3>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 tabular-nums">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>Up to {table.capacity} Seats</span>
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {table.features}
                    </p>

                    {/* Occupant / Reservation Metadata if Unavailable */}
                    {!isAvailable && (
                      <div className="pt-2 text-xs text-slate-600 space-y-0.5">
                        {table.reservationId && (
                          <p className="font-mono font-semibold text-slate-800">
                            ID: {table.reservationId}
                            {table.isCurrentUserReservation
                              ? ' (Your Booking)'
                              : ''}
                          </p>
                        )}
                        {table.timeSlot && (
                          <p className="inline-flex items-center gap-1 text-slate-600">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>Slot: {table.timeSlot}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Footer Action: Enforces Prevention of Reserving Occupied/Reserved Tables */}
                  <div className="pt-3 border-t border-slate-200/80 space-y-2">
                    {isAvailable ? (
                      <button
                        type="button"
                        onClick={() => handleSelectAvailableTable(table)}
                        className={`w-full py-2.5 px-4 inline-flex items-center justify-center gap-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-700 text-white'
                            : 'bg-white text-emerald-800 border border-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Selected — {table.label}</span>
                          </>
                        ) : (
                          <span>Select {table.label}</span>
                        )}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled
                          className="w-full py-2.5 px-4 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-400 bg-slate-200/70 rounded-lg cursor-not-allowed whitespace-nowrap"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Unavailable ({table.status})</span>
                        </button>

                        {isReserved && table.isCurrentUserReservation && (
                          <button
                            type="button"
                            onClick={() => handleCancelClick(table.id)}
                            className="w-full py-2 px-3 text-xs font-semibold text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                          >
                            Cancel My Reservation
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Time Slot Selection, Pre-Confirmation Summary & Unique ID Receipt */}
        <div className="lg:col-span-5">
          {latestReceipt ? (
            <div className="border border-emerald-300 bg-emerald-50/40 rounded-xl p-6 space-y-6">
              <div className="text-center space-y-2 pb-4 border-b border-emerald-200">
                <CheckCircle2 className="w-10 h-10 text-emerald-700 mx-auto" />
                <p className="text-xs font-semibold text-emerald-800">
                  Seat Reservation Confirmed
                </p>
                <p className="text-xs text-slate-500">
                  Unique Reservation ID
                </p>
                <p className="text-3xl font-bold font-mono tabular-nums text-emerald-950 tracking-tight">
                  {latestReceipt.reservationId}
                </p>
              </div>

              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Reserved Table</span>
                  <span className="font-mono font-bold text-slate-950">
                    {latestReceipt.tableLabel}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Updated Table Status</span>
                  <span className="font-semibold text-amber-800">Reserved</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Time Slot</span>
                  <span className="font-medium text-slate-900">
                    {latestReceipt.timeSlot}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Student &amp; Party</span>
                  <span className="font-medium text-slate-900 tabular-nums">
                    {latestReceipt.studentName} ({latestReceipt.partySize}{' '}
                    {latestReceipt.partySize === 1 ? 'Guest' : 'Guests'})
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Notice: {latestReceipt.tableLabel} is now marked{' '}
                <span className="font-semibold text-slate-700">Reserved</span> on
                both the Student Floor Plan and the Staff Dashboard.
              </p>

              <div className="space-y-2.5 pt-1">
                {availableTables.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setLatestReceipt(null)}
                    className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
                  >
                    Reserve Another Available Table
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleCancelClick(latestReceipt.tableId)}
                  className="w-full py-2.5 px-4 text-sm font-semibold text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel Reservation ({latestReceipt.reservationId})
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleReservationSubmit}
              className="border border-slate-200 bg-white rounded-xl p-6 space-y-6"
            >
              <div className="space-y-1 border-b border-slate-200 pb-4">
                <p className="text-xs font-medium text-emerald-700">
                  Step-by-Step Booking
                </p>
                <h2 className="text-lg font-bold text-slate-950">
                  Configure &amp; Review Reservation
                </h2>
              </div>

              {validationError && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-800"
                >
                  {validationError}
                </div>
              )}

              {!selectedTable ? (
                <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
                  <p className="text-sm font-semibold text-slate-900">
                    No Available Tables Left
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    All tables are currently Occupied or Reserved. Cancel
                    an active reservation above or ask canteen staff to free a
                    table.
                  </p>
                </div>
              ) : (
                <>
                  {/* 1. Time Slot Picker */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      1. Select Reservation Time Slot
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {DEMO_RESERVATION_SLOTS.map((slot) => {
                        const active = selectedTimeSlot === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedTimeSlot(slot)}
                            className={`px-3.5 py-2.5 text-left text-xs sm:text-sm font-medium rounded-lg border flex items-center justify-between transition-colors cursor-pointer ${
                              active
                                ? 'bg-emerald-50 border-emerald-600 text-emerald-950 font-semibold'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <span className="font-mono tabular-nums">{slot}</span>
                            {active && (
                              <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Student Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="res-student-name"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        2. Student Name
                      </label>
                      <input
                        id="res-student-name"
                        type="text"
                        required
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="res-party-size"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        Guests (Max {selectedTable.capacity})
                      </label>
                      <select
                        id="res-party-size"
                        value={partySize}
                        onChange={(e) => setPartySize(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 cursor-pointer"
                      >
                        {Array.from(
                          { length: selectedTable.capacity },
                          (_, i) => i + 1
                        ).map((num) => (
                          <option key={num} value={num}>
                            {num} {num === 1 ? 'Student' : 'Students'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 3. Pre-Confirmation Reservation Summary */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <p className="text-xs font-bold text-slate-900">
                      Reservation Summary (Before Confirmation)
                    </p>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Selected Table</span>
                        <span className="font-mono font-bold text-slate-950">
                          {selectedTable.label} ({selectedTable.zone})
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Time Slot</span>
                        <span className="font-mono font-semibold text-slate-900">
                          {selectedTimeSlot}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Student &amp; Guests</span>
                        <span className="font-medium text-slate-900 tabular-nums">
                          {studentName.trim() || 'Campus Student'} · {partySize}{' '}
                          {partySize === 1 ? 'Guest' : 'Guests'}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600 pt-1.5 border-t border-slate-200">
                        <span>Booking Fee</span>
                        <span className="font-mono font-semibold text-emerald-700">
                          ₹0 (Free Campus Hold)
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isConfirming}
                    className="w-full py-3 px-4 inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-600/80 active:scale-[0.99] rounded-lg transition-all whitespace-nowrap cursor-pointer disabled:cursor-wait"
                  >
                    {isConfirming ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Confirming Reservation...</span>
                      </>
                    ) : (
                      <span>
                        Confirm Reservation — {selectedTable.label}
                      </span>
                    )}
                  </button>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
