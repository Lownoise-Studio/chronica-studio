import { evaluateCondition, applyEffect, isValidCondition, isValidEffect } from '../engine/expression-evaluator';
import { ChronicaState } from '../engine/types';

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

describe('evaluateCondition', () => {
  test('empty string returns true', () => {
    expect(evaluateCondition('', makeState())).toBe(true);
  });

  test('numeric comparison >=', () => {
    const s = makeState({ instability: 5 });
    expect(evaluateCondition('instability >= 5', s)).toBe(true);
    expect(evaluateCondition('instability >= 6', s)).toBe(false);
  });

  test('numeric comparison <', () => {
    const s = makeState({ instability: 2 });
    expect(evaluateCondition('instability < 3', s)).toBe(true);
    expect(evaluateCondition('instability < 2', s)).toBe(false);
  });

  test('equality == for variables', () => {
    const s = makeState({ variables: { mood: 'somber' } });
    expect(evaluateCondition('variables.mood == "somber"', s)).toBe(true);
    expect(evaluateCondition('variables.mood == "happy"', s)).toBe(false);
  });

  test('inequality != for variables', () => {
    const s = makeState({ variables: { trust: 0 } });
    expect(evaluateCondition('variables.trust != 1', s)).toBe(true);
    expect(evaluateCondition('variables.trust != 0', s)).toBe(false);
  });

  test('memory boolean flag', () => {
    const s = makeState({ memory: { met_guard: true } });
    expect(evaluateCondition('memory.met_guard == true', s)).toBe(true);
    expect(evaluateCondition('memory.met_guard == false', s)).toBe(false);
  });

  test('missing variable defaults to 0', () => {
    const s = makeState();
    expect(evaluateCondition('variables.nonexistent == 0', s)).toBe(true);
  });

  test('invalid expression returns false', () => {
    expect(evaluateCondition('this is not valid', makeState())).toBe(false);
  });
});

describe('applyEffect', () => {
  test('increment instability', () => {
    const s = makeState({ instability: 2 });
    applyEffect('instability += 3', s);
    expect(s.instability).toBe(5);
  });

  test('decrement via negative increment', () => {
    const s = makeState({ instability: 5 });
    applyEffect('instability += -2', s);
    expect(s.instability).toBe(3);
  });

  test('assign variable', () => {
    const s = makeState();
    applyEffect('variables.mood = "somber"', s);
    expect(s.variables.mood).toBe('somber');
  });

  test('assign boolean variable', () => {
    const s = makeState();
    applyEffect('variables.ready = true', s);
    expect(s.variables.ready).toBe(true);
  });

  test('increment custom variable', () => {
    const s = makeState({ variables: { trust: 1 } });
    applyEffect('variables.trust += 2', s);
    expect(s.variables.trust).toBe(3);
  });

  test('decrement custom variable', () => {
    const s = makeState({ variables: { trust: 5 } });
    applyEffect('variables.trust -= 2', s);
    expect(s.variables.trust).toBe(3);
  });

  test('set memory flag', () => {
    const s = makeState();
    applyEffect('memory.visited = true', s);
    expect(s.memory.visited).toBe(true);
  });

  test('assign location', () => {
    const s = makeState({ location: 'start' });
    applyEffect('location = "forest"', s);
    expect(s.location).toBe('forest');
  });

  test('empty effect is no-op', () => {
    const s = makeState({ instability: 1 });
    applyEffect('', s);
    expect(s.instability).toBe(1);
  });
});

describe('isValidCondition', () => {
  test('accepts empty string', () => {
    expect(isValidCondition('')).toBe(true);
  });

  test('accepts valid comparisons', () => {
    expect(isValidCondition('instability >= 3')).toBe(true);
    expect(isValidCondition('variables.trust == 0')).toBe(true);
    expect(isValidCondition('memory.met_guard != false')).toBe(true);
  });

  test('rejects invalid expressions', () => {
    expect(isValidCondition('goto:start')).toBe(false);
    expect(isValidCondition('bad stuff here')).toBe(false);
  });
});

describe('isValidEffect', () => {
  test('accepts increment', () => {
    expect(isValidEffect('instability += 1')).toBe(true);
    expect(isValidEffect('variables.trust += -1')).toBe(true);
  });

  test('accepts decrement', () => {
    expect(isValidEffect('variables.trust -= 1')).toBe(true);
    expect(isValidEffect('instability -= 2')).toBe(true);
  });

  test('accepts assignment', () => {
    expect(isValidEffect('variables.mood = "somber"')).toBe(true);
    expect(isValidEffect('location = "forest"')).toBe(true);
  });

  test('accepts empty string', () => {
    expect(isValidEffect('')).toBe(true);
  });

  test('rejects invalid', () => {
    expect(isValidEffect('goto:start')).toBe(false);
    expect(isValidEffect('this is wrong')).toBe(false);
  });
});
