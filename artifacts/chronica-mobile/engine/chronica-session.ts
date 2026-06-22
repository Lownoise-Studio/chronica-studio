import { Fragment, Choice, ChronicaState } from './types';
import { getActiveFragment } from './fragment-store';
import { applyEffect } from './expression-evaluator';
import { resolveTurn } from './turn-resolver';

export function createInitialState(startLocation: string): ChronicaState {
  return { location: startLocation, instability: 0, reality_layer: 0, memory: {}, variables: {} };
}

export function startSession(
  startLocation: string,
  fragments: Fragment[],
): { state: ChronicaState; fragment: Fragment | null } {
  const state = createInitialState(startLocation);
  const fragment = getActiveFragment(startLocation, state, fragments);
  if (fragment) {
    for (const effect of fragment.effects) applyEffect(effect, state);
  }
  return { state, fragment };
}

export function choose(
  choice: Choice,
  state: ChronicaState,
  fragments: Fragment[],
): Fragment | null {
  return resolveTurn(choice, state, fragments);
}

export function serializeState(state: ChronicaState): string {
  return JSON.stringify({
    location: state.location,
    instability: state.instability,
    reality_layer: state.reality_layer,
    memory: state.memory,
    variables: state.variables,
  });
}

export function deserializeState(data: Record<string, unknown>): ChronicaState | null {
  try {
    return {
      location: (data.location as string) ?? '',
      instability: (data.instability as number) ?? 0,
      reality_layer: (data.reality_layer as number) ?? 0,
      memory: (data.memory as Record<string, string | number | boolean>) ?? {},
      variables: (data.variables as Record<string, string | number | boolean>) ?? {},
    };
  } catch {
    return null;
  }
}
