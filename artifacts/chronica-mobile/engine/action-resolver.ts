import { ChronicaState } from './types';
import { parseActionString } from './actions/parse-action';
import { resolveActionSteps } from './actions/resolve-action';

/**
 * @deprecated Use resolveActionSteps with compiled choiceActions from CompiledGame.
 * Parses and executes a raw action string (legacy/tests only).
 */
export function resolveAction(action: string, state: ChronicaState): void {
  const parsed = parseActionString(action);
  if (!parsed.ok) return;
  resolveActionSteps(parsed.steps, state);
}
