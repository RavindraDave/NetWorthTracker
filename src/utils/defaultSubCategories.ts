/**
 * Suggested sub-category names for the built-in categories.
 *
 * Deliberately NOT a field on `CategoryTemplate`. Templates are re-applied on every
 * load and every clone (`SnapshotEditor` and `cloneLatestSnapshot` both re-add
 * categories missing from a snapshot), so template-borne groups would silently
 * reappear in April after being deleted in March. Keeping the defaults as a static
 * map means they are only ever applied where the code explicitly asks:
 *
 *   1. the very first snapshot a user creates, and
 *   2. the "Suggest groups" button on a category that has none.
 *
 * Categories whose contents vary too much between users (Personal Property,
 * Business, Foreign Holdings, Tax, Other) get no suggestions — a wrong default is
 * worse than none, because the user has to clean it up.
 */
export const DEFAULT_SUB_CATEGORIES: Record<string, string[]> = {
  'default-cash': ['Savings', 'Current', 'Cash in Hand', 'NRE', 'NRO', 'Fixed Deposits'],
  'default-investments': ['Mutual Funds', 'Stocks', 'ETFs', 'Bonds'],
  'default-retirement': ['EPF', 'PPF', 'NPS', 'CPF'],
  'default-real-estate': ['Residential', 'Commercial', 'Land'],
  'default-precious-metals': ['Gold', 'Silver'],
  'default-secured-debt': ['Home Loan', 'Car Loan'],
  'default-unsecured-debt': ['Credit Cards', 'Personal Loans'],
};

/** Suggested group names for a category, or [] when we have no opinion. */
export function suggestedSubCategories(categoryId: string): string[] {
  return DEFAULT_SUB_CATEGORIES[categoryId] ?? [];
}
