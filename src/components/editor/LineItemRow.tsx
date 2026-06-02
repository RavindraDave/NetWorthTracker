import React, { useRef, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { LineItem } from '../../types';
import { convertToBase } from '../../utils/calculations';
import { calculateOutstandingBalance, isLoanConfigComplete } from '../../utils/loanCalculator';
import { CurrencyDisplay } from '../common/CurrencyDisplay';
import { InclusionChips, exclusionStateToInclusion, inclusionToExclusionState } from '../common/InclusionChips';
import { useDecimalInput } from '../../hooks/useDecimalInput';
import { Trash2, Calculator } from 'lucide-react';
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

  const hasLoanConfig = isLoanConfigComplete(
    item.loanPrincipal, item.annualInterestRate, item.tenureMonths, item.loanStartMonth
  );

  // Show loan section if it was previously configured, or user toggled it open
  const [loanOpen, setLoanOpen] = useState(() => hasLoanConfig);

  const baseAmount = convertToBase(item.amount, item.currency, baseCurrency, exchangeRates);

  const amountInput = useDecimalInput({
    value: item.amount,
    onCommit: (next) => onChange({ ...item, amount: next }),
    precision: 2,
    min: 0,
    max: 1e15,
  });

  const principalInput = useDecimalInput({
    value: item.loanPrincipal ?? 0,
    onCommit: (next) => onChange({ ...item, loanPrincipal: next || undefined }),
    precision: 0,
    min: 0,
    max: 1e15,
    blankZero: true,
  });

  const rateInput = useDecimalInput({
    value: item.annualInterestRate ?? 0,
    onCommit: (next) => onChange({ ...item, annualInterestRate: next }),
    precision: 2,
    min: 0,
    max: 100,
    blankZero: true,
  });

  const tenureInput = useDecimalInput({
    value: item.tenureMonths ?? 0,
    onCommit: (next) => onChange({ ...item, tenureMonths: next ? Math.round(next) : undefined }),
    precision: 0,
    min: 0,
    max: 600,
    blankZero: true,
  });

  // Stable reference to onChange so the auto-compute effect doesn't re-run on identity change
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

  const exclusionState = getExclusionState(item);
  const inclusionVal = exclusionStateToInclusion(exclusionState);

  // Computed outstanding for display
  const computedOutstanding = hasLoanConfig
    ? Math.round(calculateOutstandingBalance(
        item.loanPrincipal!, item.annualInterestRate!, item.tenureMonths!, item.loanStartMonth!, snapshotMonth
      ))
    : null;

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

        <InclusionChips
          value={inclusionVal}
          onChange={next => onChange(applyExclusionState(item, inclusionToExclusionState(next)))}
          size="sm"
        />

        <div className="line-item-actions">
          <button
            className={`btn-icon${hasLoanConfig ? ' loan-active' : ''}`}
            onClick={() => setLoanOpen(o => !o)}
            title={loanOpen ? 'Hide loan configuration' : 'Configure as amortising loan'}
            aria-label="Loan calculator"
            aria-expanded={loanOpen}
          >
            <Calculator size={14} />
          </button>
          <button
            className="btn-icon danger"
            onClick={() => onRemove(item.id)}
            title="Remove item"
            aria-label="Remove item"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {loanOpen && (
        <div className="loan-config">
          <div className="loan-config-fields">
            <div className="loan-field">
              <label className="loan-label">Principal</label>
              <input
                {...principalInput.inputProps}
                className="line-item-input loan-input"
                placeholder="e.g. 8000000"
                aria-label="Loan principal"
              />
            </div>
            <div className="loan-field">
              <label className="loan-label">Rate % p.a.</label>
              <input
                {...rateInput.inputProps}
                className="line-item-input loan-input"
                placeholder="e.g. 8.5"
                aria-label="Annual interest rate"
              />
            </div>
            <div className="loan-field">
              <label className="loan-label">Tenure (mo)</label>
              <input
                {...tenureInput.inputProps}
                className="line-item-input loan-input"
                placeholder="e.g. 240"
                aria-label="Loan tenure in months"
              />
            </div>
            <div className="loan-field">
              <label className="loan-label">Start month</label>
              <input
                type="month"
                className="line-item-input loan-input"
                value={item.loanStartMonth ?? ''}
                onChange={e => onChange({ ...item, loanStartMonth: e.target.value || undefined })}
                aria-label="Loan start month"
              />
            </div>
          </div>

          <div className="loan-config-foot">
            {computedOutstanding !== null ? (
              <span className="loan-computed">
                Outstanding ({snapshotMonth}):&nbsp;
                <CurrencyDisplay amount={computedOutstanding} currency={item.currency} />
              </span>
            ) : (
              <span className="loan-hint">Fill all fields to auto-calculate the outstanding balance.</span>
            )}
            {hasLoanConfig && (
              <button className="btn-link loan-clear" onClick={clearLoan}>
                Clear loan
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const LineItemRow = React.memo(LineItemRowBase);
