import {
  compileProject,
  buildCompiledGame,
  resolveCompileStartLocation,
  getActiveFragmentFromIndex,
  COMPILED_GAME_VERSION,
} from '../engine/compiler';
import { Project, Fragment } from '../engine/types';

function makeProject(fragments: Fragment[], overrides: Partial<Project> = {}): Project {
  return {
    schemaVersion: 2,
    gameId: 'a0000001-0000-4000-8000-000000000099',
    id: 'p1',
    title: 'Test',
    description: '',
    startLocation: 'intro',
    initialVariables: {},
    initialMemory: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    assets: [],
    fragments,
    ...overrides,
  };
}

const fragments: Fragment[] = [
  {
    uid: 'f1',
    title: 'Intro',
    locationId: 'intro',
    priority: 0,
    conditions: [],
    effects: [],
    text: 'Welcome.',
    choices: [{ uid: 'c1', label: 'Forest', action: 'goto:forest', conditions: [] }],
  },
  {
    uid: 'f2',
    title: 'Forest',
    locationId: 'forest',
    priority: 0,
    conditions: [],
    effects: [],
    text: 'Trees.',
    choices: [],
  },
];

describe('resolveCompileStartLocation', () => {
  test('uses configured start when present', () => {
    expect(resolveCompileStartLocation(makeProject(fragments))).toBe('intro');
  });

  test('falls back to first fragment', () => {
    expect(resolveCompileStartLocation(makeProject(fragments, { startLocation: 'missing' }))).toBe('intro');
  });
});

describe('compileProject', () => {
  test('succeeds for valid project', () => {
    const result = compileProject(makeProject(fragments));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.game.gameId).toBe('a0000001-0000-4000-8000-000000000099');
    expect(result.game.installId).toBe('p1');
    expect(result.game.startLocation).toBe('intro');
    expect(result.game.fragmentIndex.byLocation.intro).toHaveLength(1);
    expect(result.game.contentHash).toBeTruthy();
    expect(result.game.version).toBe(COMPILED_GAME_VERSION);
    expect(result.game.choiceActions.c1).toEqual([{ kind: 'goto', locationId: 'forest' }]);
  });

  test('fails for invalid action syntax', () => {
    const bad = makeProject([
      {
        ...fragments[0],
        choices: [{ uid: 'c1', label: 'Bad', action: 'jump:nowhere', conditions: [] }],
      },
      fragments[1],
    ]);
    const result = compileProject(bad);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics.some(d => d.type === 'invalid-action')).toBe(true);
  });

  test('fails for labeled choice with empty action', () => {
    const bad = makeProject([
      {
        ...fragments[0],
        choices: [{ uid: 'c1', label: 'Go nowhere', action: '', conditions: [] }],
      },
      fragments[1],
    ]);
    const result = compileProject(bad);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics.some(d => d.type === 'invalid-action')).toBe(true);
  });

  test('fails for broken links', () => {
    const bad = makeProject([
      {
        ...fragments[0],
        choices: [{ uid: 'c1', label: 'Nowhere', action: 'goto:void', conditions: [] }],
      },
    ]);
    const result = compileProject(bad);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics.some(d => d.type === 'broken-link')).toBe(true);
  });

  test('builds priority-sorted location index', () => {
    const project = makeProject([
      { ...fragments[0], uid: 'low', priority: 0, conditions: ['variables.flag == true'] },
      { ...fragments[0], uid: 'high', priority: 10, conditions: [] },
    ]);
    const game = buildCompiledGame(project);
    const index = game.fragmentIndex;
    expect(index.byLocation.intro[0].uid).toBe('high');
    expect(index.byLocation.intro[1].uid).toBe('low');
  });
});

describe('fragment index lookup', () => {
  test('selects highest-priority fragment whose conditions pass', () => {
    const game = buildCompiledGame(makeProject([
      {
        ...fragments[0],
        uid: 'gated',
        priority: 5,
        conditions: ['variables.unlocked == true'],
      },
      {
        ...fragments[0],
        uid: 'default',
        priority: 0,
        conditions: [],
      },
    ]));

    const state: import('../engine/types').ChronicaState = {
      location: 'intro',
      instability: 0,
      reality_layer: 0,
      memory: {},
      variables: {},
    };

    expect(getActiveFragmentFromIndex('intro', state, game.fragmentIndex)?.uid).toBe('default');

    state.variables = { unlocked: true };
    expect(getActiveFragmentFromIndex('intro', state, game.fragmentIndex)?.uid).toBe('gated');
  });
});
