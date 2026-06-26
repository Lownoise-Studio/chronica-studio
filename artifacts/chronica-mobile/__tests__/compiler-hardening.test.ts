import { compileProject } from '../engine/compiler';
import { computeProjectContentHash } from '../engine/compiler/build-compiled-game';
import { analyzeProjectWarnings } from '../engine/analyze-warnings';
import { applyEffect, evaluateCondition } from '../engine/expression-evaluator';
import { serializeState, deserializeState } from '../engine/chronica-session';
import { Project, Fragment, ChronicaState } from '../engine/types';

function makeState(overrides: Partial<ChronicaState> = {}): ChronicaState {
  return {
    location: 'intro',
    instability: 0,
    reality_layer: 0,
    memory: {},
    variables: {},
    dialogueLineIndex: 0,
    ...overrides,
  };
}

function makeProject(fragments: Fragment[], overrides: Partial<Project> = {}): Project {
  return {
    schemaVersion: 2,
    gameId: 'a0000001-0000-4000-8000-000000000099',
    id: 'install-1',
    title: 'Test',
    description: '',
    startLocation: 'intro',
    initialVariables: {},
    initialMemory: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    assets: [],
    characters: [],
    fragments,
    ...overrides,
  };
}

function frag(partial: Partial<Fragment> & { uid: string; locationId: string }): Fragment {
  return {
    title: partial.locationId,
    priority: 0,
    conditions: [],
    effects: [],
    text: '',
    choices: [],
    ...partial,
  };
}

describe('evaluator numeric safety', () => {
  test('increment on a non-numeric variable coerces to 0 instead of string-concatenating', () => {
    const s = makeState({ variables: { gold: 'abc' } });
    applyEffect('variables.gold += 1', s);
    expect(s.variables.gold).toBe(1); // not "abc1"
    expect(typeof s.variables.gold).toBe('number');
  });

  test('increment on an unset variable starts from 0', () => {
    const s = makeState();
    applyEffect('variables.score += 5', s);
    expect(s.variables.score).toBe(5);
  });

  test('assigning a non-finite literal does not poison state (stays serializable)', () => {
    const s = makeState();
    applyEffect('variables.huge = 1e400', s);
    // 1e400 -> Infinity must never enter state, because JSON turns it into null on save.
    expect(s.variables.huge).not.toBe(Infinity);
    const roundTrip = deserializeState(JSON.parse(serializeState(s)));
    expect(roundTrip?.variables.huge).toBe(s.variables.huge);
  });

  test('save/resume round-trip preserves numeric values exactly (no silent null)', () => {
    const s = makeState({ variables: { trust: 7, ratio: 3 }, memory: { flag: true } });
    applyEffect('variables.trust += 3', s);
    const roundTrip = deserializeState(JSON.parse(serializeState(s)));
    expect(roundTrip?.variables.trust).toBe(10);
    expect(roundTrip?.variables.ratio).toBe(3);
    expect(roundTrip?.memory.flag).toBe(true);
  });

  test('ordering comparison against a string coerces deterministically rather than relying on JS', () => {
    const s = makeState({ location: 'forest' });
    expect(evaluateCondition('location > 5', s)).toBe(false);
    expect(evaluateCondition('reality_layer >= 0', s)).toBe(true);
  });
});

