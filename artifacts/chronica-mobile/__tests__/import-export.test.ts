/**
 * Tests for import/export serialisation round-trip.
 * These tests operate on plain data — no React, no AsyncStorage.
 */
import { Project, Fragment } from '../engine/types';
import { validateProject } from '../engine/validator';

const SCHEMA_VERSION = 2;

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    schemaVersion: SCHEMA_VERSION,
    gameId: 'a0000001-0000-4000-8000-000000000099',
    id: 'test-id',
    title: 'My Story',
    description: 'A test story',
    startLocation: 'intro',
    initialVariables: { trust: 0 },
    initialMemory: { met_guard: false },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    assets: [],
    characters: [],
    fragments: [
      {
        uid: 'f1',
        title: 'Intro',
        locationId: 'intro',
        priority: 0,
        conditions: [],
        effects: [],
        text: 'Hello world.',
        choices: [
          { uid: 'c1', label: 'Continue', action: 'goto:forest', conditions: [] },
        ],
      },
      {
        uid: 'f2',
        title: 'Forest',
        locationId: 'forest',
        priority: 0,
        conditions: [],
        effects: [],
        text: 'You are in the forest.',
        choices: [],
      },
    ],
    ...overrides,
  };
}

function exportProject(project: Project): string {
  const exportable: Project = {
    ...project,
    schemaVersion: SCHEMA_VERSION,
    assets: project.assets.map(a => ({ ...a, uri: '' })),
  };
  return JSON.stringify(exportable, null, 2);
}

function importProject(json: string): { ok: boolean; error?: string; project?: Project } {
  try {
    const data = JSON.parse(json);
    if (!data || typeof data !== 'object') return { ok: false, error: 'Not a valid JSON object.' };
    if (!data.schemaVersion) return { ok: false, error: 'Missing schemaVersion.' };
    if (!data.id || !data.title) return { ok: false, error: 'Missing required fields.' };
    if (!Array.isArray(data.fragments)) return { ok: false, error: 'Invalid fragments.' };
    return { ok: true, project: data as Project };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Parse error' };
  }
}

describe('export round-trip', () => {
  test('exported JSON parses back to equivalent project', () => {
    const original = makeProject();
    const json = exportProject(original);
    const result = importProject(json);
    expect(result.ok).toBe(true);
    expect(result.project?.title).toBe(original.title);
    expect(result.project?.fragments.length).toBe(original.fragments.length);
    expect(result.project?.schemaVersion).toBe(SCHEMA_VERSION);
  });

  test('exported project has stripped asset URIs', () => {
    const project = makeProject({
      assets: [{ id: 'a1', name: 'bg.png', type: 'image', uri: '/device/path/bg.png', mimeType: 'image/png', size: 1234, importedAt: '2026-01-01T00:00:00.000Z' }],
    });
    const json = exportProject(project);
    const parsed = JSON.parse(json);
    expect(parsed.assets[0].uri).toBe('');
  });

  test('exported JSON passes validation', () => {
    const project = makeProject();
    const json = exportProject(project);
    const result = importProject(json);
    expect(result.ok).toBe(true);
    expect(validateProject(result.project!)).toHaveLength(0);
  });
});

describe('import validation', () => {
  test('rejects non-JSON', () => {
    const result = importProject('this is not json!!!');
    expect(result.ok).toBe(false);
  });

  test('rejects missing schemaVersion', () => {
    const json = JSON.stringify({ id: 'x', title: 'test', fragments: [] });
    expect(importProject(json).ok).toBe(false);
    expect(importProject(json).error).toContain('schemaVersion');
  });

  test('rejects missing title', () => {
    const json = JSON.stringify({ schemaVersion: 2,
    gameId: 'a0000001-0000-4000-8000-000000000099', id: 'x', fragments: [] });
    const result = importProject(json);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('required');
  });

  test('rejects missing fragments array', () => {
    const json = JSON.stringify({ schemaVersion: 2,
    gameId: 'a0000001-0000-4000-8000-000000000099', id: 'x', title: 'test', fragments: 'bad' });
    const result = importProject(json);
    expect(result.ok).toBe(false);
  });

  test('accepts valid export', () => {
    const json = exportProject(makeProject());
    const result = importProject(json);
    expect(result.ok).toBe(true);
    expect(result.project?.startLocation).toBe('intro');
    expect(result.project?.initialVariables).toEqual({ trust: 0 });
  });
});

describe('fragment integrity after round-trip', () => {
  test('all fragment fields preserved', () => {
    const frag: Fragment = {
      uid: 'f1',
      title: 'Test Fragment',
      locationId: 'test',
      priority: 5,
      conditions: ['instability >= 2'],
      effects: ['variables.x += 1'],
      text: 'Test text',
      choices: [{ uid: 'c1', label: 'Go', action: 'goto:other', conditions: [] }],
      backgroundImage: 'bg.png',
    };
    const project = makeProject({ fragments: [frag, makeProject().fragments[1]] });
    const json = exportProject(project);
    const result = importProject(json);
    const restoredFrag = result.project?.fragments[0];
    expect(restoredFrag?.uid).toBe(frag.uid);
    expect(restoredFrag?.title).toBe(frag.title);
    expect(restoredFrag?.priority).toBe(frag.priority);
    expect(restoredFrag?.conditions).toEqual(frag.conditions);
    expect(restoredFrag?.effects).toEqual(frag.effects);
    expect(restoredFrag?.backgroundImage).toBe(frag.backgroundImage);
    expect(restoredFrag?.choices[0]?.label).toBe('Go');
  });
});
