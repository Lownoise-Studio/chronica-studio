import { Fragment, Choice, ChronicaState, SceneHotspot, AdventureInteractable } from './types';
import { CompiledGame } from './compiler/types';
import { ActionStep } from './actions/types';
import { resolveActionSteps } from './actions/resolve-action';
import { applyEffect, evaluateCondition } from './expression-evaluator';
import { getActiveFragmentFromIndex } from './compiler/fragment-index';
import { getVisibleHotspots } from './hotspots';

export { getVisibleHotspots } from './hotspots';

function cloneState(s: ChronicaState): ChronicaState {
  return {
    location: s.location,
    instability: s.instability,
    reality_layer: s.reality_layer,
    memory: { ...s.memory },
    variables: { ...s.variables },
    dialogueLineIndex: s.dialogueLineIndex ?? 0,
    playerX: s.playerX,
    playerY: s.playerY,
    lastLocationId: s.lastLocationId,
  };
}

function commitState(target: ChronicaState, source: ChronicaState): void {
  target.location = source.location;
  target.instability = source.instability;
  target.reality_layer = source.reality_layer;
  target.memory = { ...source.memory };
  target.variables = { ...source.variables };
  target.dialogueLineIndex = source.dialogueLineIndex ?? 0;
  target.playerX = source.playerX;
  target.playerY = source.playerY;
  target.lastLocationId = source.lastLocationId;
}

/**
 * Returns only the choices whose optional conditions all pass in the current state.
 * Choices with no conditions are always visible.
 */
export function getVisibleChoices(fragment: Fragment, state: ChronicaState): Choice[] {
  return fragment.choices.filter(
    choice =>
      !choice.conditions?.length ||
      choice.conditions.every(c => evaluateCondition(c, state))
  );
}

/**
 * Applies compiled action steps, resolves the next fragment, applies entry effects,
 * and commits the mutated state.
 */
export function applyCompiledInteraction(
  steps: readonly ActionStep[],
  state: ChronicaState,
  game: CompiledGame,
): Fragment | null {
  const working = cloneState(state);
  resolveActionSteps(steps, working);
  const fragment = getActiveFragmentFromIndex(working.location, working, game.fragmentIndex);
  if (!fragment) return null;
  for (const effect of fragment.effects) {
    applyEffect(effect, working);
  }
  commitState(state, working);
  return fragment;
}

/**
 * Applies a choice's compiled action steps, resolves the next fragment, applies
 * that fragment's effects, and commits the mutated state.
 */
export function resolveTurn(
  choice: Choice,
  state: ChronicaState,
  game: CompiledGame,
): Fragment | null {
  const steps = game.choiceActions[choice.uid];
  if (!steps) return null;
  return applyCompiledInteraction(steps, state, game);
}

/** Applies a hotspot's compiled action steps — same execution path as choices. */
export function resolveHotspotActivation(
  hotspot: SceneHotspot,
  state: ChronicaState,
  game: CompiledGame,
): Fragment | null {
  const steps = game.hotspotActions[hotspot.uid];
  if (!steps) return null;
  return applyCompiledInteraction(steps, state, game);
}

/** Applies an adventure interactable's compiled action steps — same execution path as choices. */
export function resolveInteractableActivation(
  interactable: AdventureInteractable,
  state: ChronicaState,
  game: CompiledGame,
): Fragment | null {
  const steps = game.interactableActions[interactable.uid];
  if (!steps) return null;
  return applyCompiledInteraction(steps, state, game);
}
