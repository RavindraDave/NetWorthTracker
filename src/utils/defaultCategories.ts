import { Category } from '../types';

export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  // Assets
  {
    name: 'Cash & Bank Accounts',
    type: 'asset',
    icon: 'wallet',
    items: [],
    isLiquid: true,
    isInvestable: true,
  },
  {
    name: 'Investments',
    type: 'asset',
    icon: 'trending-up',
    items: [],
    isLiquid: true,
    isInvestable: true,
  },
  {
    name: 'Retirement (EPF/PPF/NPS/CPF)',
    type: 'asset',
    icon: 'piggy-bank',
    items: [],
    isLiquid: false,
    isInvestable: true,
  },
  {
    name: 'Real Estate',
    type: 'asset',
    icon: 'home',
    items: [],
    isLiquid: false,
    isInvestable: true,
  },
  {
    name: 'Precious Metals',
    type: 'asset',
    icon: 'coins',
    items: [],
    isLiquid: false,
    isInvestable: true,
  },
  {
    name: 'Personal Property',
    type: 'asset',
    icon: 'car',
    items: [],
    isLiquid: false,
    isInvestable: false,
  },
  {
    name: 'Business',
    type: 'asset',
    icon: 'briefcase',
    items: [],
    isLiquid: false,
    isInvestable: true,
  },
  {
    name: 'Foreign Holdings',
    type: 'asset',
    icon: 'globe',
    items: [],
    isLiquid: false,
    isInvestable: true,
  },
  // Liabilities
  {
    name: 'Secured Debt (Mortgage, Car)',
    type: 'liability',
    icon: 'building',
    items: [],
    isLiquid: false,
    isInvestable: false,
  },
  {
    name: 'Unsecured Debt (Credit Cards, Personal)',
    type: 'liability',
    icon: 'credit-card',
    items: [],
    isLiquid: false,
    isInvestable: false,
  },
  {
    name: 'Tax Liabilities',
    type: 'liability',
    icon: 'file-text',
    items: [],
    isLiquid: false,
    isInvestable: false,
  },
  {
    name: 'Other Liabilities',
    type: 'liability',
    icon: 'alert-circle',
    items: [],
    isLiquid: false,
    isInvestable: false,
  }
];

export const generateDefaultCategories = (): Category[] => {
  return DEFAULT_CATEGORIES.map(cat => ({
    ...cat,
    id: crypto.randomUUID(),
    items: []
  }));
};
