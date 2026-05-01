import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Goal, GoalType } from '../../types';
import { X } from 'lucide-react';
import './GoalEditor.css';

interface GoalEditorProps {
  onClose: () => void;
}

export const GoalEditor: React.FC<GoalEditorProps> = ({ onClose }) => {
  const { saveGoal, preferences } = useApp();
  const baseCurrency = preferences?.baseCurrency || 'INR';

  const [type, setType] = useState<GoalType>('fire');
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState<string>('');
  const [targetDate, setTargetDate] = useState('');
  
  // FIRE specific
  const [annualExpenses, setAnnualExpenses] = useState<string>('');
  const [multiplier, setMultiplier] = useState<string>('25');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const goal: Goal = {
      id: crypto.randomUUID(),
      name: name || (type === 'fire' ? 'FIRE Target' : 'New Goal'),
      type,
      targetAmount: type === 'fire' ? 0 : (parseFloat(targetAmount) || 0),
      createdAt: new Date().toISOString(),
      milestones: []
    };

    if (targetDate) goal.targetDate = targetDate;

    if (type === 'fire') {
      goal.annualExpenses = parseFloat(annualExpenses) || 0;
      goal.multiplier = parseFloat(multiplier) || 25;
      // Calculate derived target amount just for reference
      goal.targetAmount = goal.annualExpenses * goal.multiplier;
    }

    await saveGoal(goal);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card">
        <div className="modal-header">
          <h2 className="text-h2">Create New Goal</h2>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="goal-form">
          <div className="form-group">
            <label>Goal Type</label>
            <select value={type} onChange={e => setType(e.target.value as GoalType)} className="form-input">
              <option value="fire">FIRE (Financial Independence)</option>
              <option value="net_worth_target">Net Worth Target</option>
              <option value="savings">Savings Goal</option>
              <option value="debt_freedom">Debt Payoff</option>
              <option value="custom">Custom Milestone</option>
            </select>
          </div>

          <div className="form-group">
            <label>Goal Name</label>
            <input 
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
                <label>Estimated Annual Expenses ({baseCurrency})</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={annualExpenses} 
                  onChange={e => setAnnualExpenses(e.target.value)} 
                  placeholder="1200000"
                  required
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Multiplier (Rule of 25)</label>
                <input 
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
              <label>Target Amount ({baseCurrency})</label>
              <input 
                type="number" 
                className="form-input" 
                value={targetAmount} 
                onChange={e => setTargetAmount(e.target.value)} 
                placeholder="10000000"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label>Target Date (Optional)</label>
            <input 
              type="date" 
              className="form-input" 
              value={targetDate} 
              onChange={e => setTargetDate(e.target.value)} 
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Goal</button>
          </div>
        </form>
      </div>
    </div>
  );
};
