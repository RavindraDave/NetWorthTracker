/**
 * Suggested sub-groups for the built-in categories, each with a short note on what
 * belongs in it.
 *
 * Deliberately NOT a field on `CategoryTemplate`. Templates are re-applied on every
 * load and every clone (`SnapshotEditor` and `cloneLatestSnapshot` both re-add
 * categories missing from a snapshot), so template-borne groups would silently
 * reappear in April after being deleted in March. Keeping the catalogue static means
 * it is only ever applied where the user explicitly asks for it — the "Suggest groups"
 * picker, where they see each description before accepting it.
 *
 * The descriptions here are only the *seed*. Once a group exists its description lives
 * on the snapshot (`SubCategory.description`) and the user can rewrite it freely.
 *
 * On Foreign Holdings: it cuts across the other categories on purpose — use it when
 * you would rather group by jurisdiction than by asset type, and keep each holding in
 * one place or the other, never both.
 */
import { DEFAULT_CATEGORY_TEMPLATES } from './defaultCategories';

export interface SubCategorySuggestion {
  name: string;
  description: string;
}

export const DEFAULT_SUB_CATEGORIES: Record<string, SubCategorySuggestion[]> = {
  'default-cash': [
    { name: 'Savings',        description: 'Everyday resident savings accounts.' },
    { name: 'Current',        description: 'Current/checking accounts, usually for a business or profession.' },
    { name: 'Cash in Hand',   description: 'Physical cash and wallet balances.' },
    { name: 'NRE',            description: 'Non-Resident External: foreign earnings, freely repatriable, interest tax-free in India.' },
    { name: 'NRO',            description: 'Non-Resident Ordinary: India-sourced income like rent or dividends; repatriation capped and interest taxable.' },
    { name: 'Fixed Deposits', description: 'Term and recurring deposits held with a bank.' },
  ],

  'default-investments': [
    { name: 'Mutual Funds',  description: 'Equity, debt and hybrid schemes, tracked per folio.' },
    { name: 'Stocks',        description: 'Direct equity in listed companies.' },
    { name: 'ETFs',          description: 'Exchange-traded index and commodity funds.' },
    { name: 'Bonds',         description: 'Government securities, corporate bonds and debentures.' },
    { name: 'RSUs & ESOPs',  description: 'Vested employer equity, at current market value.' },
    { name: 'Crypto',        description: 'Digital assets on exchanges or in self-custody wallets.' },
  ],

  'default-retirement': [
    { name: 'EPF',                     description: "Employees' Provident Fund, including the employer's share." },
    { name: 'PPF',                     description: 'Public Provident Fund; 15-year lock-in.' },
    { name: 'NPS',                     description: 'National Pension System, Tier I and Tier II.' },
    { name: 'CPF',                     description: 'Singapore Central Provident Fund.' },
    { name: 'Gratuity & Superannuation', description: 'Employer retirement benefits accrued but not yet paid.' },
    { name: 'Overseas Plans',          description: 'Foreign retirement accounts such as a 401(k) or IRA.' },
  ],

  'default-real-estate': [
    { name: 'Residential',        description: 'Homes and apartments, self-occupied or let out.' },
    { name: 'Commercial',         description: 'Offices, shops and other commercial property.' },
    { name: 'Land',               description: 'Plots and agricultural land.' },
    { name: 'Under Construction', description: 'Amounts paid so far on property not yet possessed.' },
  ],

  'default-precious-metals': [
    { name: 'Gold',                 description: 'Coins, bars and investment-grade jewellery.' },
    { name: 'Silver',               description: 'Coins, bars and utensils.' },
    { name: 'Sovereign Gold Bonds', description: 'RBI bonds tracking the gold price and paying interest.' },
    { name: 'Digital Gold',         description: 'Gold bought through an app and held in a vault.' },
  ],

  'default-personal-prop': [
    { name: 'Vehicles',            description: 'Cars and two-wheelers, at resale value rather than purchase price.' },
    { name: 'Jewellery',           description: 'Ornamental pieces you would not sell as an investment.' },
    { name: 'Electronics',         description: 'High-value devices worth tracking.' },
    { name: 'Furniture & Fittings', description: 'Furnishings and home fit-out.' },
    { name: 'Collectibles',        description: 'Art, watches and other collectibles.' },
  ],

  'default-business': [
    { name: 'Equity Stake',          description: 'Your ownership share in a private company, at latest valuation.' },
    { name: 'Business Bank Balance', description: "Funds held in the business's own accounts." },
    { name: 'Receivables',           description: 'Invoiced work not yet paid.' },
    { name: 'Equipment',             description: 'Plant, machinery and business equipment.' },
    { name: 'Goodwill & IP',         description: 'Brand and intellectual property, if you carry a value for them.' },
  ],

  'default-foreign': [
    { name: 'Overseas Bank',      description: 'Bank accounts held outside your home country.' },
    { name: 'Overseas Brokerage', description: 'Foreign brokerage accounts, e.g. US equities.' },
    { name: 'Overseas Property',  description: 'Real estate owned abroad.' },
    { name: 'Employer Equity',    description: 'Stock held with an overseas employer or its broker.' },
  ],

  'default-secured-debt': [
    { name: 'Home Loan',              description: 'Mortgage on a residential property.' },
    { name: 'Car Loan',               description: 'Vehicle finance.' },
    { name: 'Loan Against Property',  description: 'Borrowing secured on property you own.' },
    { name: 'Loan Against Securities', description: 'Borrowing secured on shares, funds or deposits.' },
    { name: 'Gold Loan',              description: 'Borrowing secured on gold.' },
  ],

  'default-unsecured-debt': [
    { name: 'Credit Cards',       description: 'Outstanding card balances.' },
    { name: 'Personal Loans',     description: 'Unsecured bank or NBFC borrowing.' },
    { name: 'Education Loan',     description: 'Student borrowing.' },
    { name: 'Buy Now Pay Later',  description: 'BNPL and EMI-on-card balances.' },
    { name: 'Family & Friends',   description: 'Informal borrowing you intend to repay.' },
  ],

  'default-tax': [
    { name: 'Income Tax Payable', description: 'Assessed or self-assessment tax not yet paid.' },
    { name: 'Advance Tax Due',    description: 'Instalments due later this financial year.' },
    { name: 'Capital Gains Tax',  description: 'Estimated tax on gains already realised.' },
    { name: 'GST Payable',        description: 'Indirect tax collected and owed.' },
  ],

  'default-other-liab': [
    { name: 'Rent & Utilities Due',    description: 'Accrued bills not yet settled.' },
    { name: 'Insurance Premiums Due',  description: 'Premiums payable in the current cycle.' },
    { name: 'Maintenance Dues',        description: 'Society or building charges outstanding.' },
    { name: 'Committed Payments',      description: 'Amounts you have promised but not yet paid.' },
  ],
};

/**
 * Suggested groups for a category, or [] when we have no opinion (custom categories).
 *
 * Looks up by id first, then falls back to name+type against
 * `DEFAULT_CATEGORY_TEMPLATES` — the same fallback `SnapshotEditor`'s
 * category backfill and `buildCategoryTrendData` already use. A category
 * that's unmistakably "Cash & Bank Accounts" by name and type shouldn't lose
 * its suggestions just because its stored id predates (or otherwise doesn't
 * match) the current built-in template ids; this is a read-only lookup
 * fallback, not a data migration — nothing about the stored category is
 * ever rewritten.
 */
export function suggestedSubCategories(category: { id: string; name: string; type: 'asset' | 'liability' }): SubCategorySuggestion[] {
  const direct = DEFAULT_SUB_CATEGORIES[category.id];
  if (direct) return direct;

  const matchedTemplate = DEFAULT_CATEGORY_TEMPLATES.find(
    t => t.name === category.name && t.type === category.type,
  );
  return matchedTemplate ? (DEFAULT_SUB_CATEGORIES[matchedTemplate.id] ?? []) : [];
}
