export interface Snapshot {
  id: string;
  month: string; // "YYYY-MM"
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  exchangeRates: Record<string, number>; // anchor-relative: { "INR": 83, "SGD": 1.34 } = "1 USD = X currency"
  ratesLastUpdated?: string; // ISO string — set when user refreshes or manually edits rates
  ratesAnchor?: string; // migration sentinel — 'USD' once migrated to anchor-relative format
  categories: Category[];
  notes?: string;
  monthlyIncome?: number;
  monthlyExpenses?: number;
}

/**
 * A named group of line items within a category — e.g. "Mutual Funds" under
 * Investments, or "NRE/NRO" under Cash & Bank Accounts.
 *
 * Definitions live on the snapshot's Category rather than on CategoryTemplate,
 * for three reasons: preferences never sync (`syncEngine.ts` always keeps the
 * local copy), preferences are deliberately plaintext so app-lock config is
 * readable before unlock, and snapshot-resident defs travel with the items that
 * reference them through the whole-snapshot merge — so cross-device orphans are
 * structurally near-impossible.
 */
export interface SubCategory {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'asset' | 'liability';
  icon: string;
  /**
   * Flat, one level. Sub-category membership is a reference on the item
   * (`LineItem.subCategoryId`), never a nested array — that is what lets every
   * total, chart and export keep working without knowing groups exist.
   */
  items: LineItem[];
  isLiquid: boolean;
  isInvestable: boolean;
  /** Ordered group definitions. Array position IS the display order. */
  subCategories?: SubCategory[];
}

export interface LineItem {
  id: string;
  name: string;
  amount: number;
  currency: string; // ISO code
  notes?: string;
  excludeFromNetWorth?: boolean;
  excludeFromGoals?: boolean;
  /**
   * References an id in the parent `Category.subCategories`. Absent = ungrouped.
   * Deliberately an id and never a typed name, so a rename touches one place and
   * a typo can't fragment one group into several across months.
   */
  subCategoryId?: string;
  // Loan amortisation — when all four are set, outstanding balance is auto-computed
  loanPrincipal?: number;       // Original principal in item.currency
  annualInterestRate?: number;  // % e.g. 8.5
  tenureMonths?: number;        // Total loan term in months
  loanStartMonth?: string;      // "YYYY-MM" of first EMI
  // Cost basis — for unrealised gain/loss and annualised return (CAGR)
  purchasePrice?: number;       // Original cost in item.currency
  purchaseDate?: string;        // "YYYY-MM-DD"
  // Stated yield — a known fixed annual return % for non-market accounts
  // (savings, FD, PPF, bonds). When set, it is the account's reported return
  // in reports, overriding any computed cost-basis CAGR.
  statedReturnRate?: number;    // % p.a. e.g. 5 for a 5% FD
}

export type GoalType = 'net_worth_target' | 'fire' | 'savings' | 'debt_freedom' | 'custom';

export interface Milestone {
  id: string;
  label: string;
  targetAmount: number;
}

// Tax parameters for FIRE withdrawal planning (E3 — India Budget 2024 defaults)
export interface TaxParams {
  ltcgRate: number;       // % e.g. 12.5 (equity LTCG)
  stcgRate: number;       // % e.g. 20 (equity STCG)
  ltcgExemption: number;  // annual exemption in base currency, e.g. 125000 (₹1.25L)
  equityPct: number;      // % of withdrawal assumed equity, e.g. 80
  ltcgPct: number;        // % of equity gains assumed long-term (>12 months), e.g. 70
  debtRate: number;       // % on debt/other gains (income slab rate), e.g. 30
  cess: number;           // % health+education cess on base tax, e.g. 4
}

