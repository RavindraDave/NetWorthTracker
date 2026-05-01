export interface Snapshot {
  id: string;
  month: string; // "YYYY-MM"
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  exchangeRates: Record<string, number>; // e.g., { "SGD": 72, "USD": 83 }
  ratesLastUpdated?: string; // ISO string — set when user refreshes or manually edits rates
  categories: Category[];
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
}

export type GoalType = 'net_worth_target' | 'fire' | 'savings' | 'debt_freedom' | 'custom';

export interface Goal {
  id: string;
  type: GoalType;
  name: string;
  createdAt: string;
  targetAmount: number;
  targetDate?: string;
  annualExpenses?: number;
  withdrawalRate?: number; // Default 4
  multiplier?: number; // Default 25
  milestones: Milestone[];
}

export interface Milestone {
  id: string;
  amount: number;
  name: string;
  reachedDate?: string;
}

export interface UserPreferences {
  baseCurrency: string;
  enabledCurrencies: string[];
  theme: 'dark';
  profileName: string;
}
