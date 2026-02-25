export const EXPENSE_CATEGORIES = [
  { id: 'food', label: 'Food & drink' },
  { id: 'transport', label: 'Transport' },
  { id: 'accommodation', label: 'Accommodation' },
  { id: 'activities', label: 'Activities' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'other', label: 'Other' },
] as const;

export type CategoryId = (typeof EXPENSE_CATEGORIES)[number]['id'];

export const DEFAULT_CATEGORY_ID: CategoryId = 'other';

export function getCategoryLabel(id: string | null | undefined): string {
  if (!id) return 'Other';
  const c = EXPENSE_CATEGORIES.find((x) => x.id === id);
  return c?.label ?? id;
}
