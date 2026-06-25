import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { LineItem } from '../../types';
import { convertToBase } from '../../utils/calculations';
import { calculateOutstandingBalance, calculateLoanSummary, isLoanConfigComplete } from '../../utils/loanCalculator';
import { annualisedReturn, monthEndDate } from '../../utils/returns';
import { CurrencyDisplay } from '../common/CurrencyDisplay';
import { InclusionChips, exclusionStateToInclusion, inclusionToExclusionState } from '../common/InclusionChips';
import { useDecimalInput } from '../../hooks/useDecimalInput';
import { resolveNumberLocale } from '../../utils/currencies';
import { CostBasisPanel } from './CostBasisPanel';
import { LoanConfigPanel } from './LoanConfigPanel';
import { Trash2, Calculator, TrendingUp } from 'lucide-react';
import './LineItemRow.css';

type ExclusionState = 'all' | 'goals-only' | 'everywhere';

function getExclusionState(item: LineItem): ExclusionState {
  if (item.excludeFromNetWorth) return 'everywhere';
  if (item.excludeFromGoals)    return 'goals-only';
  return 'all';
}

function applyExclusionState(item: LineItem, state: ExclusionState): LineItem {
  return {
    ...item,
    excludeFromNetWorth: state === 'everywhere',
    excludeFromGoals:    state === 'goals-only',
  };
}

interface LineItemRowProps {
  item: LineItem;
  exchangeRates: Record<string, number>;
  snapshotMonth: string;
  onChange: (updated: LineItem) => void;
  onRemove: (id: string) => void;
}