describe('semantic warnings (non-blocking)', () => {
  test('compile still succeeds even when warnings are present', () => {
    const project = makeProject([
      frag({ uid: 'f1', locationId: 'intro', conditions: ['variabels.gold >= 1'] }),
    ]);
    const result = compileProject(project);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings.length).toBeGreaterThan(0);
  });

  test('flags a condition reading a variable that nothing writes (typo)', () => {
    const project = makeProject([
      frag({
        uid: 'f1',
        locationId: 'intro',
        choices: [{ uid: 'c1', label: 'Go', action: 'variables.gold += 1; goto:intro', conditions: ['variables.glod >= 1'] }],
      }),
    ]);
    const warnings = analyzeProjectWarnings(project);
    expect(warnings.some(w => w.type === 'unknown-path' && w.message.includes('variables.glod'))).toBe(true);
  });

  test('does not flag a variable that is written before being read', () => {
    const project = makeProject([
      frag({
        uid: 'f1',
        locationId: 'intro',
        effects: ['variables.gold = 5'],
        choices: [{ uid: 'c1', label: 'Go', action: 'goto:next', conditions: ['variables.gold >= 1'] }],
      }),
      frag({ uid: 'f2', locationId: 'next' }),
    ]);
    const warnings = analyzeProjectWarnings(project);
    expect(warnings.some(w => w.type === 'unknown-path' && w.message.includes('variables.gold'))).toBe(false);
  });

  test('flags a bare (unprefixed) write as a silent no-op', () => {
    const project = makeProject([
      frag({ uid: 'f1', locationId: 'intro', effects: ['gold = 5'] }),
    ]);
    const warnings = analyzeProjectWarnings(project);
    expect(warnings.some(w => w.type === 'unknown-path' && w.message.includes('silently discarded'))).toBe(true);
  });

  test('flags an ordering comparison against a non-numeric literal', () => {
    const project = makeProject([
      frag({ uid: 'f1', locationId: 'intro', conditions: ['variables.mood > happy'] }),
    ]);
    const warnings = analyzeProjectWarnings(project);
    expect(warnings.some(w => w.type === 'type-mismatch')).toBe(true);
  });

  test('flags a goto target whose every scene is condition-gated (possible dead-end)', () => {
    const project = makeProject([
      frag({ uid: 'f1', locationId: 'intro', choices: [{ uid: 'c1', label: 'Go', action: 'goto:vault', conditions: [] }] }),
      frag({ uid: 'f2', locationId: 'vault', conditions: ['variables.key == 1'] }),
    ]);
    const warnings = analyzeProjectWarnings(project);
    expect(warnings.some(w => w.type === 'unreachable-target' && w.message.includes('vault'))).toBe(true);
  });

  test('does not flag a goto target that has an unconditional fallback scene', () => {
    const project = makeProject([
      frag({ uid: 'f1', locationId: 'intro', choices: [{ uid: 'c1', label: 'Go', action: 'goto:vault', conditions: [] }] }),
      frag({ uid: 'f2', locationId: 'vault', priority: 10, conditions: ['variables.key == 1'] }),
      frag({ uid: 'f3', locationId: 'vault', priority: 0, conditions: [] }),
    ]);
    const warnings = analyzeProjectWarnings(project);
    expect(warnings.some(w => w.type === 'unreachable-target')).toBe(false);
  });

  test('a clean project produces no warnings', () => {
    const project = makeProject([
      frag({ uid: 'f1', locationId: 'intro', effects: ['variables.gold = 0'], choices: [{ uid: 'c1', label: 'Go', action: 'variables.gold += 1; goto:next', conditions: ['variables.gold >= 0'] }] }),
      frag({ uid: 'f2', locationId: 'next' }),
    ]);
    expect(analyzeProjectWarnings(project)).toEqual([]);
  });
});

describe('content hash (FNV-1a 64-bit)', () => {
  test('is a stable 16-char hex digest', () => {
    const project = makeProject([frag({ uid: 'f1', locationId: 'intro', text: 'hello' })]);
    const h = computeProjectContentHash(project);
    expect(h).toMatch(/^[0-9a-f]{16}$/);
    expect(computeProjectContentHash(project)).toBe(h); // deterministic
  });

  test('changes when any runtime-relevant content changes', () => {
    const base = makeProject([frag({ uid: 'f1', locationId: 'intro', text: 'hello' })]);
    const edited = makeProject([frag({ uid: 'f1', locationId: 'intro', text: 'hello.' })]);
    expect(computeProjectContentHash(base)).not.toBe(computeProjectContentHash(edited));
  });

  test('is sensitive to non-ASCII differences (two-byte mixing)', () => {
    // Curly vs straight apostrophe — single non-ASCII code unit difference.
    const straight = makeProject([frag({ uid: 'f1', locationId: 'intro', text: "don't" })]);
    const curly = makeProject([frag({ uid: 'f1', locationId: 'intro', text: 'don’t' })]);
    expect(computeProjectContentHash(straight)).not.toBe(computeProjectContentHash(curly));
  });

  test('no collisions across many near-identical single-character edits', () => {
    const hashes = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      const project = makeProject([frag({ uid: 'f1', locationId: 'intro', text: `line-${i}` })]);
      hashes.add(computeProjectContentHash(project));
    }
    expect(hashes.size).toBe(5000);
  });
});

describe('compiler robustness against adversarial structure', () => {
  test('contradictory effects in one action resolve deterministically (last write wins)', () => {
    const s = makeState();
    applyEffect('memory.x = true', s);
    applyEffect('memory.x = false', s);
    expect(s.memory.x).toBe(false);
  });

  test('self-loop goto compiles and is not reported as a broken link', () => {
    const project = makeProject([
      frag({ uid: 'f1', locationId: 'loop', choices: [{ uid: 'c1', label: 'Again', action: 'goto:loop', conditions: [] }] }),
    ], { startLocation: 'loop' });
    const result = compileProject(project);
    expect(result.ok).toBe(true);
  });

  test('duplicate locationId is a blocking error, not a warning', () => {
    const project = makeProject([
      frag({ uid: 'f1', locationId: 'intro' }),
      frag({ uid: 'f2', locationId: 'intro' }),
    ]);
    const result = compileProject(project);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.diagnostics.some(d => d.type === 'duplicate-location')).toBe(true);
  });
});
