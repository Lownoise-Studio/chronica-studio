import { resolveTurn, getVisibleChoices } from '../engine/turn-resolver';
import { startSession } from '../engine/chronica-session';
import { buildCompiledGame } from '../engine/compiler';
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

function makeGame(overrides: Partial<Parameters<typeof buildCompiledGame>[0]> = {}) {
  return buildCompiledGame({
    schemaVersion: 1,
    id: 'p1',
    title: 'Test',
    description: '',
    startLocation: 'start',
    initialVariables: {},
    initialMemory: {},
    createdAt: '',
    updatedAt: '',
    assets: [],
    fragments,
    ...overrides,
  });
}

describe('getVisibleChoices', () => {
  test('returns all choices with no conditions', () => {
    const state = makeState();
    const choices = getVisibleChoices(startFrag, state);
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
  const game = makeGame();

  test('goto: navigates to target fragment', () => {
    const state = makeState({ location: 'start' });
    const choice = makeChoice({ uid: 'c1', action: 'goto:forest' });
    const frag = resolveTurn(choice, state, game);
    expect(frag?.locationId).toBe('forest');
    expect(state.location).toBe('forest');
  });

  test('target fragment effects are applied', () => {
    const state = makeState({ location: 'start' });
    const choice = makeChoice({ uid: 'c1', action: 'goto:forest' });
    resolveTurn(choice, state, game);
    expect(state.variables.visited_forest).toBe(true);
  });

  test('returns null for unknown location', () => {
    const badGame = makeGame({
      fragments: [
        {
          ...startFrag,
          choices: [makeChoice({ uid: 'c-void', label: 'Void', action: 'goto:void' })],
        },
        forestFrag,
      ],
    });
    const state = makeState({ location: 'start' });
    const frag = resolveTurn(badGame.fragments[0].choices[0], state, badGame);
    expect(frag).toBeNull();
  });

  test('returns null when choice uid missing from compiled actions', () => {
    const state = makeState({ location: 'start' });
    const choice = makeChoice({ uid: 'missing-uid', action: 'goto:forest' });
    const frag = resolveTurn(choice, state, game);
    expect(frag).toBeNull();
  });

  test('multi-step action (semicolons) executes all steps', () => {
    const multiGame = makeGame({
      fragments: [
        {
          ...startFrag,
          choices: [
            makeChoice({ uid: 'c1', label: 'Go', action: 'variables.trust += 1; goto:forest' }),
          ],
        },
        forestFrag,
      ],
    });
    const state = makeState({ location: 'start' });
    const choice = multiGame.fragments[0].choices[0];
    resolveTurn(choice, state, multiGame);
    expect(state.location).toBe('forest');
    expect(state.variables.trust).toBe(1);
  });
});

describe('startSession', () => {
  test('returns starting fragment and visible choices', () => {
    const result = startSession(makeGame());
    expect(result.fragment?.locationId).toBe('start');
    expect(result.visibleChoices.length).toBe(1);
  });

  test('returns null fragment when start location has no fragments', () => {
    const game = {
      ...makeGame(),
      startLocation: 'nonexistent',
    };
    const result = startSession(game);
    expect(result.fragment).toBeNull();
    expect(result.visibleChoices).toEqual([]);
  });

  test('initial variables are available in visible choices filter', () => {
    const result = startSession(makeGame({ initialVariables: { secret: true } }));
    expect(result.visibleChoices.length).toBe(2);
  });
});
