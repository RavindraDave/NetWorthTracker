import { Category, CategoryTemplate } from '../types';

export const DEFAULT_CATEGORY_TEMPLATES: CategoryTemplate[] = [
  { id: 'default-cash',             name: 'Cash & Bank Accounts',                    type: 'asset',     icon: 'wallet',       isLiquid: true,  isInvestable: true,  isBuiltIn: true },
  { id: 'default-investments',      name: 'Investments',                             type: 'asset',     icon: 'trending-up',  isLiquid: true,  isInvestable: true,  isBuiltIn: true },
  { id: 'default-retirement',       name: 'Retirement (EPF/PPF/NPS/CPF)',            type: 'asset',     icon: 'piggy-bank',   isLiquid: false, isInvestable: true,  isBuiltIn: true },
  { id: 'default-real-estate',      name: 'Real Estate',                             type: 'asset',     icon: 'home',         isLiquid: false, isInvestable: true,  isBuiltIn: true },
  { id: 'default-precious-metals',  name: 'Precious Metals',                         type: 'asset',     icon: 'coins',        isLiquid: false, isInvestable: true,  isBuiltIn: true },
  { id: 'default-personal-prop',    name: 'Personal Property',                       type: 'asset',     icon: 'car',          isLiquid: false, isInvestable: false, isBuiltIn: true },
  { id: 'default-business',         name: 'Business',                                type: 'asset',     icon: 'briefcase',    isLiquid: false, isInvestable: true,  isBuiltIn: true },
  { id: 'default-foreign',          name: 'Foreign Holdings',                        type: 'asset',     icon: 'globe',        isLiquid: false, isInvestable: true,  isBuiltIn: true },
  { id: 'default-secured-debt',     name: 'Secured Debt (Mortgage, Car)',            type: 'liability', icon: 'building',     isLiquid: false, isInvestable: false, isBuiltIn: true },
  { id: 'default-unsecured-debt',   name: 'Unsecured Debt (Credit Cards, Personal)', type: 'liability', icon: 'credit-card',  isLiquid: false, isInvestable: false, isBuiltIn: true },
  { id: 'default-tax',              name: 'Tax Liabilities',                         type: 'liability', icon: 'file-text',    isLiquid: false, isInvestable: false, isBuiltIn: true },
  { id: 'default-other-liab',       name: 'Other Liabilities',                       type: 'liability', icon: 'alert-circle', isLiquid: false, isInvestable: false, isBuiltIn: true },
];

export function buildCategoryFromTemplate(tmpl: CategoryTemplate): Category {
  return {
    id: tmpl.id,
    name: tmpl.name,
    type: tmpl.type,
    icon: tmpl.icon,
    isLiquid: tmpl.isLiquid,
    isInvestable: tmpl.isInvestable,
    items: [],
  };
}

export const generateDefaultCategories = (): Category[] =>
  DEFAULT_CATEGORY_TEMPLATES.map(buildCategoryFromTemplate);
