export interface Snapshot {
  id: string;
  month: string; // "YYYY-MM"
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  exchangeRates: Record<string, number>; // e.g., { "SGD": 72, "USD": 83 }
  ratesLastUpdated?: string; // ISO string — set when user refreshes or manually edits rates
  categories: Category[];
  notes?: string;
  monthlyIncome?: number;
  monthlyExpenses?: number;
}

export interface Category {
  id: string;
  name: string;
  type: 'asset' | 'liability';
  icon: string;
  items: LineItem[];
  isLiquid: boolean;
  isInvestable: boolean;
}

export interface LineItem {
  id: string;
  name: string;
  amount: number;
  currency: string; // ISO code
  notes?: string;
  excludeFromNetWorth?: boolean;
  excludeFromGoals?: boolean;
  // Loan amortisation — when all four are set, outstanding balance is auto-computed
  loanPrincipal?: number;       // Original principal in item.currency
  annualInterestRate?: number;  // % e.g. 8.5
  tenureMonths?: number;        // Total loan term in months
  loanStartMonth?: string;      // "YYYY-MM" of first EMI
  // Cost basis — for unrealised gain/loss and XIRR calculation
  purchasePrice?: number;       // Original cost in item.currency
  purchaseDate?: string;        // "YYYY-MM-DD"
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
}

export interface FlattenedItem extends LineItem {
  categoryName: string;
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
}

export interface CloudSyncConfig {
  provider: 'google' | null;
  enabled: boolean;
  clientId?: string;       // stored when user enters it via Settings UI
  lastSyncISO?: string;
  lastError?: string;
  encryptionEnabled?: boolean;
  syncMode?: 'merge' | 'override'; // default 'merge'
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
  notificationReminders?: boolean;
  csvMappingProfiles?: Record<string, CsvFieldMapping>; // saved column mappings, keyed by user-given name
  /** Digit-grouping style for all displayed amounts. 'auto' derives it from baseCurrency. */
  numberFormat?: 'auto' | 'lakh' | 'international';
}
