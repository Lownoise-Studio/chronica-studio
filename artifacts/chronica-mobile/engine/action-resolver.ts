import { ChronicaState } from './types';
import { applyEffect } from './expression-evaluator';

/**
 * Resolves a choice action string against the current state.
 *
 * Supported action formats (can be separated by semicolons for multi-step):
 *   goto:<locationId>          — navigate to a location
 *   set:<flag>                 — set memory.<flag> = true
 *   clear:<flag>               — set memory.<flag> = false
 *   <lvalue> = <rvalue>        — assign a variable/memory/instability/reality_layer
 *   <lvalue> += <number>       — increment a numeric variable
 */
export function resolveAction(action: string, state: ChronicaState): void {
  const steps = action.split(';').map(s => s.trim()).filter(Boolean);
  for (const step of steps) {
    resolveSingleAction(step, state);
  }
}

function resolveSingleAction(action: string, state: ChronicaState): void {
  const t = action.trim();
  if (!t) return;

  if (t.startsWith('goto:')) {
    state.location = t.slice('goto:'.length).trim();
    return;
  }

  if (t.startsWith('set:')) {
    const flag = t.slice('set:'.length).trim();
    state.memory[flag] = true;
    return;
  }

  if (t.startsWith('clear:')) {
    const flag = t.slice('clear:'.length).trim();
    state.memory[flag] = false;
    return;
  }

  applyEffect(t, state);
}
