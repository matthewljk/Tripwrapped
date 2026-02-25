'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { useTripParticipants } from '@/hooks/useTripParticipants';
import {
  EXPENSE_CATEGORIES,
  DEFAULT_CATEGORY_ID,
  type CategoryId,
} from '@/lib/transactionCategories';

const dataClient = generateClient<Schema>();

const CURRENCIES = ['USD', 'EUR', 'GBP', 'SGD', 'AUD', 'JPY', 'CAD', 'CHF', 'THB', 'MYR', 'IDR', 'PHP', 'VND'] as const;

export type TransactionFormProps = {
  activeTripId: string;
  baseCurrency: string | null;
  onSuccess: () => void;
  /** When true, show Cancel button (e.g. in modal) */
  showCancel?: boolean;
  onCancel?: () => void;
};

function displayParticipant(p: { userId: string; username: string | null }) {
  return p.username?.trim() || p.userId.slice(0, 8) || 'Someone';
}

function ParticipantAvatar({
  participant,
  selected,
  onToggle,
}: {
  participant: { userId: string; username: string | null };
  selected: boolean;
  onToggle: () => void;
}) {
  const name = displayParticipant(participant);
  const initial = (name[0] ?? '?').toUpperCase();
  return (
    <button
      type="button"
      onClick={onToggle}
      title={`${name}${selected ? ' (in split)' : ''}`}
      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
        selected
          ? 'bg-blue-600 text-white ring-2 ring-blue-600 ring-offset-2'
          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
      }`}
    >
      {initial}
    </button>
  );
}

export default function TransactionForm({
  activeTripId,
  baseCurrency,
  onSuccess,
  showCancel = false,
  onCancel,
}: TransactionFormProps) {
  const { participants, loading: loadingParticipants } = useTripParticipants(activeTripId);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(baseCurrency || '');
  const [description, setDescription] = useState('');
  const [transactionDate, setTransactionDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [categoryId, setCategoryId] = useState<CategoryId>(DEFAULT_CATEGORY_ID);
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [includedInSplit, setIncludedInSplit] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill currency from trip when still empty (e.g. after navigation), but never overwrite user's selection
  useEffect(() => {
    if (baseCurrency && !currency) setCurrency(baseCurrency);
  }, [baseCurrency, currency]);

  useEffect(() => {
    setIncludedInSplit(new Set(participants.map((p) => p.userId)));
  }, [participants]);

  // When switching to accommodation, default check-in to transaction date and check-out to next day (once)
  const prevCategoryRef = useRef<CategoryId>(categoryId);
  useEffect(() => {
    if (categoryId !== 'accommodation') {
      prevCategoryRef.current = categoryId;
      return;
    }
    const justSwitched = prevCategoryRef.current !== 'accommodation';
    prevCategoryRef.current = categoryId;
    if (justSwitched || !checkInDate) setCheckInDate(transactionDate);
    if (justSwitched || !checkOutDate) {
      const next = new Date((transactionDate || new Date().toISOString().slice(0, 10)) + 'T12:00:00Z');
      next.setUTCDate(next.getUTCDate() + 1);
      setCheckOutDate(next.toISOString().slice(0, 10));
    }
  }, [categoryId, transactionDate, checkInDate, checkOutDate]);

  const totalCustom = Object.values(customAmounts).reduce(
    (sum, v) => sum + (parseFloat(v) || 0),
    0
  );
  const amountNum = parseFloat(amount);
  const isValidAmount = !Number.isNaN(amountNum) && amountNum > 0;
  const hasCurrency = currency.length > 0;
  const customValid = splitMode !== 'custom' || (Math.abs(totalCustom - amountNum) < 0.02 && totalCustom > 0);

  const isAccommodation = categoryId === 'accommodation';
  const accommodationNights = (() => {
    if (!isAccommodation || !checkInDate || !checkOutDate) return 0;
    const a = new Date(checkInDate + 'T12:00:00Z').getTime();
    const b = new Date(checkOutDate + 'T12:00:00Z').getTime();
    const days = Math.floor((b - a) / (24 * 60 * 60 * 1000));
    return Math.max(0, days);
  })();
  const perNightAmount = accommodationNights > 0 ? amountNum / accommodationNights : amountNum;

  const handleSubmit = useCallback(async () => {
    if (!isValidAmount || !hasCurrency || !paidBy || !activeTripId) return;
    const included = participants.filter((p) => includedInSplit.has(p.userId)).map((p) => p.userId);
    if (included.length === 0) {
      setError('Select at least one person in the split.');
      return;
    }
    if (splitMode === 'custom' && !customValid) {
      setError('Custom split must add up to the total amount.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const dateForTimestamp =
        categoryId === 'accommodation' && checkInDate ? checkInDate : transactionDate;
      const timestamp = dateForTimestamp
        ? `${dateForTimestamp}T12:00:00.000Z`
        : new Date().toISOString();
      let customSplitAmountsJson: string | null = null;
      if (splitMode === 'custom') {
        const map: Record<string, number> = {};
        included.forEach((uid) => {
          const v = parseFloat(customAmounts[uid]);
          if (!Number.isNaN(v) && v > 0) map[uid] = v;
        });
        if (Object.keys(map).length > 0) customSplitAmountsJson = JSON.stringify(map);
      }
      await dataClient.models.Transaction.create({
        tripId: activeTripId,
        amount: amountNum,
        currency,
        description: description.trim() || null,
        paidBy,
        splitBetween: included,
        timestamp,
        categoryId: categoryId || null,
        customSplitAmountsJson,
      });
      onSuccess();
      setAmount('');
      setDescription('');
      setTransactionDate(new Date().toISOString().slice(0, 10));
      setCheckInDate('');
      setCheckOutDate('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add transaction');
    } finally {
      setSubmitting(false);
    }
  }, [
    amount,
    amountNum,
    isValidAmount,
    paidBy,
    activeTripId,
    currency,
    description,
    categoryId,
    splitMode,
    includedInSplit,
    customAmounts,
    customValid,
    hasCurrency,
    transactionDate,
    checkInDate,
    checkOutDate,
    categoryId,
    participants,
    onSuccess,
  ]);

  if (loadingParticipants) {
    return <div className="py-6 text-center text-slate-500">Loading participants…</div>;
  }
  if (participants.length === 0) {
    return (
      <div className="py-6 text-center text-slate-500">
        No trip participants yet. Add members in Trips.
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="space-y-4 sm:space-y-5"
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="min-w-0">
          <label htmlFor="tx-amount" className="block text-sm font-medium text-slate-700">Amount</label>
          <input
            id="tx-amount"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="mt-1 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          />
        </div>
        <div className="min-w-0">
          <label htmlFor="tx-currency" className="block text-sm font-medium text-slate-700">Currency</label>
          <select
            id="tx-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          >
            <option value="">Select currency</option>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="tx-desc" className="block text-sm font-medium text-slate-700">Description</label>
        <input
          id="tx-desc"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Dinner at Marina Bay"
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
        />
      </div>

      <div>
        <label htmlFor="tx-date" className="block text-sm font-medium text-slate-700">Date</label>
        <input
          id="tx-date"
          type="date"
          value={transactionDate}
          onChange={(e) => setTransactionDate(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
        />
      </div>

      <div>
        <label htmlFor="tx-paidby" className="block text-sm font-medium text-slate-700">Who paid</label>
        <select
          id="tx-paidby"
          value={paidBy}
          onChange={(e) => setPaidBy(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
        >
          <option value="">Select…</option>
          {participants.map((p) => (
            <option key={p.userId} value={p.userId}>{displayParticipant(p)}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="tx-category" className="block text-sm font-medium text-slate-700">Category</label>
        <select
          id="tx-category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value as CategoryId)}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
        >
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>

      {isAccommodation && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <p className="text-sm font-medium text-slate-700">Stay dates</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="tx-checkin" className="block text-xs font-medium text-slate-600">Check-in</label>
              <input
                id="tx-checkin"
                type="date"
                value={checkInDate}
                onChange={(e) => setCheckInDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
              />
            </div>
            <div>
              <label htmlFor="tx-checkout" className="block text-xs font-medium text-slate-600">Check-out</label>
              <input
                id="tx-checkout"
                type="date"
                value={checkOutDate}
                onChange={(e) => setCheckOutDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
              />
            </div>
          </div>
          {accommodationNights >= 0 && amountNum > 0 && (
            <p className="text-sm text-slate-700">
              {accommodationNights === 0 ? (
                <span>Same-day: 0 nights. Total: {currency} {amountNum.toFixed(2)}</span>
              ) : (
                <span>
                  <strong>{accommodationNights} night{accommodationNights !== 1 ? 's' : ''}</strong>
                  {' · '}
                  {currency} {perNightAmount.toFixed(2)} per night
                  {' · '}
                  Total: {currency} {(perNightAmount * accommodationNights).toFixed(2)}
                </span>
              )}
            </p>
          )}
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-slate-700">Split between</p>
        <p className="mt-0.5 text-xs text-slate-500">Tap to include or exclude. At least one required.</p>
        <div className="mt-3 flex flex-wrap gap-4 sm:gap-3">
          {participants.map((p) => (
            <div key={p.userId} className="flex flex-col items-center gap-1">
              <ParticipantAvatar
                participant={p}
                selected={includedInSplit.has(p.userId)}
                onToggle={() => {
                  setIncludedInSplit((prev) => {
                    const next = new Set(prev);
                    if (next.has(p.userId)) next.delete(p.userId);
                    else next.add(p.userId);
                    return next;
                  });
                }}
              />
              <span className="max-w-[4rem] truncate text-center text-xs text-slate-600" title={displayParticipant(p)}>
                {displayParticipant(p)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-slate-700">Split type</p>
        <div className="mt-2 flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="splitMode"
              checked={splitMode === 'equal'}
              onChange={() => setSplitMode('equal')}
              className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-600"
            />
            <span className="text-sm text-slate-700">Split equally</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="splitMode"
              checked={splitMode === 'custom'}
              onChange={() => setSplitMode('custom')}
              className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-600"
            />
            <span className="text-sm text-slate-700">Custom split (amounts)</span>
          </label>
        </div>
        {splitMode === 'custom' && (
          <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
            <p className="text-xs text-slate-600">Enter each person&apos;s share in {currency}.</p>
            {participants.filter((p) => includedInSplit.has(p.userId)).map((p) => (
              <div key={p.userId} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <label className="w-full min-w-0 text-sm text-slate-700 sm:w-auto sm:min-w-[100px]">{displayParticipant(p)}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={customAmounts[p.userId] ?? ''}
                  onChange={(e) => setCustomAmounts((prev) => ({ ...prev, [p.userId]: e.target.value }))}
                  placeholder="0"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 sm:w-24 sm:flex-initial"
                />
                <span className="text-xs text-slate-500">{currency}</span>
              </div>
            ))}
            {amountNum > 0 && (
              <p className={`text-xs ${Math.abs(totalCustom - amountNum) < 0.02 ? 'text-green-600' : 'text-amber-600'}`}>
                Total: {totalCustom.toFixed(2)} {currency}
                {Math.abs(totalCustom - amountNum) >= 0.02 && ' (should equal amount)'}
              </p>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        {showCancel && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!isValidAmount || !hasCurrency || !paidBy || !customValid || submitting}
          className={showCancel && onCancel ? 'btn-primary w-full flex-1 sm:w-auto' : 'btn-primary w-full'}
        >
          {submitting ? 'Adding…' : 'Add transaction'}
        </button>
      </div>
    </form>
  );
}