export interface Goal {
  id: string;
  type: GoalType;
  name: string;
  createdAt: string;
  updatedAt?: string;
  targetAmount: number;
  targetDate?: string;
  annualExpenses?: number;
  withdrawalRate?: number; // Default 4
  multiplier?: number; // Default 25
  milestones?: Milestone[];
  // Phase 3.4 — FIRE calculator improvements
  expectedReturn?: number; // % annual nominal return, default 7
  inflationRate?: number;  // % annual inflation, default 3
  annualSavingsGrowth?: number; // % increase in monthly savings per year, default 0
  // Category exclusions — asset category IDs to exclude from this goal's net worth calculation
  excludedCategoryIds?: string[];
  // E3 — tax-aware withdrawal planning; absent means tax section is hidden
  taxParams?: TaxParams;
  /**
   * Cash-flow basis for FIRE projections: average monthly income/expenses
   * over the last N snapshots that have cash-flow data. 1 (or absent) =
   * current snapshot only — the original behaviour.
   */
  cashflowWindow?: number;
}

export interface FlattenedItem extends LineItem {
  categoryName: string;
  /** Resolved from the parent category at flatten time; absent when ungrouped. */
  subCategoryName?: string;
  isLiquid?: boolean;
}

export interface CategoryTemplate {
  id: string;
  name: string;
  type: 'asset' | 'liability';
  icon: string;
  isLiquid: boolean;
  isInvestable: boolean;
  disabled?: boolean;
  isBuiltIn?: boolean;
}

// CSV import column mapping (shared between CsvImportModal and saved profiles)
export type CsvFieldName = 'Item Name' | 'Category' | 'Amount' | 'Currency' | 'Type';
export type CsvFieldMapping = Partial<Record<CsvFieldName, string>>;

export type BackupCadence = 'off' | 'daily' | 'weekly' | 'monthly';
export type BackupMode = 'download' | 'fsa';

export interface AutoBackupConfig {
  enabled: boolean;
  cadence: BackupCadence;
  mode: BackupMode;
  lastRunISO?: string;
}

export interface AutoBackupRecord {
  id?: number;
  createdAt: string;
  trigger: 'snapshot' | 'goal' | 'preferences' | 'manual';
  snapshots: Snapshot[];
  goals: Goal[];
  preferences: UserPreferences;
  /**
   * When the app lock is active, the snapshots/goals/preferences payload is stored
   * encrypted here (and the plaintext arrays above are emptied) so local recovery points
   * never leak amounts at rest. Decrypted back on read. See `src/utils/autoBackup.ts`.
   */
  enc?: string;
}

export type ViewMode = 'overall' | 'liquid' | 'investable';

export interface BackupData {
  version: number;
  exportDate: string;
  snapshots: Snapshot[];
  goals: Goal[];
  preferences: UserPreferences;
}

export interface CloudSyncConfig {
  provider: 'google' | null;
  enabled: boolean;
  clientId?: string | null;
  lastSyncISO?: string;
  lastError?: string;
  encryptionEnabled?: boolean;
  syncMode?: 'merge' | 'override';
}

/**
 * Opt-in local app lock that encrypts snapshot/goal data at rest. See
 * `src/utils/cloudSync/keyVault.ts` and `src/utils/appLock.ts`.
 */
export interface AppLockConfig {
  enabled: boolean;
  /** Re-lock after this many minutes idle. 0 = only lock on tab close. */
  autoLockMinutes: number;
  /** Which recovery methods the user has set up. */
  recovery: { code: boolean; googleEscrow: boolean };
  /** Passkey (WebAuthn) unlock registered. */
  webauthnEnabled?: boolean;
}

export interface UserPreferences {
  baseCurrency: string;
  enabledCurrencies: string[];
  theme: 'dark' | 'light' | 'system';
  profileName: string;
  customCategories?: CategoryTemplate[];
  categoryTemplates?: CategoryTemplate[];
  autoBackup?: AutoBackupConfig;
  staleBackupSnoozeUntil?: string;
  cloudSync?: CloudSyncConfig;
  appLock?: AppLockConfig;
  notificationReminders?: boolean;
  csvMappingProfiles?: Record<string, CsvFieldMapping>; // saved column mappings, keyed by user-given name
  /** Digit-grouping style for all displayed amounts. 'auto' derives it from baseCurrency. */
  numberFormat?: 'auto' | 'lakh' | 'international';
}
