import {
  parseActionString,
  getGotoTargetsFromAction,
  getGotoTarget,
} from '../engine/actions/parse-action';

describe('parseActionString', () => {
  test('empty action yields no steps', () => {
    expect(parseActionString('')).toEqual({ ok: true, steps: [] });
    expect(parseActionString('   ')).toEqual({ ok: true, steps: [] });
  });

  test('goto:', () => {
    expect(parseActionString('goto:forest')).toEqual({
      ok: true,
      steps: [{ kind: 'goto', locationId: 'forest' }],
    });
  });

  test('set: and clear:', () => {
    expect(parseActionString('set:found_key')).toEqual({
      ok: true,
      steps: [{ kind: 'set', flag: 'found_key' }],
    });
    expect(parseActionString('clear:found_key')).toEqual({
      ok: true,
      steps: [{ kind: 'clear', flag: 'found_key' }],
    });
  });

  test('assignment and increment', () => {
    expect(parseActionString('variables.trust = 5')).toEqual({
      ok: true,
      steps: [{ kind: 'assign', path: 'variables.trust', rawValue: '5' }],
    });
    expect(parseActionString('variables.trust += 1')).toEqual({
      ok: true,
      steps: [{ kind: 'increment', path: 'variables.trust', amount: 1 }],
    });
    expect(parseActionString('instability += -2')).toEqual({
      ok: true,
      steps: [{ kind: 'increment', path: 'instability', amount: -2 }],
    });
    expect(parseActionString('variables.trust -= 1')).toEqual({
      ok: true,
      steps: [{ kind: 'decrement', path: 'variables.trust', amount: 1 }],
    });
    expect(parseActionString('variables.trust -= 2; goto:forest')).toEqual({
      ok: true,
      steps: [
        { kind: 'decrement', path: 'variables.trust', amount: 2 },
        { kind: 'goto', locationId: 'forest' },
      ],
    });
  });

  test('multi-step semicolon chain', () => {
    expect(parseActionString('variables.trust += 1; goto:forest')).toEqual({
      ok: true,
      steps: [
        { kind: 'increment', path: 'variables.trust', amount: 1 },
        { kind: 'goto', locationId: 'forest' },
      ],
    });
  });

  test('rejects unknown prefix', () => {
    const result = parseActionString('jump:forest');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Unrecognized');
  });

  test('rejects empty goto target', () => {
    const result = parseActionString('goto:');
    expect(result.ok).toBe(false);
  });

  test('rejects malformed assignment', () => {
    const result = parseActionString('variables.foo =');
    expect(result.ok).toBe(false);
  });
});

describe('getGotoTargetsFromAction', () => {
  test('extracts single and multiple gotos', () => {
    expect(getGotoTargetsFromAction('goto:intro')).toEqual(['intro']);
    expect(getGotoTargetsFromAction('set:a; goto:forest')).toEqual(['forest']);
  });

  test('returns empty for invalid action', () => {
    expect(getGotoTargetsFromAction('not-valid!!!')).toEqual([]);
  });
});

describe('getGotoTarget', () => {
  test('returns first goto only', () => {
    expect(getGotoTarget('variables.x = 1; goto:a; goto:b')).toBe('a');
    expect(getGotoTarget('set:flag')).toBeNull();
  });
});
