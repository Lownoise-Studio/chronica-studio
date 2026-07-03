import {
  isModuleSaveEntryShape,
  isValidModuleSavePayloads,
  moduleSaveDataFromCompat,
  normalizeModuleSavePayloads,
} from '../engine/compat/module-save';

describe('module save normalization', () => {
  test('normalizes canonical ModuleSaveEntry array', () => {
    const map = normalizeModuleSavePayloads([
      { id: 'a', config: { tier: 1 }, data: { score: 5 } },
      { id: 'b', data: { ok: true } },
    ]);
    expect(map.get('a')).toEqual({ config: { tier: 1 }, data: { score: 5 } });
    expect(map.get('b')).toEqual({ data: { ok: true } });
  });

  test('normalizes legacy record with bare data values', () => {
    const map = normalizeModuleSavePayloads({
      achievements: { unlocked: ['x'] },
    });
    expect(map.get('achievements')).toEqual({ data: { unlocked: ['x'] } });
  });

  test('normalizes legacy record with config/data objects', () => {
    const map = normalizeModuleSavePayloads({
      mod: { config: { tier: 2 }, data: { score: 9 } },
    });
    expect(map.get('mod')).toEqual({ config: { tier: 2 }, data: { score: 9 } });
  });

  test('moduleSaveDataFromCompat reads from array saves', () => {
    const data = moduleSaveDataFromCompat(
      [{ id: 'm', data: { value: 42 } }],
      'm',
    );
    expect(data).toEqual({ value: 42 });
  });

  test('isValidModuleSavePayloads accepts array, record, and undefined', () => {
    expect(isValidModuleSavePayloads(undefined)).toBe(true);
    expect(isValidModuleSavePayloads({ a: { x: 1 } })).toBe(true);
    expect(isValidModuleSavePayloads([{ id: 'a', data: {} }])).toBe(true);
    expect(isValidModuleSavePayloads('bad')).toBe(false);
    expect(isValidModuleSavePayloads([{ data: {} }])).toBe(false);
  });

  test('isModuleSaveEntryShape requires id and data', () => {
    expect(isModuleSaveEntryShape({ id: 'a', data: {} })).toBe(true);
    expect(isModuleSaveEntryShape({ id: 'a' })).toBe(false);
  });
});
