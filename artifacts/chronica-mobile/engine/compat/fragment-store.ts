import type { CompiledGame } from '../compiler/types';
import { getActiveFragmentFromIndex } from '../compiler/fragment-index';
import type { ChronicaState, Fragment } from '../types';

/**
 * Mirrors the Godot engine's FragmentStore: resolves the active fragment for a
 * location given the current state. Backed by the compiled fragment index so
 * lookups stay O(1) per candidate fragment.
 */
export class FragmentStore {
  constructor(private readonly game: CompiledGame) {}

  /** Resolve the active fragment for a location, or null when nothing matches. */
  active(locationId: string, state: ChronicaState): Fragment | null {
    return getActiveFragmentFromIndex(locationId, state, this.game.fragmentIndex);
  }

  /** All fragments authored for a given location (unfiltered by conditions). */
  candidates(locationId: string): readonly Fragment[] {
    return this.game.fragmentIndex.byLocation[locationId] ?? [];
  }

  /** True when at least one fragment is authored for the location. */
  has(locationId: string): boolean {
    return (this.game.fragmentIndex.byLocation[locationId]?.length ?? 0) > 0;
  }
}
