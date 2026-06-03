import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Goal, GoalType, Milestone, TaxParams } from '../../types';
import { DEFAULT_TAX_PARAMS } from '../../utils/taxCalculator';
import { X, Plus, Trash2, EyeOff, ShieldCheck } from 'lucide-react';
import { Modal } from '../common/Modal';
import { CurrencyDisplay } from '../common/CurrencyDisplay';
import { useDecimalInput } from '../../hooks/useDecimalInput';
import './GoalEditor.css';

interface GoalEditorProps {
  onClose: () => void;
  editGoal?: Goal;
}

export const GoalEditor: React.FC<GoalEditorProps> = ({ onClose, editGoal }) => {
  const { saveGoal, preferences, currentSnapshot } = useApp();
  const baseCurrency = preferences?.baseCurrency || 'INR';

  const [type, setType] = useState<GoalType>(editGoal?.type ?? 'fire');
  const [name, setName] = useState(editGoal?.name ?? '');
  const [targetAmount, setTargetAmount] = useState(editGoal?.targetAmount ?? 0);
  const [targetDate, setTargetDate] = useState(editGoal?.targetDate ?? '');
  const [annualExpenses, setAnnualExpenses] = useState(editGoal?.annualExpenses ?? 0);
  const [multiplier, setMultiplier] = useState(editGoal?.multiplier ?? 25);
  const [expectedReturn, setExpectedReturn] = useState(editGoal?.expectedReturn ?? 7);
  const [inflationRate, setInflationRate] = useState(editGoal?.inflationRate ?? 3);
  const [annualSavingsGrowth, setAnnualSavingsGrowth] = useState(editGoal?.annualSavingsGrowth ?? 0);
  const [showAdvanced, setShowAdvanced] = useState(
    !!(editGoal && (editGoal.expectedReturn || editGoal.inflationRate || editGoal.annualSavingsGrowth))
  );
  const [milestones, setMilestones] = useState<Milestone[]>(editGoal?.milestones ?? []);
  const [newMilestoneLabel, setNewMilestoneLabel] = useState('');
  const [newMilestoneAmount, setNewMilestoneAmount] = useState(0);
  const [excludedCategoryIds, setExcludedCategoryIds] = useState<string[]>(editGoal?.excludedCategoryIds ?? []);

  // E3 — tax settings
  const [taxEnabled, setTaxEnabled] = useState(!!editGoal?.taxParams);
  const [showTaxSection, setShowTaxSection] = useState(!!editGoal?.taxParams);
  const [taxParams, setTaxParams] = useState<TaxParams>(editGoal?.taxParams ?? DEFAULT_TAX_PARAMS);
  const setTaxField = (field: keyof TaxParams) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    if (Number.isFinite(v) && v >= 0) setTaxParams(prev => ({ ...prev, [field]: v }));
  };

  const assetCategories = currentSnapshot?.categories.filter(c => c.type === 'asset') ?? [];

  const targetAmountInput = useDecimalInput({ value: targetAmount, onCommit: setTargetAmount, precision: 2, min: 0 });
  const annualExpensesInput = useDecimalInput({ value: annualExpenses, onCommit: setAnnualExpenses, precision: 2, min: 0 });
  const multiplierInput = useDecimalInput({ value: multiplier, onCommit: setMultiplier, precision: 0, min: 1 });
  const expectedReturnInput = useDecimalInput({ value: expectedReturn, onCommit: setExpectedReturn, precision: 2, min: 0 });
  const inflationRateInput = useDecimalInput({ value: inflationRate, onCommit: setInflationRate, precision: 2, min: 0 });
  const annualSavingsGrowthInput = useDecimalInput({ value: annualSavingsGrowth, onCommit: setAnnualSavingsGrowth, precision: 2, min: 0 });
  const milestonAmountInput = useDecimalInput({ value: newMilestoneAmount, onCommit: setNewMilestoneAmount, precision: 2, min: 0, blankZero: true });

  const handleAddMilestone = () => {
    if (!newMilestoneLabel.trim() || newMilestoneAmount <= 0) return;
    setMilestones(prev => [...prev, { id: crypto.randomUUID(), label: newMilestoneLabel.trim(), targetAmount: newMilestoneAmount }]);
    setNewMilestoneLabel('');
    setNewMilestoneAmount(0);
  };

  const handleRemoveMilestone = (id: string) => {
    setMilestones(prev => prev.filter(m => m.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const goal: Goal = {
      id: editGoal?.id ?? crypto.randomUUID(),
      name: name || (type === 'fire' ? 'FIRE Target' : 'New Goal'),
      type,
      targetAmount: type === 'fire' ? 0 : targetAmount,
      createdAt: editGoal?.createdAt ?? new Date().toISOString(),
      milestones: milestones.length > 0 ? milestones : undefined,
      excludedCategoryIds: excludedCategoryIds.length > 0 ? excludedCategoryIds : undefined,
    };

    if (targetDate) goal.targetDate = targetDate;

    if (type === 'fire') {
      goal.annualExpenses = annualExpenses;
      goal.multiplier = multiplier;
      goal.targetAmount = annualExpenses * multiplier;
      goal.expectedReturn = expectedReturn;
      goal.inflationRate = inflationRate;
      if (annualSavingsGrowth > 0) goal.annualSavingsGrowth = annualSavingsGrowth;
      if (taxEnabled) goal.taxParams = taxParams;
    }

    await saveGoal(goal);
    onClose();
  };

  return (
    <Modal onClose={onClose} aria-label={editGoal ? 'Edit Goal' : 'Create New Goal'}>
      {/* Sticky header */}
      <div className="modal-header">
        <div>
          <h2 className="text-h2" style={{ marginBottom: '0.1rem' }}>
            {editGoal ? 'Edit Goal' : 'New Goal'}
          </h2>
          <p className="text-muted" style={{ fontSize: '0.75rem' }}>
            {type === 'fire' ? 'Financial Independence, Retire Early' :
             type === 'net_worth_target' ? 'Net worth milestone' :
             type === 'savings' ? 'Savings target' :
             type === 'debt_freedom' ? 'Debt payoff' : 'Custom milestone'}
          </p>
        </div>
        <button className="btn-icon" onClick={onClose} aria-label="Close"><X size={20} /></button>
      </div>

      {/* Scrollable body */}
      <div className="modal-body">
        <form id="goal-form" onSubmit={handleSubmit} className="goal-form">

          {/* Type + Name in a compact row */}
          <div className="form-row">
            <div className="form-group" style={{ flex: '0 0 180px' }}>
              <label htmlFor="goal-type">Type</label>
              <select id="goal-type" value={type} onChange={e => setType(e.target.value as GoalType)} className="form-input form-input--sm" disabled={!!editGoal}>
                <option value="fire">FIRE</option>
                <option value="net_worth_target">Net Worth Target</option>
                <option value="savings">Savings</option>
                <option value="debt_freedom">Debt Payoff</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="goal-name">Name</label>
              <input
                id="goal-name"
                type="text"
                className="form-input form-input--sm"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={type === 'fire' ? 'e.g. Lean FIRE' : 'e.g. First 1 Crore'}
                required
              />
            </div>
          </div>

          {/* FIRE fields */}
          {type === 'fire' ? (
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label htmlFor="goal-expenses">Annual Expenses ({baseCurrency})</label>
                <input
                  id="goal-expenses"
                  {...annualExpensesInput.inputProps}
                  className="form-input form-input--sm"
                  placeholder="12,00,000"
                  aria-label={`Annual expenses in ${baseCurrency}`}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label htmlFor="goal-multiplier">Multiplier</label>
                <input
                  id="goal-multiplier"
                  {...multiplierInput.inputProps}
                  className="form-input form-input--sm"
                  aria-label="FIRE multiplier"
                />
              </div>
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="goal-amount">Target Amount ({baseCurrency})</label>
              <input
                id="goal-amount"
                {...targetAmountInput.inputProps}
                className="form-input form-input--sm"
                placeholder="1,00,00,000"
                aria-label={`Target amount in ${baseCurrency}`}
              />
            </div>
          )}

          {/* FIRE advanced */}
          {type === 'fire' && (
            <div className="fire-advanced-section">
              <button
                type="button"
                className="fire-advanced-toggle"
                aria-expanded={showAdvanced}
                onClick={() => setShowAdvanced(v => !v)}
              >
                <span>Advanced projection settings</span>
                <span className={`fire-advanced-chevron ${showAdvanced ? 'open' : ''}`}>▾</span>
              </button>
              {showAdvanced && (
                <div className="form-row fire-advanced-row">
                  <div className="form-group">
                    <label htmlFor="goal-return">Return (%/yr)</label>
                    <input id="goal-return" {...expectedReturnInput.inputProps} className="form-input form-input--sm" aria-label="Expected annual return" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="goal-inflation">Inflation (%/yr)</label>
                    <input id="goal-inflation" {...inflationRateInput.inputProps} className="form-input form-input--sm" aria-label="Annual inflation rate" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="goal-savings-growth">Savings Growth (%/yr)</label>
                    <input id="goal-savings-growth" {...annualSavingsGrowthInput.inputProps} className="form-input form-input--sm" aria-label="Annual savings growth" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* E3 — Tax settings (FIRE only) */}
          {type === 'fire' && (
            <div className="fire-advanced-section">
              <button
                type="button"
                className="fire-advanced-toggle"
                aria-expanded={showTaxSection}
                onClick={() => setShowTaxSection(v => !v)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShieldCheck size={13} style={{ opacity: 0.7 }} />
                  Tax-aware withdrawal
                </span>
                <span className={`fire-advanced-chevron ${showTaxSection ? 'open' : ''}`}>▾</span>
              </button>
              {showTaxSection && (
                <div style={{ padding: '0.75rem 0 0.25rem' }}>
                  <label className="fire-tax-toggle-label">
                    <input
                      type="checkbox"
                      checked={taxEnabled}
                      onChange={e => setTaxEnabled(e.target.checked)}
                    />
                    <span>Show post-tax income in FIRE dashboard</span>
                  </label>
                  {taxEnabled && (
                    <div className="fire-tax-grid">
                      <div className="form-group">
                        <label className="form-label-sm" htmlFor="tax-equity-pct">Equity % of corpus</label>
                        <input id="tax-equity-pct" type="number" className="form-input form-input--sm"
                          value={taxParams.equityPct} onChange={setTaxField('equityPct')} min={0} max={100} step={5} />
                      </div>
                      <div className="form-group">
                        <label className="form-label-sm" htmlFor="tax-ltcg-pct">LTCG % of equity</label>
                        <input id="tax-ltcg-pct" type="number" className="form-input form-input--sm"
                          value={taxParams.ltcgPct} onChange={setTaxField('ltcgPct')} min={0} max={100} step={5} />
                      </div>
                      <div className="form-group">
                        <label className="form-label-sm" htmlFor="tax-ltcg-rate">LTCG rate %</label>
                        <input id="tax-ltcg-rate" type="number" className="form-input form-input--sm"
                          value={taxParams.ltcgRate} onChange={setTaxField('ltcgRate')} min={0} max={50} step={0.5} />
                      </div>
                      <div className="form-group">
                        <label className="form-label-sm" htmlFor="tax-stcg-rate">STCG rate %</label>
                        <input id="tax-stcg-rate" type="number" className="form-input form-input--sm"
                          value={taxParams.stcgRate} onChange={setTaxField('stcgRate')} min={0} max={50} step={0.5} />
                      </div>
                      <div className="form-group">
                        <label className="form-label-sm" htmlFor="tax-debt-rate">Debt rate %</label>
                        <input id="tax-debt-rate" type="number" className="form-input form-input--sm"
                          value={taxParams.debtRate} onChange={setTaxField('debtRate')} min={0} max={50} step={1} />
                      </div>
                      <div className="form-group">
                        <label className="form-label-sm" htmlFor="tax-exemption">LTCG exemption</label>
                        <input id="tax-exemption" type="number" className="form-input form-input--sm"
                          value={taxParams.ltcgExemption} onChange={setTaxField('ltcgExemption')} min={0} step={25000} />
                      </div>
                    </div>
                  )}
                  <p className="form-hint" style={{ marginTop: '0.35rem' }}>
                    Defaults: India Budget 2024 (LTCG 12.5% above ₹1.25L, STCG 20%, debt at slab, 4% cess).
                    Applies to the investable corpus only.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Target date */}
          <div className="form-group">
            <label htmlFor="goal-date">Target Date <span className="form-label-optional">optional</span></label>
            <input
              id="goal-date"
              type="date"
              className="form-input form-input--sm"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
            />
          </div>

          {/* Category exclusions */}
          {assetCategories.length > 0 && (
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <EyeOff size={12} style={{ opacity: 0.55 }} />
                Exclude categories <span className="form-label-optional">optional</span>
              </label>
              <p className="form-hint">Ticked categories won't count toward this goal (e.g. primary home in Real Estate).</p>
              <div className="exclusion-grid">
                {assetCategories.map(cat => {
                  const checked = excludedCategoryIds.includes(cat.id);
                  return (
                    <label key={cat.id} className={`exclusion-chip ${checked ? 'exclusion-chip--active' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setExcludedCategoryIds(prev =>
                            prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                          )
                        }
                      />
                      <span>{cat.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Milestones */}
          <div className="form-group">
            <label>Milestones <span className="form-label-optional">optional</span></label>
            {milestones.length > 0 && (
              <div className="milestone-list">
                {milestones.map(m => (
                  <div key={m.id} className="milestone-list__item">
                    <span className="milestone-list__label">{m.label}</span>
                    <span className="milestone-list__amount">
                      <CurrencyDisplay amount={m.targetAmount} currency={baseCurrency} />
                    </span>
                    <button type="button" className="btn-icon danger" aria-label="Remove milestone" onClick={() => handleRemoveMilestone(m.id)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="milestone-add-row">
              <input
                type="text"
                className="form-input form-input--sm"
                placeholder="Label"
                value={newMilestoneLabel}
                onChange={e => setNewMilestoneLabel(e.target.value)}
              />
              <input
                {...milestonAmountInput.inputProps}
                className="form-input form-input--sm"
                placeholder={baseCurrency}
                style={{ maxWidth: '110px' }}
                aria-label={`Milestone amount in ${baseCurrency}`}
              />
              <button type="button" className="btn btn-outline" style={{ padding: '0.45rem 0.75rem' }} onClick={handleAddMilestone}>
                <Plus size={14} />
              </button>
            </div>
          </div>

        </form>
      </div>

      {/* Sticky footer */}
      <div className="modal-footer">
        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button type="submit" form="goal-form" className="btn btn-primary">
          {editGoal ? 'Update Goal' : 'Save Goal'}
        </button>
      </div>
    </Modal>
  );
};
