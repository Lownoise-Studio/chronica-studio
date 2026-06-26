import { compileProject } from '../engine/compiler';
import { ChronicaRuntime } from '../runtime/chronica-runtime';
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

function compileOrThrow(project: Project) {
  const result = compileProject(project);
  if (!result.ok) throw new Error('compile failed');
  return result.game;
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

describe('ChronicaRuntime', () => {
  test('exposes gameId and installId on compiled game', () => {
    const game = compileOrThrow(makeProject(fragments));
    expect(game.gameId).toBe('a0000001-0000-4000-8000-000000000099');
    expect(game.installId).toBe('p1');
    const rt = new ChronicaRuntime(game);
    expect(rt.game.gameId).toBe(game.gameId);
    expect(rt.game.installId).toBe('p1');
  });

  test('start opens first scene with visible choices', () => {
    const rt = new ChronicaRuntime(compileOrThrow(makeProject(fragments)));
    expect(rt.start()).toBe(true);
    expect(rt.isStarted).toBe(true);
    expect(rt.currentFragment?.locationId).toBe('intro');
    expect(rt.visibleChoices).toHaveLength(1);
    expect(rt.pathHistory).toHaveLength(1);
  });

  test('choose advances to linked scene', () => {
    const rt = new ChronicaRuntime(compileOrThrow(makeProject(fragments)));
    rt.start();
    const result = rt.choose(rt.visibleChoices[0]);
    expect(result.ok).toBe(true);
    expect(rt.currentFragment?.locationId).toBe('forest');
    expect(rt.pathHistory).toHaveLength(2);
  });

  test('resume restores saved session', () => {
    const rt = new ChronicaRuntime(compileOrThrow(makeProject(fragments)));
    rt.start();
    rt.choose(rt.visibleChoices[0]);
    const save = rt.toSave('p1');
    expect(save!.gameId).toBe('a0000001-0000-4000-8000-000000000099');
    expect(save!.contentHash).toBeTruthy();
    expect(save!.projectId).toBe('p1');

    const rt2 = new ChronicaRuntime(compileOrThrow(makeProject(fragments)));
    expect(rt2.tryResume(save!)).toEqual({ ok: true });
    expect(rt2.currentFragment?.locationId).toBe('forest');
    expect(rt2.pathHistory).toHaveLength(2);
  });

  test('tryResume rejects stale save when content changed', () => {
    const rt = new ChronicaRuntime(compileOrThrow(makeProject(fragments)));
    rt.start();
    const save = rt.toSave('p1')!;

    const edited = compileOrThrow(makeProject([
      { ...fragments[0], text: 'Edited.' },
      fragments[1],
    ]));
    const rt2 = new ChronicaRuntime(edited);
    expect(rt2.tryResume(save)).toEqual({ ok: false, reason: 'stale-content' });
  });

  test('resolves background uri from assets', () => {
    const project = makeProject([
      {
        ...fragments[0],
        backgroundImage: 'bg.jpg',
      },
      fragments[1],
    ], {
      assets: [{
        id: 'a1',
        name: 'bg.jpg',
        type: 'image',
        uri: 'file:///data/bg.jpg',
        mimeType: 'image/jpeg',
        size: 1,
        importedAt: '',
      }],
    });
    const rt = new ChronicaRuntime(compileOrThrow(project));
    rt.start();
    expect(rt.getBackgroundUri()).toBe('file:///data/bg.jpg');
  });
});
