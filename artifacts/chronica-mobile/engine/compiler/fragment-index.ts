import { Fragment, ChronicaState } from '../types';
import { evaluateCondition } from '../expression-evaluator';

/**
 * Pre-sorted lookup table: locationId → candidate fragments (priority desc).
 * Built once at compile time; used on every turn instead of scanning all fragments.
 */
export interface FragmentIndex {
  readonly byLocation: Readonly<Record<string, readonly Fragment[]>>;
}

export function buildFragmentIndex(fragments: readonly Fragment[]): FragmentIndex {
  const buckets: Record<string, Fragment[]> = {};

  for (const fragment of fragments) {
    if (!buckets[fragment.locationId]) {
      buckets[fragment.locationId] = [];
    }
    buckets[fragment.locationId].push(fragment);
  }

  const byLocation: Record<string, readonly Fragment[]> = {};
  for (const locationId of Object.keys(buckets)) {
    byLocation[locationId] = [...buckets[locationId]].sort((a, b) => b.priority - a.priority);
  }

  return { byLocation };
}

export function getActiveFragmentFromIndex(
  locationId: string,
  state: ChronicaState,
  index: FragmentIndex,
): Fragment | null {
  const candidates = index.byLocation[locationId];
  if (!candidates?.length) return null;

  for (const fragment of candidates) {
    if (fragment.conditions.every(c => evaluateCondition(c, state))) {
      return fragment;
    }
  }

  return null;
}
