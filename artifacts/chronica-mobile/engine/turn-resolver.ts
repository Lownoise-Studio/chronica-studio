import { Fragment, Choice, ChronicaState } from './types';
import { resolveAction } from './action-resolver';
import { applyEffect, evaluateCondition } from './expression-evaluator';
import { FragmentIndex, getActiveFragmentFromIndex } from './compiler/fragment-index';

function cloneState(s: ChronicaState): ChronicaState {
  return {
    location: s.location,
    instability: s.instability,
    reality_layer: s.reality_layer,
    memory: { ...s.memory },
    variables: { ...s.variables },
  };
}

function commitState(target: ChronicaState, source: ChronicaState): void {
  target.location = source.location;
  target.instability = source.instability;
  target.reality_layer = source.reality_layer;
  target.memory = { ...source.memory };
  target.variables = { ...source.variables };
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
 * Applies a choice's action, resolves the next fragment, applies that fragment's
 * effects, and commits the mutated state. Returns the next fragment or null.
 */
export function resolveTurn(
  choice: Choice,
  state: ChronicaState,
  fragmentIndex: FragmentIndex,
): Fragment | null {
  const working = cloneState(state);
  resolveAction(choice.action, working);
  const fragment = getActiveFragmentFromIndex(working.location, working, fragmentIndex);
  if (!fragment) return null;
  for (const effect of fragment.effects) {
    applyEffect(effect, working);
  }
  commitState(state, working);
  return fragment;
}
