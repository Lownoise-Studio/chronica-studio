import { Choice, ChronicaState, Fragment, SceneHotspot, VariableValue } from './types';
import { CompiledGame } from './compiler/types';
import { getActiveFragmentFromIndex } from './compiler/fragment-index';
import { applyEffect } from './expression-evaluator';
import { resolveTurn, resolveHotspotActivation, getVisibleChoices, getVisibleHotspots } from './turn-resolver';

export function createInitialState(
  startLocation: string,
  initialVariables: Record<string, VariableValue> = {},
  initialMemory: Record<string, VariableValue> = {},
): ChronicaState {
  const variables = { ...initialVariables };
  return {
    location: startLocation,
    instability: typeof variables.instability === 'number' ? variables.instability : 0,
    reality_layer: typeof variables.reality_layer === 'number' ? variables.reality_layer : 0,
    memory: { ...initialMemory },
    variables,
    dialogueLineIndex: 0,
  };
}

export function startSession(
  game: CompiledGame,
): { state: ChronicaState; fragment: Fragment | null; visibleChoices: Choice[]; visibleHotspots: SceneHotspot[] } {
  const state = createInitialState(
    game.startLocation,
    game.initialVariables,
    game.initialMemory,
  );
  const fragment = getActiveFragmentFromIndex(game.startLocation, state, game.fragmentIndex);
  if (fragment) {
    for (const effect of fragment.effects) applyEffect(effect, state);
  }
  const visibleChoices = fragment ? getVisibleChoices(fragment, state) : [];
  const visibleHotspots = fragment ? getVisibleHotspots(fragment, state) : [];
  return { state, fragment, visibleChoices, visibleHotspots };
}

export function choose(
  choice: Choice,
  state: ChronicaState,
  game: CompiledGame,
): { fragment: Fragment | null; visibleChoices: Choice[]; visibleHotspots: SceneHotspot[] } {
  const fragment = resolveTurn(choice, state, game);
  const visibleChoices = fragment ? getVisibleChoices(fragment, state) : [];
  const visibleHotspots = fragment ? getVisibleHotspots(fragment, state) : [];
  return { fragment, visibleChoices, visibleHotspots };
}

export function activateHotspot(
  hotspot: SceneHotspot,
  state: ChronicaState,
  game: CompiledGame,
): { fragment: Fragment | null; visibleChoices: Choice[]; visibleHotspots: SceneHotspot[] } {
  const fragment = resolveHotspotActivation(hotspot, state, game);
  const visibleChoices = fragment ? getVisibleChoices(fragment, state) : [];
  const visibleHotspots = fragment ? getVisibleHotspots(fragment, state) : [];
  return { fragment, visibleChoices, visibleHotspots };
}

export function serializeState(state: ChronicaState): string {
  return JSON.stringify({
    location: state.location,
    instability: state.instability,
    reality_layer: state.reality_layer,
    memory: state.memory,
    variables: state.variables,
    dialogueLineIndex: state.dialogueLineIndex ?? 0,
  });
}

export function deserializeState(data: Record<string, unknown>): ChronicaState | null {
  try {
    return {
      location: (data.location as string) ?? '',
      instability: (data.instability as number) ?? 0,
      reality_layer: (data.reality_layer as number) ?? 0,
      memory: (data.memory as Record<string, VariableValue>) ?? {},
      variables: (data.variables as Record<string, VariableValue>) ?? {},
      dialogueLineIndex: typeof data.dialogueLineIndex === 'number' ? data.dialogueLineIndex : 0,
    };
  } catch {
    return null;
  }
}
