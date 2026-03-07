'use client';

import { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { EXPENSE_CATEGORIES, type CategoryId } from '@/lib/transactionCategories';
import { getTransactionSplitBreakdown } from '@/lib/transactionBalances';

const dataClient = generateClient<Schema>();

type Transaction = Schema['Transaction']['type'];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'SGD', 'AUD', 'JPY', 'KRW', 'CAD', 'CHF', 'THB', 'MYR', 'IDR', 'PHP', 'VND'];

function displayName(p: { userId: string; username: string | null }) {
  return p.username?.trim() || p.userId.slice(0, 8) || 'Someone';
}

type Props = {
  transaction: Transaction;
  participants: { userId: string; username: string | null }[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

export default function TransactionEditModal({
  transaction: tx,
  participants,
  onClose,
  onSaved,
}: Props) {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('');
  const [description, setDescription] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [categoryId, setCategoryId] = useState<CategoryId>('other');
  const [includedInSplit, setIncludedInSplit] = useState<Set<string>>(new Set());
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAmount(String(tx.amount ?? ''));
    setCurrency((tx.currency ?? '').trim() || 'USD');
    setDescription((tx.description ?? '').trim());
    const ts = tx.timestamp ?? '';
    setDateStr(ts ? ts.slice(0, 10) : '');
    setCategoryId((tx.categoryId as CategoryId) || 'other');
    setIncludedInSplit(new Set((tx.splitBetween ?? []).filter((id): id is string => typeof id === 'string')));
    if (tx.customSplitAmountsJson?.trim()) {
      try {
        const custom = JSON.parse(tx.customSplitAmountsJson) as Record<string, number>;
        setSplitMode('custom');
        const next: Record<string, string> = {};
        for (const [uid, amt] of Object.entries(custom)) {
          if (amt > 0) next[uid] = String(amt);
        }
        setCustomAmounts(next);
      } catch {
        setSplitMode('equal');
      }
    } else {
      setSplitMode('equal');
      setCustomAmounts({});
    }
  }, [tx]);

  const amountNum = parseFloat(amount);
  const isValidAmount = !Number.isNaN(amountNum) && amountNum > 0;
  const totalCustom = Object.values(customAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const customValid = splitMode !== 'custom' || (Math.abs(totalCustom - amountNum) < 0.02 && totalCustom > 0);
  const included = participants.filter((p) => includedInSplit.has(p.userId)).map((p) => p.userId);

  const handleSave = useCallback(async () => {
    if (!isValidAmount || included.length === 0) return;
    if (splitMode === 'custom' && !customValid) {
      setError('Custom split must add up to the total amount.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const timestamp = dateStr ? `${dateStr}T12:00:00.000Z` : new Date().toISOString();
      let customSplitAmountsJson: string | null = null;
      if (splitMode === 'custom') {
        const map: Record<string, number> = {};
        included.forEach((uid) => {
          const v = parseFloat(customAmounts[uid]);
          if (!Number.isNaN(v) && v > 0) map[uid] = v;
        });
        if (Object.keys(map).length > 0) customSplitAmountsJson = JSON.stringify(map);
      }
      await dataClient.models.Transaction.update({
        id: tx.id,
        paidBy: tx.paidBy,
        amount: amountNum,
        currency: currency.trim() || 'USD',
        description: description.trim() || null,
        timestamp,
        categoryId: categoryId || null,
        splitBetween: included,
        customSplitAmountsJson,
      });
      await Promise.resolve(onSaved());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  }, [tx.id, amountNum, isValidAmount, currency, description, dateStr, categoryId, splitMode, included, customAmounts, customValid, onSaved, onClose]);

  const handleDelete = useCallback(async () => {
    setError(null);
    setDeleting(true);
    try {
      await dataClient.models.Transaction.delete({ id: tx.id });
      await Promise.resolve(onSaved());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  }, [tx.id, onSaved, onClose]);

  const breakdown = getTransactionSplitBreakdown(tx);
  const participantMap = new Map(participants.map((p) => [p.userId, p]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="edit-tx-title">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} aria-hidden="true" />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl scrollbar-hide">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 id="edit-tx-title" className="text-lg font-semibold text-slate-900">Transaction</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="space-y-4 p-4">
          {/* Read-only: who paid */}
          <div>
            <p className="text-xs font-medium uppercase text-slate-500">Paid by</p>
            <p className="mt-0.5 font-medium text-slate-900">{displayName(participantMap.get(tx.paidBy) ?? { userId: tx.paidBy, username: null })}</p>
          </div>

          {/* Breakdown (view) */}
          <div>
            <p className="text-xs font-medium uppercase text-slate-500">Split</p>
            <ul className="mt-1 space-y-0.5 text-sm text-slate-700">
              {breakdown.map(({ userId, amount: amt }) => (
                <li key={userId} className="flex justify-between">
                  <span>{displayName(participantMap.get(userId) ?? { userId, username: null })}</span>
                  <span className="font-medium">{tx.currency} {amt.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>

          <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Amount</label>
                  <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Currency</label>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600">
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Description</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Dinner" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Date</label>
                  <input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Category</label>
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value as CategoryId)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600">
                    {EXPENSE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Split between</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {participants.map((p) => (
                    <button
                      key={p.userId}
                      type="button"
                      onClick={() => {
                        setIncludedInSplit((prev) => {
                          const next = new Set(prev);
                          if (next.has(p.userId)) next.delete(p.userId);
                          else next.add(p.userId);
                          return next;
                        });
                      }}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                        includedInSplit.has(p.userId) ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {displayName(p)}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="radio" checked={splitMode === 'equal'} onChange={() => setSplitMode('equal')} className="rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                    Equal
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="radio" checked={splitMode === 'custom'} onChange={() => setSplitMode('custom')} className="rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                    Custom
                  </label>
                </div>
                {splitMode === 'custom' && (
                  <div className="mt-2 space-y-2">
                    {participants.filter((p) => includedInSplit.has(p.userId)).map((p) => (
                      <div key={p.userId} className="flex items-center gap-2">
                        <span className="w-24 truncate text-sm text-slate-700">{displayName(p)}</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={customAmounts[p.userId] ?? ''}
                          onChange={(e) => setCustomAmounts((prev) => ({ ...prev, [p.userId]: e.target.value }))}
                          placeholder="0"
                          className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
          </>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={handleSave} disabled={saving || !isValidAmount || included.length === 0} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={handleDelete} disabled={deleting} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
