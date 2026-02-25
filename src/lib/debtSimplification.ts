/**
 * Debt simplification: given net balances per user (positive = owed money,
 * negative = owes money), compute a minimal set of settlements (who pays whom how much).
 * Uses a greedy algorithm: largest creditor gets paid by largest debtor first.
 */

export type NetBalance = {
  userId: string;
  balance: number; // positive = is owed, negative = owes
};

export type Settlement = {
  fromUserId: string;
  toUserId: string;
  amount: number;
};

/**
 * Returns a list of settlements that clear all balances (within rounding).
 * Balances are in the same currency (e.g. trip base currency).
 */
export function simplifyDebts(balances: NetBalance[]): Settlement[] {
  const eps = 1e-6;
  const creditors = balances
    .filter((b) => b.balance > eps)
    .map((b) => ({ userId: b.userId, balance: b.balance }))
    .sort((a, b) => b.balance - a.balance);
  const debtors = balances
    .filter((b) => b.balance < -eps)
    .map((b) => ({ userId: b.userId, balance: -b.balance })) // store as positive amount owed
    .sort((a, b) => b.balance - a.balance);

  const settlements: Settlement[] = [];
  let i = 0;
  let j = 0;

  while (i < creditors.length && j < debtors.length) {
    const cred = creditors[i];
    const deb = debtors[j];
    const amount = Math.min(cred.balance, deb.balance);
    if (amount <= eps) {
      if (cred.balance <= eps) i++;
      else j++;
      continue;
    }
    settlements.push({
      fromUserId: deb.userId,
      toUserId: cred.userId,
      amount,
    });
    cred.balance -= amount;
    deb.balance -= amount;
    if (cred.balance <= eps) i++;
    if (deb.balance <= eps) j++;
  }

  return settlements;
}
