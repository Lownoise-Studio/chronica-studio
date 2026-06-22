import { Fragment, Choice, ChronicaState } from './types';
import { resolveAction } from './action-resolver';
import { applyEffect } from './expression-evaluator';
import { getActiveFragment } from './fragment-store';

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

export function resolveTurn(
  choice: Choice,
  state: ChronicaState,
  fragments: Fragment[],
): Fragment | null {
  const working = cloneState(state);
  resolveAction(choice.action, working);
  const fragment = getActiveFragment(working.location, working, fragments);
  if (!fragment) return null;
  for (const effect of fragment.effects) {
    applyEffect(effect, working);
  }
  commitState(state, working);
  return fragment;
}
