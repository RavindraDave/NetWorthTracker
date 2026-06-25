import { useApp } from '../context/AppContext';
import { useToast } from '../components/common/Toast';

/**
 * Combines the most common page-level boilerplate: app context, toast methods,
 * and the baseCurrency derivation that every page repeats identically.
 */
export function useAppBase() {
  const ctx = useApp();
  const toast = useToast();
  const baseCurrency = ctx.preferences?.baseCurrency ?? 'INR';
  return { ...ctx, ...toast, baseCurrency };
}
