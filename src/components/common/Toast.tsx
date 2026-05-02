import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import './Toast.css';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

type ConfirmVariant = 'default' | 'destructive';

interface ConfirmState {
  message: string;
  variant: ConfirmVariant;
  resolve: (value: boolean) => void;
}

interface ToastContextValue {
  success: (msg: string) => void;
  error: (msg: string) => void;
  warning: (msg: string) => void;
  info: (msg: string) => void;
  confirm: (msg: string, variant?: ConfirmVariant) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={16} />,
  error:   <XCircle size={16} />,
  warning: <AlertTriangle size={16} />,
  info:    <Info size={16} />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, type, message }]);
    timers.current.set(id, setTimeout(() => dismiss(id), 4000));
  }, [dismiss]);

  const success = useCallback((msg: string) => addToast('success', msg), [addToast]);
  const error   = useCallback((msg: string) => addToast('error', msg),   [addToast]);
  const warning = useCallback((msg: string) => addToast('warning', msg), [addToast]);
  const info    = useCallback((msg: string) => addToast('info', msg),    [addToast]);

  const confirm = useCallback((message: string, variant: ConfirmVariant = 'default'): Promise<boolean> =>
    new Promise(resolve => setConfirmState({ message, variant, resolve })),
  []);

  const handleConfirm = (value: boolean) => {
    confirmState?.resolve(value);
    setConfirmState(null);
  };

  return (
    <ToastContext.Provider value={{ success, error, warning, info, confirm }}>
      {children}

      <div className="toast-container" role="log" aria-live="polite" aria-atomic="false">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast--${t.type}`} role="status">
            <span className="toast__icon">{ICONS[t.type]}</span>
            <span className="toast__message">{t.message}</span>
            <button className="toast__close" aria-label="Dismiss notification" onClick={() => dismiss(t.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {confirmState && (
        <div className="confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-msg">
          <div className="confirm-dialog glass-card">
            <p id="confirm-msg" className="confirm-dialog__message">{confirmState.message}</p>
            <div className="confirm-dialog__actions">
              <button className="btn btn-outline" onClick={() => handleConfirm(false)}>Cancel</button>
              <button
                className={`btn ${confirmState.variant === 'destructive' ? 'btn-destructive' : 'btn-primary'}`}
                onClick={() => handleConfirm(true)}
              >
                {confirmState.variant === 'destructive' ? 'Delete' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
