import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Goal, GoalType, Milestone } from '../../types';
import { X, Plus, Trash2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { CurrencyDisplay } from '../common/CurrencyDisplay';
import { useDecimalInput } from '../../hooks/useDecimalInput';
import './GoalEditor.css';

interface GoalEditorProps {
  onClose: () => void;
  editGoal?: Goal;
}

export const GoalEditor: React.FC<GoalEditorProps> = ({ onClose, editGoal }) => {
  const { saveGoal, preferences } = useApp();
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

  const targetAmountInput = useDecimalInput({ value: targetAmount, onCommit: setTargetAmount, precision: 2, min: 0 });
  const annualExpensesInput = useDecimalInput({ value: annualExpenses, onCommit: setAnnualExpenses, precision: 2, min: 0 });
  const multiplierInput = useDecimalInput({ value: multiplier, onCommit: setMultiplier, precision: 0, min: 1 });
  const expectedReturnInput = useDecimalInput({ value: expectedReturn, onCommit: setExpectedReturn, precision: 2, min: 0 });
  const inflationRateInput = useDecimalInput({ value: inflationRate, onCommit: setInflationRate, precision: 2, min: 0 });
  const annualSavingsGrowthInput = useDecimalInput({ value: annualSavingsGrowth, onCommit: setAnnualSavingsGrowth, precision: 2, min: 0 });
  const milestonAmountInput = useDecimalInput({ value: newMilestoneAmount, onCommit: setNewMilestoneAmount, precision: 2, min: 0 });

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
    };

    if (targetDate) goal.targetDate = targetDate;

    if (type === 'fire') {
      goal.annualExpenses = annualExpenses;
      goal.multiplier = multiplier;
      goal.targetAmount = annualExpenses * multiplier;
      goal.expectedReturn = expectedReturn;
      goal.inflationRate = inflationRate;
      if (annualSavingsGrowth > 0) goal.annualSavingsGrowth = annualSavingsGrowth;
    }

    await saveGoal(goal);
    onClose();
  };

  return (
    <Modal onClose={onClose} aria-label={editGoal ? 'Edit Goal' : 'Create New Goal'}>
      <div className="modal-header">
        <h2 className="text-h2">{editGoal ? 'Edit Goal' : 'Create New Goal'}</h2>
        <button className="btn-icon" onClick={onClose} aria-label="Close"><X size={20} /></button>
      </div>

      <form onSubmit={handleSubmit} className="goal-form">
        <div className="form-group">
          <label htmlFor="goal-type">Goal Type</label>
          <select id="goal-type" value={type} onChange={e => setType(e.target.value as GoalType)} className="form-input" disabled={!!editGoal}>
            <option value="fire">FIRE (Financial Independence)</option>
            <option value="net_worth_target">Net Worth Target</option>
            <option value="savings">Savings Goal</option>
            <option value="debt_freedom">Debt Payoff</option>
            <option value="custom">Custom Milestone</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="goal-name">Goal Name</label>
          <input
            id="goal-name"
            type="text"
            className="form-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={type === 'fire' ? 'e.g. Lean FIRE' : 'e.g. First 1 Crore'}
            required
          />
        </div>

        {type === 'fire' ? (
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label htmlFor="goal-expenses">Estimated Annual Expenses ({baseCurrency})</label>
              <input
                id="goal-expenses"
                {...annualExpensesInput.inputProps}
                className="form-input"
                placeholder="12,00,000.00"
                aria-label={`Annual expenses in ${baseCurrency}`}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="goal-multiplier">Multiplier (Rule of 25)</label>
              <input
                id="goal-multiplier"
                {...multiplierInput.inputProps}
                className="form-input"
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
              className="form-input"
              placeholder="1,00,00,000.00"
              aria-label={`Target amount in ${baseCurrency}`}
            />
          </div>
        )}

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
                  <label htmlFor="goal-return">Expected Return (%/yr)</label>
                  <input id="goal-return" {...expectedReturnInput.inputProps} className="form-input" aria-label="Expected annual return percent" />
                </div>
                <div className="form-group">
                  <label htmlFor="goal-inflation">Inflation (%/yr)</label>
                  <input id="goal-inflation" {...inflationRateInput.inputProps} className="form-input" aria-label="Annual inflation rate percent" />
                </div>
                <div className="form-group">
                  <label htmlFor="goal-savings-growth">Savings Growth (%/yr)</label>
                  <input id="goal-savings-growth" {...annualSavingsGrowthInput.inputProps} className="form-input" aria-label="Annual savings growth percent" />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="goal-date">Target Date (Optional)</label>
          <input
            id="goal-date"
            type="date"
            className="form-input"
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Milestones (Optional)</label>
          {milestones.length > 0 && (
            <div className="milestone-list">
              {milestones.map(m => (
                <div key={m.id} className="milestone-list__item">
                  <span className="milestone-list__label">{m.label}</span>
                  <span className="milestone-list__amount">
                    <CurrencyDisplay amount={m.targetAmount} currency={baseCurrency} />
                  </span>
                  <button type="button" className="btn-icon danger" aria-label="Remove milestone" onClick={() => handleRemoveMilestone(m.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="milestone-add-row">
            <input
              type="text"
              className="form-input"
              placeholder="Milestone label"
              value={newMilestoneLabel}
              onChange={e => setNewMilestoneLabel(e.target.value)}
            />
            <input
              {...milestonAmountInput.inputProps}
              className="form-input"
              placeholder="0.00"
              style={{ maxWidth: '120px' }}
              aria-label={`Milestone amount in ${baseCurrency}`}
            />
            <button type="button" className="btn btn-outline" onClick={handleAddMilestone}>
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">{editGoal ? 'Update Goal' : 'Save Goal'}</button>
        </div>
      </form>
    </Modal>
  );
};
