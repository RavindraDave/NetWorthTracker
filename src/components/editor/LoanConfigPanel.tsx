import React from 'react';
import { LineItem } from '../../types';
import { CurrencyDisplay } from '../common/CurrencyDisplay';

interface LoanSummary {
  emi: number;
  totalInterest: number;
}

interface LoanConfigPanelProps {
  item: LineItem;
  onChange: (updated: LineItem) => void;
  principalInputProps: React.InputHTMLAttributes<HTMLInputElement>;
  rateInputProps: React.InputHTMLAttributes<HTMLInputElement>;
  tenureInputProps: React.InputHTMLAttributes<HTMLInputElement>;
  hasLoanConfig: boolean;
  computedOutstanding: number | null;
  loanSummary: LoanSummary | null;
  snapshotMonth: string;
  onClear: () => void;
}

export const LoanConfigPanel: React.FC<LoanConfigPanelProps> = ({
  item, onChange, principalInputProps, rateInputProps, tenureInputProps,
  hasLoanConfig, computedOutstanding, loanSummary, snapshotMonth, onClear,
}) => (
  <div className="loan-config">
    <div className="loan-config-fields">
      <div className="loan-field">
        <label className="loan-label">Principal</label>
        <input
          {...principalInputProps}
          className="line-item-input loan-input"
          placeholder="e.g. 8000000"
          aria-label="Loan principal"
        />
      </div>
      <div className="loan-field">
        <label className="loan-label">Rate % p.a.</label>
        <input
          {...rateInputProps}
          className="line-item-input loan-input"
          placeholder="e.g. 8.5"
          aria-label="Annual interest rate"
        />
      </div>
      <div className="loan-field">
        <label className="loan-label">Tenure (mo)</label>
        <input
          {...tenureInputProps}
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
      {computedOutstanding !== null && loanSummary ? (
        computedOutstanding === 0 ? (
          <span className="loan-computed">Loan fully paid off as of {snapshotMonth}.</span>
        ) : (
          <span className="loan-computed">
            Outstanding ({snapshotMonth}):&nbsp;
            <CurrencyDisplay amount={computedOutstanding} currency={item.currency} />
            <span className="loan-summary" title="Equated monthly instalment and total interest over the full tenure, at a fixed rate with no prepayments.">
              {' · '}EMI&nbsp;<CurrencyDisplay amount={Math.round(loanSummary.emi)} currency={item.currency} />/mo
              {' · '}Total interest&nbsp;<CurrencyDisplay amount={Math.round(loanSummary.totalInterest)} currency={item.currency} />
            </span>
          </span>
        )
      ) : (
        <span className="loan-hint">Fill all fields to auto-calculate the outstanding balance.</span>
      )}
      {hasLoanConfig && (
        <button className="btn-link loan-clear" onClick={onClear}>
          Clear loan
        </button>
      )}
    </div>
  </div>
);
