import type { CompiledGame } from '../compiler/types';
import type { Choice, ChronicaState, Fragment, SceneHotspot } from '../types';
import {
  getVisibleChoices,
  getVisibleHotspots,
  resolveHotspotActivation,
  resolveTurn,
} from '../turn-resolver';

/**
 * Class facade mirroring the Godot engine's TurnResolver. All rule execution
 * still lives in the engine's pure functions — this class only owns the
 * game reference so callers don't have to thread it through every call.
 */
export class TurnResolver {
  constructor(private readonly game: CompiledGame) {}

  visibleChoices(fragment: Fragment, state: ChronicaState): Choice[] {
    return getVisibleChoices(fragment, state);
  }

  visibleHotspots(fragment: Fragment, state: ChronicaState): SceneHotspot[] {
    return getVisibleHotspots(fragment, state);
  }

  applyChoice(choice: Choice, state: ChronicaState): Fragment | null {
    return resolveTurn(choice, state, this.game);
  }

  applyHotspot(hotspot: SceneHotspot, state: ChronicaState): Fragment | null {
    return resolveHotspotActivation(hotspot, state, this.game);
  }
}
