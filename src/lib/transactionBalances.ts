import type { Schema } from '../../amplify/data/resource';
import type { NetBalance } from './debtSimplification';

type Transaction = Schema['Transaction']['type'];

/**
 * Convert transaction amount to base currency.
 * For now uses 1:1 when currency matches base; otherwise uses amount as-is
 * (assumes same currency for simplicity; can add FX later).
 */
function toBaseAmount(amount: number, currency: string, baseCurrency: string): number {
  return currency === baseCurrency ? amount : amount; // TODO: add exchange rates
}

/**
 * Compute each user's share of a transaction in base currency.
 * Returns map userId -> amount (their share).
 */
function getSharesInBase(
  tx: Transaction,
  baseCurrency: string
): Map<string, number> {
  const amountBase = toBaseAmount(tx.amount, tx.currency, baseCurrency);
  const map = new Map<string, number>();

  if (tx.customSplitAmountsJson?.trim()) {
    try {
      const custom = JSON.parse(tx.customSplitAmountsJson) as Record<string, number>;
      // Custom amounts are in transaction currency; convert to base
      const rate = tx.currency === baseCurrency ? 1 : 1; // TODO: FX
      for (const [uid, amt] of Object.entries(custom)) {
        if (amt > 0) map.set(uid, amt * rate);
      }
      return map;
    } catch {
      // fall through to equal
    }
  }

  const splitBetween = (tx.splitBetween ?? []).filter((id): id is string => id != null);
  const split = splitBetween.length || 1;
  const each = amountBase / split;
  for (const uid of splitBetween) {
    map.set(uid, (map.get(uid) ?? 0) + each);
  }
  return map;
}

/**
 * Compute net balance for each user: total they paid minus total their share.
 * Positive = they are owed money, negative = they owe money.
 */
export function computeNetBalances(
  transactions: Transaction[],
  baseCurrency: string
): NetBalance[] {
  const byUser = new Map<string, number>();

  for (const tx of transactions) {
    const paidBase = toBaseAmount(tx.amount, tx.currency, baseCurrency);
    const paidBy = tx.paidBy;
    byUser.set(paidBy, (byUser.get(paidBy) ?? 0) + paidBase);

    const shares = getSharesInBase(tx, baseCurrency);
    for (const [uid, share] of shares) {
      byUser.set(uid, (byUser.get(uid) ?? 0) - share);
    }
  }

  return Array.from(byUser.entries())
    .filter(([, b]) => Math.abs(b) > 1e-6)
    .map(([userId, balance]) => ({ userId, balance }));
}

function toBaseAmountExport(amount: number, currency: string, baseCurrency: string): number {
  return currency === baseCurrency ? amount : amount;
}

/**
 * Get total expense and by-category for a single transaction in base currency.
 */
function getTxDayAmount(tx: Transaction, baseCurrency: string): number {
  return toBaseAmountExport(tx.amount, tx.currency, baseCurrency);
}

/**
 * Per-category amounts in original currencies (for multi-currency display).
 * categoryId -> currency -> amount
 */
export type ByCategoryByCurrency = Record<string, Record<string, number>>;

/**
 * Group transactions by date key (YYYY-MM-DD).
 * - total / byCategory: in base currency (for totals and average per person).
 * - byCategoryByCurrency: original amounts per currency per category (for display).
 */
export function getExpensesByDay(
  transactions: Transaction[],
  baseCurrency: string
): Map<
  string,
  {
    total: number;
    byCategory: Record<string, number>;
    byCategoryByCurrency: ByCategoryByCurrency;
  }
> {
  const byDay = new Map<
    string,
    {
      total: number;
      byCategory: Record<string, number>;
      byCategoryByCurrency: ByCategoryByCurrency;
    }
  >();

  for (const tx of transactions) {
    const dateStr = tx.timestamp ? tx.timestamp.slice(0, 10) : '';
    if (!dateStr) continue;
    const amountBase = getTxDayAmount(tx, baseCurrency);
    const cat = tx.categoryId?.trim() || 'other';
    const curr = tx.currency?.trim() || 'USD';

    let day = byDay.get(dateStr);
    if (!day) {
      day = {
        total: 0,
        byCategory: {},
        byCategoryByCurrency: {},
      };
      byDay.set(dateStr, day);
    }
    day.total += amountBase;
    day.byCategory[cat] = (day.byCategory[cat] ?? 0) + amountBase;
    if (!day.byCategoryByCurrency[cat]) day.byCategoryByCurrency[cat] = {};
    day.byCategoryByCurrency[cat][curr] = (day.byCategoryByCurrency[cat][curr] ?? 0) + tx.amount;
  }

  return byDay;
}

/**
 * Total expense in base currency (all transactions, 1:1 when currency matches base).
 * For budget % and trip-level totals.
 */
export function getTotalExpenseInBase(
  transactions: Transaction[],
  baseCurrency: string
): number {
  let total = 0;
  for (const tx of transactions) {
    total += toBaseAmountExport(tx.amount, tx.currency, baseCurrency);
  }
  return total;
}

/**
 * Expense by category in base currency (for budget breakdown).
 */
export function getExpenseByCategoryInBase(
  transactions: Transaction[],
  baseCurrency: string
): Record<string, number> {
  const byCategory: Record<string, number> = {};
  for (const tx of transactions) {
    const amount = toBaseAmountExport(tx.amount, tx.currency, baseCurrency);
    const cat = tx.categoryId?.trim() || 'other';
    byCategory[cat] = (byCategory[cat] ?? 0) + amount;
  }
  return byCategory;
}
