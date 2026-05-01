import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Goal, GoalType, Milestone } from '../../types';
import { X, Plus, Trash2 } from 'lucide-react';
import './GoalEditor.css';

interface GoalEditorProps {
  onClose: () => void;
  editGoal?: Goal;
}

export const GoalEditor: React.FC<GoalEditorProps> = ({ onClose, editGoal }) => {
  const { saveGoal, preferences } = useApp();
  const baseCurrency = preferences?.baseCurrency || 'INR';
  const modalRef = useRef<HTMLDivElement>(null);

  const [type, setType] = useState<GoalType>(editGoal?.type ?? 'fire');
  const [name, setName] = useState(editGoal?.name ?? '');
  const [targetAmount, setTargetAmount] = useState<string>(editGoal?.targetAmount ? String(editGoal.targetAmount) : '');
  const [targetDate, setTargetDate] = useState(editGoal?.targetDate ?? '');
  const [annualExpenses, setAnnualExpenses] = useState<string>(editGoal?.annualExpenses ? String(editGoal.annualExpenses) : '');
  const [multiplier, setMultiplier] = useState<string>(editGoal?.multiplier ? String(editGoal.multiplier) : '25');
  const [expectedReturn, setExpectedReturn] = useState<string>(editGoal?.expectedReturn != null ? String(editGoal.expectedReturn) : '7');
  const [inflationRate, setInflationRate] = useState<string>(editGoal?.inflationRate != null ? String(editGoal.inflationRate) : '3');
  const [annualSavingsGrowth, setAnnualSavingsGrowth] = useState<string>(editGoal?.annualSavingsGrowth != null ? String(editGoal.annualSavingsGrowth) : '0');
  const [milestones, setMilestones] = useState<Milestone[]>(editGoal?.milestones ?? []);
  const [newMilestoneLabel, setNewMilestoneLabel] = useState('');
  const [newMilestoneAmount, setNewMilestoneAmount] = useState('');

  // Focus trap: keep focus within modal; Escape closes
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    const focusable = 'button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;

      const els = Array.from(modal.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement>(focusable)).filter(el => !el.disabled);
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    modal.addEventListener('keydown', handleKeyDown);
    // Focus first element on open
    const firstEl = modal.querySelector<HTMLElement>(focusable);
    firstEl?.focus();

    return () => modal.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleAddMilestone = () => {
    const amount = parseFloat(newMilestoneAmount);
    if (!newMilestoneLabel.trim() || isNaN(amount) || amount <= 0) return;
    setMilestones(prev => [...prev, { id: crypto.randomUUID(), label: newMilestoneLabel.trim(), targetAmount: amount }]);
    setNewMilestoneLabel('');
    setNewMilestoneAmount('');
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
      targetAmount: type === 'fire' ? 0 : (parseFloat(targetAmount) || 0),
      createdAt: editGoal?.createdAt ?? new Date().toISOString(),
      milestones: milestones.length > 0 ? milestones : undefined,
    };

    if (targetDate) goal.targetDate = targetDate;

    if (type === 'fire') {
      goal.annualExpenses = parseFloat(annualExpenses) || 0;
      goal.multiplier = parseFloat(multiplier) || 25;
      goal.targetAmount = goal.annualExpenses * goal.multiplier;
      goal.expectedReturn = parseFloat(expectedReturn) || 7;
      goal.inflationRate = parseFloat(inflationRate) || 3;
      const growth = parseFloat(annualSavingsGrowth) || 0;
      if (growth > 0) goal.annualSavingsGrowth = growth;
    }

    await saveGoal(goal);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content glass-card" ref={modalRef} role="dialog" aria-modal="true" aria-label={editGoal ? 'Edit Goal' : 'Create New Goal'}>
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
                  type="number"
                  className="form-input"
                  value={annualExpenses}
                  onChange={e => setAnnualExpenses(e.target.value)}
                  placeholder="1200000"
                  required
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label htmlFor="goal-multiplier">Multiplier (Rule of 25)</label>
                <input
                  id="goal-multiplier"
                  type="number"
                  className="form-input"
                  value={multiplier}
                  onChange={e => setMultiplier(e.target.value)}
                  step="1"
                  required
                />
              </div>
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="goal-amount">Target Amount ({baseCurrency})</label>
              <input
                id="goal-amount"
                type="number"
                className="form-input"
                value={targetAmount}
                onChange={e => setTargetAmount(e.target.value)}
                placeholder="10000000"
                required
              />
            </div>
          )}

          {type === 'fire' && (
            <div className="form-row fire-advanced-row">
              <div className="form-group">
                <label htmlFor="goal-return">Expected Return (%/yr)</label>
                <input id="goal-return" type="number" className="form-input" value={expectedReturn} onChange={e => setExpectedReturn(e.target.value)} step="0.5" />
              </div>
              <div className="form-group">
                <label htmlFor="goal-inflation">Inflation (%/yr)</label>
                <input id="goal-inflation" type="number" className="form-input" value={inflationRate} onChange={e => setInflationRate(e.target.value)} step="0.5" />
              </div>
              <div className="form-group">
                <label htmlFor="goal-savings-growth">Savings Growth (%/yr)</label>
                <input id="goal-savings-growth" type="number" className="form-input" value={annualSavingsGrowth} onChange={e => setAnnualSavingsGrowth(e.target.value)} step="1" min="0" />
              </div>
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

          {/* Milestones */}
          <div className="form-group">
            <label>Milestones (Optional)</label>
            {milestones.length > 0 && (
              <div className="milestone-list">
                {milestones.map(m => (
                  <div key={m.id} className="milestone-list__item">
                    <span className="milestone-list__label">{m.label}</span>
                    <span className="milestone-list__amount">{baseCurrency} {m.targetAmount.toLocaleString()}</span>
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
                type="number"
                className="form-input"
                placeholder="Amount"
                value={newMilestoneAmount}
                onChange={e => setNewMilestoneAmount(e.target.value)}
                style={{ maxWidth: '120px' }}
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
      </div>
    </div>
  );
};
