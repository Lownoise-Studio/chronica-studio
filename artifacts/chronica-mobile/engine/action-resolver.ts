import { ChronicaState } from './types';
import { applyEffect } from './expression-evaluator';

export function resolveAction(action: string, state: ChronicaState): void {
  const t = action.trim();
  if (!t) return;
  if (t.startsWith('goto:')) {
    state.location = t.slice('goto:'.length).trim();
    return;
  }
  if (t.includes('+=') || t.includes('=')) {
    applyEffect(t, state);
  }
}
