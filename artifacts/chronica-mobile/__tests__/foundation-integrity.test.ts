import { findMissingAssetReferences } from '../engine/asset-reference-safety';
import { buildProjectIntegrityReport } from '../engine/project-integrity';
import type { Fragment, Project } from '../engine/types';

function makeProject(overrides: Partial<Project> = {}): Project {
  const fragment: Fragment = {
    uid: 'f1',
    title: 'Room',
    locationId: 'room',
    priority: 0,
    conditions: [],
    effects: [],
    text: 'Room',
    choices: [],
    backgroundImage: 'bg.png',
    backgroundAudio: 'loop.mp3',
    stageAuthoring: {
      objects: [{ uid: 'o1', asset: 'missing.png', x: 0.5, y: 0.5, layer: 'props' }],
    },
    adventure: {
      entry: { default: { x: 0.2, y: 0.8 } },
      interactables: [{
        uid: 'pickup1',
        kind: 'pickup',
        label: 'Item',
        x: 0.5,
        y: 0.5,
        action: 'variables.has_item = true',
        conditions: [],
        sprite: 'ghost.png',
      }],
    },
    ...overrides.fragments?.[0],
  };

  return {
    schemaVersion: 3,
    gameId: 'a0000001-0000-4000-8000-000000000099',
    id: 'p1',
    title: 'Integrity Tale',
    description: '',
    startLocation: 'room',
    initialVariables: {},
    initialMemory: {},
    createdAt: '',
    updatedAt: '',
    assets: [{
      id: 'a1',
      name: 'bg.png',
      type: 'image',
      uri: 'file://bg.png',
      mimeType: 'image/png',
      size: 1,
      importedAt: '',
    }],
    characters: [],
    fragments: [fragment],
    inventory: [{
      id: 'lantern',
      label: 'Lantern',
      assetName: 'lantern.png',
      stateKey: 'variables.has_lantern',
      stateKind: 'variable',
    }],
    ...overrides,
  };
}

describe('asset reference safety', () => {
  test('reports missing backgrounds, stage objects, and adventure sprites', () => {
    const issues = findMissingAssetReferences(makeProject());
    expect(issues.some(issue => issue.message.includes('Background audio'))).toBe(true);
    expect(issues.some(issue => issue.message.includes('Stage object'))).toBe(true);
    expect(issues.some(issue => issue.message.includes('ghost.png'))).toBe(true);
    expect(issues.some(issue => issue.message.includes('lantern.png'))).toBe(true);
  });
});

describe('project integrity report', () => {
  test('aggregates errors and warnings with summary', () => {
    const report = buildProjectIntegrityReport(makeProject({
      startLocation: 'missing-start',
    }));
    expect(report.ok).toBe(false);
    expect(report.errors.some(issue => issue.category === 'invalid-start')).toBe(true);
    expect(report.warnings.length).toBeGreaterThan(0);
    expect(report.summary).toContain('error');
  });

  test('flags unresolved recipe hooks for unused inventory state keys', () => {
    const report = buildProjectIntegrityReport(makeProject());
    expect(report.warnings.some(issue => issue.category === 'unresolved-hook')).toBe(true);
  });

  test('is non-destructive', () => {
    const project = makeProject();
    const before = JSON.stringify(project);
    buildProjectIntegrityReport(project);
    expect(JSON.stringify(project)).toBe(before);
  });
});
