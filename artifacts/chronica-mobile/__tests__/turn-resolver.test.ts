import { resolveTurn, getVisibleChoices } from '../engine/turn-resolver';
import { startSession } from '../engine/chronica-session';
import { Fragment, Choice, ChronicaState } from '../engine/types';

function makeFragment(overrides: Partial<Fragment> & { uid: string; locationId: string }): Fragment {
  return {
    title: overrides.locationId,
    priority: 0,
    conditions: [],
    effects: [],
    text: '',
    choices: [],
    ...overrides,
  };
}

function makeChoice(overrides: Partial<Choice> & { uid: string }): Choice {
  return {
    label: 'Go',
    action: '',
    conditions: [],
    ...overrides,
  };
}

function makeState(overrides: Partial<ChronicaState> = {}): ChronicaState {
  return {
    location: 'start',
    instability: 0,
    reality_layer: 0,
    memory: {},
    variables: {},
    ...overrides,
  };
}

const forestFrag: Fragment = makeFragment({
  uid: 'f2',
  locationId: 'forest',
  text: 'You are in the forest.',
  effects: ['variables.visited_forest = true'],
});

const startFrag: Fragment = makeFragment({
  uid: 'f1',
  locationId: 'start',
  text: 'You are at the start.',
  choices: [
    makeChoice({ uid: 'c1', label: 'Go to forest', action: 'goto:forest' }),
    makeChoice({ uid: 'c2', label: 'Secret path', action: 'goto:forest', conditions: ['variables.secret == true'] }),
  ],
});

const fragments: Fragment[] = [startFrag, forestFrag];

describe('getVisibleChoices', () => {
  test('returns all choices with no conditions', () => {
    const state = makeState();
    const choices = getVisibleChoices(startFrag, state);
    // Only c1 passes since c2 requires variables.secret == true
    expect(choices.length).toBe(1);
    expect(choices[0].uid).toBe('c1');
  });

  test('returns conditional choice when condition passes', () => {
    const state = makeState({ variables: { secret: true } });
    const choices = getVisibleChoices(startFrag, state);
    expect(choices.length).toBe(2);
  });

  test('fragment with no choices returns empty', () => {
    const state = makeState();
    expect(getVisibleChoices(forestFrag, state)).toEqual([]);
  });
});

describe('resolveTurn', () => {
  test('goto: navigates to target fragment', () => {
    const state = makeState({ location: 'start' });
    const choice = makeChoice({ uid: 'c1', action: 'goto:forest' });
    const frag = resolveTurn(choice, state, fragments);
    expect(frag?.locationId).toBe('forest');
    expect(state.location).toBe('forest');
  });

  test('target fragment effects are applied', () => {
    const state = makeState({ location: 'start' });
    const choice = makeChoice({ uid: 'c1', action: 'goto:forest' });
    resolveTurn(choice, state, fragments);
    expect(state.variables.visited_forest).toBe(true);
  });

  test('returns null for unknown location', () => {
    const state = makeState({ location: 'start' });
    const choice = makeChoice({ uid: 'c1', action: 'goto:void' });
    const frag = resolveTurn(choice, state, fragments);
    expect(frag).toBeNull();
  });

  test('multi-step action (semicolons) executes all steps', () => {
    const state = makeState({ location: 'start' });
    const choice = makeChoice({ uid: 'c1', action: 'variables.trust += 1; goto:forest' });
    resolveTurn(choice, state, fragments);
    expect(state.location).toBe('forest');
    expect(state.variables.trust).toBe(1);
  });
});

describe('startSession', () => {
  test('returns starting fragment and visible choices', () => {
    const result = startSession('start', fragments, {}, {});
    expect(result.fragment?.locationId).toBe('start');
    expect(result.visibleChoices.length).toBe(1);
  });

  test('returns null fragment when no match', () => {
    const result = startSession('nonexistent', fragments, {}, {});
    expect(result.fragment).toBeNull();
    expect(result.visibleChoices).toEqual([]);
  });

  test('initial variables are available in visible choices filter', () => {
    const result = startSession('start', fragments, { secret: true }, {});
    expect(result.visibleChoices.length).toBe(2);
  });
});
