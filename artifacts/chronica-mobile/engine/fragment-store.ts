import { Fragment, ChronicaState } from './types';
import { evaluateCondition } from './expression-evaluator';

export function getActiveFragment(
  locationId: string,
  state: ChronicaState,
  fragments: Fragment[],
): Fragment | null {
  const matches = fragments.filter(
    f => f.locationId === locationId && f.conditions.every(c => evaluateCondition(c, state)),
  );
  if (!matches.length) return null;
  matches.sort((a, b) => b.priority - a.priority);
  return matches[0];
}
