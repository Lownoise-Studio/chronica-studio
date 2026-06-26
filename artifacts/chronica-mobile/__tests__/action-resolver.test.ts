import { resolveActionSteps } from '../engine/actions/resolve-action';
import { ChronicaState } from '../engine/types';
import { ActionStep } from '../engine/actions/types';

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

describe('resolveActionSteps', () => {
  test('goto updates location', () => {
    const state = makeState();
    resolveActionSteps([{ kind: 'goto', locationId: 'forest' }], state);
    expect(state.location).toBe('forest');
  });

  test('set and clear memory flags', () => {
    const state = makeState();
    resolveActionSteps([{ kind: 'set', flag: 'key_found' }], state);
    expect(state.memory.key_found).toBe(true);
    resolveActionSteps([{ kind: 'clear', flag: 'key_found' }], state);
    expect(state.memory.key_found).toBe(false);
  });

  test('assign and increment variables', () => {
    const state = makeState();
    const steps: ActionStep[] = [
      { kind: 'assign', path: 'variables.trust', rawValue: '3' },
      { kind: 'increment', path: 'variables.trust', amount: 2 },
    ];
    resolveActionSteps(steps, state);
    expect(state.variables.trust).toBe(5);
  });

  test('multi-step chain applies in order', () => {
    const state = makeState();
    resolveActionSteps(
      [
        { kind: 'increment', path: 'variables.trust', amount: 1 },
        { kind: 'goto', locationId: 'forest' },
      ],
      state,
    );
    expect(state.variables.trust).toBe(1);
    expect(state.location).toBe('forest');
  });

  test('instability increment syncs top-level field', () => {
    const state = makeState();
    resolveActionSteps([{ kind: 'increment', path: 'instability', amount: 3 }], state);
    expect(state.instability).toBe(3);
    expect(state.variables.instability).toBe(3);
  });
});
