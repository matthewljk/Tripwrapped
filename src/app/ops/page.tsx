'use client';

import { useEffect, useState, useCallback } from 'react';
import { getCurrentUser } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import LoadingSpinner from '@/components/LoadingSpinner';
import TripSelector from '@/components/TripSelector';
import { useActiveTrip } from '@/hooks/useActiveTrip';
import { useTripParticipants } from '@/hooks/useTripParticipants';
import { computeNetBalances, getTotalExpenseInBase, getExpenseByCategoryInBase } from '@/lib/transactionBalances';
import { simplifyDebts, type Settlement } from '@/lib/debtSimplification';
import { getCategoryLabel } from '@/lib/transactionCategories';
import Link from 'next/link';

const dataClient = generateClient<Schema>();

type Transaction = Schema['Transaction']['type'];

function getDateKey(timestamp: string): string {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateLabel(dateKey: string): string {
  const d = new Date(dateKey + 'T12:00:00Z');
  if (Number.isNaN(d.getTime())) return dateKey;
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Infer display currency from transactions when trip has none set (most common currency). */
function inferBaseCurrency(transactions: Transaction[]): string {
  if (transactions.length === 0) return 'USD';
  const byCurrency: Record<string, number> = {};
  for (const tx of transactions) {
    const c = (tx.currency || 'USD').trim();
    byCurrency[c] = (byCurrency[c] ?? 0) + 1;
  }
  const sorted = Object.entries(byCurrency).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? 'USD';
}

export default function OpsPage() {
  const { activeTripId, activeTrip, hasTrip, loading, refresh } = useActiveTrip();
  const { participants, loading: loadingParticipants } = useTripParticipants(activeTripId);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [transactionHistoryShowMore, setTransactionHistoryShowMore] = useState(false);

  const tripBaseCurrency = (activeTrip?.baseCurrency || '').trim();
  const baseCurrency = tripBaseCurrency || inferBaseCurrency(transactions) || 'USD';

  const loadTransactions = useCallback(() => {
    if (!activeTripId) {
      setTransactions([]);
      setLoadingTx(false);
      return;
    }
    setLoadingTx(true);
    dataClient.models.Transaction.list({
      filter: { tripId: { eq: activeTripId } },
    })
      .then(({ data }) => {
        setTransactions((data ?? []).sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || '')));
      })
      .catch(() => setTransactions([]))
      .finally(() => setLoadingTx(false));
  }, [activeTripId]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  useEffect(() => {
    if (hasTrip) refresh();
  }, [hasTrip, refresh]);

  useEffect(() => {
    getCurrentUser()
      .then(({ userId }) => setCurrentUserId(userId))
      .catch(() => setCurrentUserId(null));
  }, []);

  const participantMap = new Map(participants.map((p) => [p.userId, p]));
  const displayName = (userId: string) =>
    participantMap.get(userId)?.username?.trim() || userId.slice(0, 8) || 'Someone';

  const netBalances = activeTripId && transactions.length > 0
    ? computeNetBalances(transactions, baseCurrency)
    : [];
  const settlements = netBalances.length > 0 ? simplifyDebts(netBalances) : [];
  const myBalance = currentUserId
    ? netBalances.find((b) => b.userId === currentUserId)?.balance ?? 0
    : 0;

  const participantCount = Math.max(1, participants.length);
  const totalExpenseBase = transactions.length > 0 ? getTotalExpenseInBase(transactions, baseCurrency) : 0;
  const expenseByCategoryBase = transactions.length > 0 ? getExpenseByCategoryInBase(transactions, baseCurrency) : {};
  const budgetPerPax = activeTrip?.budgetPerPax ?? null;
  const totalBudget = budgetPerPax != null && budgetPerPax > 0 ? budgetPerPax * participantCount : null;
  const budgetPct = totalBudget != null && totalBudget > 0 ? (totalExpenseBase / totalBudget) * 100 : null;
  const expensePerPax = participantCount > 0 ? totalExpenseBase / participantCount : 0;

  const [budgetBreakdownExpanded, setBudgetBreakdownExpanded] = useState(false);

  const byDay = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const key = getDateKey(tx.timestamp || '');
    const list = byDay.get(key) ?? [];
    list.push(tx);
    byDay.set(key, list);
  }
  const dateKeys = Array.from(byDay.keys()).sort((a, b) => b.localeCompare(a));

  if (loading) return <LoadingSpinner />;

  if (!hasTrip) {
    return (
      <div className="mx-auto max-w-2xl content-padding-x pb-28 pt-20 sm:pb-24 sm:pt-24 content-wrap">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">O$P$</h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">Create or join a trip to track expenses and splits.</p>
        <Link href="/trips" className="btn-primary mt-6 inline-block w-full sm:w-auto">
          Create or join a trip
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl content-padding-x pb-28 pt-20 sm:pb-24 sm:pt-24 content-wrap">
      <div className="flex flex-col gap-4 border-b border-slate-100 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:py-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">O$P$</h1>
          <p className="mt-1 text-sm text-slate-600 sm:text-base">Split expenses and see who owes whom</p>
        </div>
        <TripSelector />
      </div>

      {(loadingTx || loadingParticipants) ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          {/* Net balance for current user */}
          <section className="card mt-6 p-4 sm:mt-8 sm:p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Your balance</h2>
            {transactions.length > 0 && !tripBaseCurrency && (
              <p className="mt-1 text-xs text-slate-500">Amounts in {baseCurrency} (from transactions). Set trip currency in Trips for a fixed base.</p>
            )}
            {transactions.length === 0 ? (
              <p className="mt-2 text-slate-600">No transactions yet. Add one from the Add page.</p>
            ) : (
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {myBalance > 0.005 && (
                  <span className="text-green-700">You are owed {formatAmount(myBalance, baseCurrency)}</span>
                )}
                {myBalance < -0.005 && (
                  <span className="text-amber-700">You owe {formatAmount(-myBalance, baseCurrency)}</span>
                )}
                {myBalance >= -0.005 && myBalance <= 0.005 && (
                  <span className="text-slate-600">You&apos;re all square</span>
                )}
              </p>
            )}
          </section>

          {/* Budget summary: trip budget, total expense, % utilised, expense per pax, expand for breakdown */}
          <section className="card mt-4 p-4 sm:mt-6 sm:p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Budget</h2>
            {budgetPerPax != null && budgetPerPax > 0 && (
              <p className="mt-2 text-slate-900">
                <span className="font-medium">Trip budget (per person):</span>{' '}
                {formatAmount(budgetPerPax, baseCurrency)}
                {participantCount > 1 && (
                  <span className="ml-1 text-slate-500 text-sm">
                    (total: {formatAmount(totalBudget ?? 0, baseCurrency)})
                  </span>
                )}
              </p>
            )}
            {transactions.length === 0 ? (
              <p className="mt-2 text-slate-600">No transactions yet. Add some from the Add page.</p>
            ) : (
              <>
                <p className="mt-2 text-slate-900">
                  <span className="font-medium">Total expense:</span>{' '}
                  {formatAmount(totalExpenseBase, baseCurrency)}
                </p>
                {budgetPct != null && (
                  <p className="mt-1 text-slate-700">
                    <span className="font-medium">Budget utilised:</span>{' '}
                    <span className={budgetPct > 100 ? 'text-amber-600' : 'text-slate-700'}>{budgetPct.toFixed(0)}%</span>
                    {totalBudget != null && (
                      <span className="ml-1 text-slate-500 text-sm">
                        (budget: {formatAmount(totalBudget, baseCurrency)})
                      </span>
                    )}
                  </p>
                )}
                <p className="mt-1 text-slate-700">
                  <span className="font-medium">Expense per person:</span>{' '}
                  {formatAmount(expensePerPax, baseCurrency)}
                </p>
                {Object.keys(expenseByCategoryBase).length > 0 && (
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => setBudgetBreakdownExpanded((b) => !b)}
                      className="flex w-full items-center justify-between text-left text-sm font-medium text-slate-700 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                    >
                      <span>Breakdown by category</span>
                      <span className={`text-slate-400 transition-transform ${budgetBreakdownExpanded ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {budgetBreakdownExpanded && (
                      <ul className="mt-2 space-y-1 text-sm text-slate-600">
                        {Object.entries(expenseByCategoryBase)
                          .sort(([, a], [, b]) => b - a)
                          .map(([catId, amt]) => (
                            <li key={catId} className="flex justify-between">
                              <span>{getCategoryLabel(catId)}</span>
                              <span className="font-medium text-slate-800">{formatAmount(amt, baseCurrency)}</span>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}
          </section>

          {/* Simplified settlements */}
          {settlements.length > 0 && (
            <section className="card mt-4 p-4 sm:mt-6 sm:p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Settle up</h2>
              <p className="mt-0.5 text-xs text-slate-500">Minimal transfers to clear debts</p>
              <ul className="mt-4 space-y-3">
                {settlements.map((s: Settlement, i: number) => (
                  <li key={i} className="flex flex-col gap-1 rounded-xl bg-slate-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:py-2">
                    <span className="min-w-0 truncate text-slate-700">
                      {displayName(s.fromUserId)} → {displayName(s.toUserId)}
                    </span>
                    <span className="flex-shrink-0 font-medium text-slate-900">{formatAmount(s.amount, baseCurrency)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Transaction history: top 3 days visible, rest expandable */}
          <section className="mt-6 sm:mt-8">
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">Transaction history</h2>
            {dateKeys.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No transactions yet.</p>
            ) : (
              <>
                <div className="mt-4 space-y-4 sm:space-y-6">
                  {dateKeys.slice(0, 3).map((dateKey) => (
                    <div key={dateKey} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <div className="border-b border-slate-100 bg-slate-50/80 px-3 py-2 text-sm font-medium text-slate-700 sm:px-4">
                        {formatDateLabel(dateKey)}
                      </div>
                      <ul className="divide-y divide-slate-100">
                        {(byDay.get(dateKey) ?? []).map((tx) => (
                          <li key={tx.id} className="flex flex-col gap-0.5 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4 sm:py-3">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-slate-900 truncate">
                                {tx.description?.trim() || 'Expense'}
                              </p>
                              <p className="text-xs text-slate-500">
                                {getCategoryLabel(tx.categoryId)} · {displayName(tx.paidBy)} paid
                              </p>
                            </div>
                            <span className="flex-shrink-0 font-medium text-slate-900">
                              {formatAmount(tx.amount, tx.currency)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                {dateKeys.length > 3 && (
                  <>
                    {transactionHistoryShowMore && (
                      <div className="mt-4 space-y-4 sm:space-y-6">
                        {dateKeys.slice(3).map((dateKey) => (
                          <div key={dateKey} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                            <div className="border-b border-slate-100 bg-slate-50/80 px-3 py-2 text-sm font-medium text-slate-700 sm:px-4">
                              {formatDateLabel(dateKey)}
                            </div>
                            <ul className="divide-y divide-slate-100">
                              {(byDay.get(dateKey) ?? []).map((tx) => (
                                <li key={tx.id} className="flex flex-col gap-0.5 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4 sm:py-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-slate-900 truncate">
                                      {tx.description?.trim() || 'Expense'}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {getCategoryLabel(tx.categoryId)} · {displayName(tx.paidBy)} paid
                                    </p>
                                  </div>
                                  <span className="flex-shrink-0 font-medium text-slate-900">
                                    {formatAmount(tx.amount, tx.currency)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setTransactionHistoryShowMore((s) => !s)}
                      className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
                      aria-expanded={transactionHistoryShowMore}
                    >
                      <span
                        className="text-slate-400 transition-transform"
                        style={{ transform: transactionHistoryShowMore ? 'rotate(90deg)' : 'rotate(0deg)' }}
                        aria-hidden
                      >
                        ▶
                      </span>
                      {transactionHistoryShowMore
                        ? 'Show less'
                        : `Show ${dateKeys.length - 3} more day${dateKeys.length - 3 === 1 ? '' : 's'}`}
                    </button>
                  </>
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
