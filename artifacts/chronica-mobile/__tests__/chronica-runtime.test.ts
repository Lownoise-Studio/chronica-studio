import { compileProject } from '../engine/compiler';
import { ChronicaRuntime } from '../runtime/chronica-runtime';
import { Project, Fragment } from '../engine/types';

function makeProject(fragments: Fragment[], overrides: Partial<Project> = {}): Project {
  return {
    schemaVersion: 1,
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
    expect(save).not.toBeNull();

    const rt2 = new ChronicaRuntime(compileOrThrow(makeProject(fragments)));
    expect(rt2.resume(save!)).toBe(true);
    expect(rt2.currentFragment?.locationId).toBe('forest');
    expect(rt2.pathHistory).toHaveLength(2);
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
