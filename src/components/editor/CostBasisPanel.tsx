import React from 'react';
import { LineItem } from '../../types';
import { CurrencyDisplay } from '../common/CurrencyDisplay';

interface CostBasisPanelProps {
  item: LineItem;
  onChange: (updated: LineItem) => void;
  purchasePriceInputProps: React.InputHTMLAttributes<HTMLInputElement>;
  statedRateInputProps: React.InputHTMLAttributes<HTMLInputElement>;
  hasLoanConfig: boolean;
  hasCostBasis: boolean;
  hasStatedRate: boolean;
  gainLoss: { gain: number; gainPct: number } | null;
  cagr: { rate: number } | { reason: string } | null;
  onClear: () => void;
}

export const CostBasisPanel: React.FC<CostBasisPanelProps> = ({
  item, onChange, purchasePriceInputProps, statedRateInputProps,
  hasLoanConfig, hasCostBasis, hasStatedRate, gainLoss, cagr, onClear,
}) => (
  <div className="cost-basis-config">
    <div className="cost-basis-fields">
      <div className="loan-field">
        <label className="loan-label">Purchase Price ({item.currency})</label>
        <input
          {...purchasePriceInputProps}
          className="line-item-input loan-input"
          placeholder="e.g. 100000"
          aria-label="Purchase price"
        />
      </div>
      <div className="loan-field">
        <label className="loan-label">Purchase Date</label>
        <input
          type="date"
          className="line-item-input loan-input"
          value={item.purchaseDate ?? ''}
          onChange={e => onChange({ ...item, purchaseDate: e.target.value || undefined })}
          aria-label="Purchase date"
        />
      </div>
      <div className="loan-field">
        <label className="loan-label">Stated return % p.a.</label>
        <input
          {...statedRateInputProps}
          className="line-item-input loan-input"
          placeholder="e.g. 5"
          aria-label="Stated annual return rate"
          title="Known fixed yield for savings, FDs, bonds. Overrides the computed CAGR in reports."
        />
      </div>
    </div>
    <div className="cost-basis-foot">
      {hasLoanConfig ? (
        <span className="loan-hint">Return tracking is not applicable to auto-calculated loan balances.</span>
      ) : (
        <>
          {hasStatedRate && (
            <span
              className="gain-positive"
              title="Stated fixed annual yield — used as this account's return in reports, in place of a computed CAGR."
            >
              Return&nbsp;{item.statedReturnRate}% p.a. (stated)
            </span>
          )}
          {gainLoss && (
            <span
              className={gainLoss.gain >= 0 ? 'gain-positive' : 'gain-negative'}
              aria-label={gainLoss.gain >= 0 ? 'Unrealised gain' : 'Unrealised loss'}
            >
              {gainLoss.gain >= 0 ? '↑ ' : '↓ '}<CurrencyDisplay amount={Math.abs(gainLoss.gain)} currency={item.currency} />
              {' '}({gainLoss.gainPct >= 0 ? '+' : ''}{gainLoss.gainPct.toFixed(1)}%)
            </span>
          )}
          {!hasStatedRate && cagr && 'rate' in cagr && (
            <span
              className={cagr.rate >= 0 ? 'gain-positive' : 'gain-negative'}
              title="Compound annual growth rate (CAGR) from the purchase date to this snapshot. Point-to-point only — it does not account for any money added or withdrawn in between."
            >
              CAGR&nbsp;{(cagr.rate * 100).toFixed(1)}%
            </span>
          )}
          {!hasStatedRate && cagr && 'reason' in cagr && (
            <span className="loan-hint" style={{ marginLeft: 4 }}>{cagr.reason}</span>
          )}
          {!hasStatedRate && !gainLoss && (
            item.purchasePrice && item.purchasePrice > 0 && !item.purchaseDate ? (
              <span className="loan-hint">Add a purchase date to see unrealised gain and annualised return.</span>
            ) : (
              <span className="loan-hint">Enter a purchase price &amp; date (market holdings), or a stated rate (savings, FD), to report a return.</span>
            )
          )}
        </>
      )}
      {(hasCostBasis || hasStatedRate) && (
        <button className="btn-link loan-clear" onClick={onClear}>
          Clear
        </button>
      )}
    </div>
  </div>
);