const LineItemRowBase: React.FC<LineItemRowProps> = ({ item, exchangeRates, snapshotMonth, onChange, onRemove }) => {
  const { preferences } = useApp();
  const baseCurrency = preferences?.baseCurrency || 'INR';
  const enabledCurrencies = preferences?.enabledCurrencies || ['INR', 'USD', 'EUR', 'GBP', 'SGD'];
  const locale = resolveNumberLocale(preferences?.baseCurrency ?? 'INR', preferences?.numberFormat);

  const hasLoanConfig = isLoanConfigComplete(
    item.loanPrincipal, item.annualInterestRate, item.tenureMonths, item.loanStartMonth
  );
  const hasCostBasis = !!(item.purchasePrice && item.purchasePrice > 0 && item.purchaseDate);
  const hasStatedRate = typeof item.statedReturnRate === 'number' && item.statedReturnRate !== 0;

  const [loanOpen, setLoanOpen] = useState(() => hasLoanConfig);
  const [costOpen, setCostOpen] = useState(() => hasCostBasis || hasStatedRate);

  const baseAmount = convertToBase(item.amount, item.currency, baseCurrency, exchangeRates);

  const amountInput = useDecimalInput({
    value: item.amount,
    onCommit: (next) => onChange({ ...item, amount: next }),
    precision: 2,
    min: 0,
    max: 1e15,
    locale,
  });

  const principalInput = useDecimalInput({
    value: item.loanPrincipal ?? 0,
    onCommit: (next) => onChange({ ...item, loanPrincipal: next || undefined }),
    precision: 0,
    min: 0,
    max: 1e15,
    blankZero: true,
    locale,
  });

  const rateInput = useDecimalInput({
    value: item.annualInterestRate ?? 0,
    onCommit: (next) => onChange({ ...item, annualInterestRate: next }),
    precision: 2,
    min: 0,
    max: 100,
    blankZero: true,
    locale,
  });

  const tenureInput = useDecimalInput({
    value: item.tenureMonths ?? 0,
    onCommit: (next) => onChange({ ...item, tenureMonths: next ? Math.round(next) : undefined }),
    precision: 0,
    min: 0,
    max: 600,
    blankZero: true,
    locale,
  });

  const purchasePriceInput = useDecimalInput({
    value: item.purchasePrice ?? 0,
    onCommit: (next) => onChange({ ...item, purchasePrice: next || undefined }),
    precision: 2,
    min: 0,
    max: 1e15,
    blankZero: true,
    locale,
  });

  const statedRateInput = useDecimalInput({
    value: item.statedReturnRate ?? 0,
    onCommit: (next) => onChange({ ...item, statedReturnRate: next || undefined }),
    precision: 2,
    min: 0,
    max: 100,
    blankZero: true,
    locale,
  });

  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  // Auto-compute outstanding balance whenever loan params or snapshot month change
  useEffect(() => {
    if (!isLoanConfigComplete(item.loanPrincipal, item.annualInterestRate, item.tenureMonths, item.loanStartMonth)) return;
    const computed = Math.round(
      calculateOutstandingBalance(
        item.loanPrincipal!,
        item.annualInterestRate!,
        item.tenureMonths!,
        item.loanStartMonth!,
        snapshotMonth,
      )
    );
    if (computed !== Math.round(item.amount)) {
      onChangeRef.current({ ...item, amount: computed });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.loanPrincipal, item.annualInterestRate, item.tenureMonths, item.loanStartMonth, snapshotMonth]);

  const clearLoan = () => {
    onChange({
      ...item,
      loanPrincipal: undefined,
      annualInterestRate: undefined,
      tenureMonths: undefined,
      loanStartMonth: undefined,
    });
    setLoanOpen(false);
  };

  const clearCostBasis = () => {
    onChange({ ...item, purchasePrice: undefined, purchaseDate: undefined, statedReturnRate: undefined });
    setCostOpen(false);
  };

  const exclusionState = getExclusionState(item);
  const inclusionVal = exclusionStateToInclusion(exclusionState);

  const computedOutstanding = hasLoanConfig
    ? Math.round(calculateOutstandingBalance(
        item.loanPrincipal!, item.annualInterestRate!, item.tenureMonths!, item.loanStartMonth!, snapshotMonth
      ))
    : null;

  const loanSummary = hasLoanConfig
    ? calculateLoanSummary(item.loanPrincipal!, item.annualInterestRate!, item.tenureMonths!)
    : null;

  // Unrealised gain/loss — not meaningful when amount is auto-calculated from a loan balance
  const gainLoss = useMemo(() => {
    if (hasLoanConfig) return null;
    if (!item.purchasePrice || item.purchasePrice <= 0) return null;
    const gain = item.amount - item.purchasePrice;
    return { gain, gainPct: (gain / item.purchasePrice) * 100 };
  }, [item.amount, item.purchasePrice, hasLoanConfig]);

  // Annualised return (CAGR) from the single purchase to the current value.
  // This is point-to-point growth — it does not model interim contributions
  // (SIPs, top-ups) or withdrawals, so it is labelled CAGR, not XIRR.
  // Returns either a rate or a reason it can't be shown.
  const cagr = useMemo<{ rate: number } | { reason: string } | null>(() => {
    if (!item.purchasePrice || item.purchasePrice <= 0 || !item.purchaseDate) return null;
    if (item.amount <= 0) return { reason: 'Enter a current value to see the annualised return.' };
    const snapshotDate = monthEndDate(snapshotMonth);
    if (new Date(item.purchaseDate) >= snapshotDate) {
      return { reason: 'Purchase date is on or after this snapshot — no holding period yet.' };
    }
    const rate = annualisedReturn(item.purchasePrice, item.purchaseDate, item.amount, snapshotDate);
    return rate === null ? { reason: "Couldn't compute a return for these values." } : { rate };
  }, [item.purchasePrice, item.purchaseDate, item.amount, snapshotMonth]);

  return (
    <div className="line-item-wrap">
      <div className={`line-item-row${exclusionState === 'everywhere' ? ' li-excluded' : ''}`}>
        <input
          type="text"
          className="line-item-input name-input"
          value={item.name}
          onChange={e => onChange({ ...item, name: e.target.value })}
          placeholder="Item Name"
          aria-label="Item name"
        />

        <select
          className="line-item-select"
          value={item.currency}
          onChange={e => onChange({ ...item, currency: e.target.value })}
          aria-label="Currency"
        >
          {enabledCurrencies.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <input
          {...amountInput.inputProps}
          className={`line-item-input amount-input${hasLoanConfig ? ' amount-auto' : ''}`}
          placeholder="0.00"
          readOnly={hasLoanConfig}
          aria-label={`Amount in ${item.currency}`}
          title={hasLoanConfig ? 'Auto-calculated from loan parameters' : undefined}
        />

        <div className="line-item-base">
          {item.currency !== baseCurrency && (
            <span className="converted-amount">
              ≈ <CurrencyDisplay amount={baseAmount} currency={baseCurrency} />
            </span>
          )}
        </div>

        <button
          className="btn-icon danger line-item-delete"
          onClick={() => onRemove(item.id)}
          title="Remove item"
          aria-label="Remove item"
        >
          <Trash2 size={14} />
        </button>

        <InclusionChips
          value={inclusionVal}
          onChange={next => onChange(applyExclusionState(item, inclusionToExclusionState(next)))}
          size="sm"
        />

        <div className="line-item-toggles">
          <button
            className={`btn-icon cost-basis-btn${(hasCostBasis || hasStatedRate) ? ' cost-active' : ''}`}
            onClick={() => setCostOpen(o => !o)}
            title={costOpen ? 'Hide return tracking' : 'Track return: purchase cost (market holdings) or a stated yield (savings, FD)'}
            aria-label="Toggle return tracking"
            aria-expanded={costOpen}
          >
            <TrendingUp size={14} />
            {(hasCostBasis || hasStatedRate) && <span className="cost-basis-label">Return</span>}
          </button>
          <button
            className={`btn-icon loan-btn${hasLoanConfig ? ' loan-active' : ''}`}
            onClick={() => setLoanOpen(o => !o)}
            title={loanOpen ? 'Hide loan configuration' : 'Configure as amortising loan'}
            aria-label="Loan calculator"
            aria-expanded={loanOpen}
          >
            <Calculator size={14} />
            {hasLoanConfig && <span className="cost-basis-label">Loan</span>}
          </button>
        </div>
      </div>

      {costOpen && (
        <CostBasisPanel
          item={item}
          onChange={onChange}
          purchasePriceInputProps={purchasePriceInput.inputProps}
          statedRateInputProps={statedRateInput.inputProps}
          hasLoanConfig={hasLoanConfig}
          hasCostBasis={hasCostBasis}
          hasStatedRate={hasStatedRate}
          gainLoss={gainLoss}
          cagr={cagr}
          onClear={clearCostBasis}
        />
      )}

      {loanOpen && (
        <LoanConfigPanel
          item={item}
          onChange={onChange}
          principalInputProps={principalInput.inputProps}
          rateInputProps={rateInput.inputProps}
          tenureInputProps={tenureInput.inputProps}
          hasLoanConfig={hasLoanConfig}
          computedOutstanding={computedOutstanding}
          loanSummary={loanSummary}
          snapshotMonth={snapshotMonth}
          onClear={clearLoan}
        />
      )}
    </div>
  );
};

export const LineItemRow = React.memo(LineItemRowBase);
