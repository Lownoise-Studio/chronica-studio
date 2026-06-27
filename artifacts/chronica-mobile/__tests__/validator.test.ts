import { validateProject, validateFragment, findBrokenLinks } from '../engine/validator';
import { Project, Fragment } from '../engine/types';

function makeProject(fragments: Fragment[] = []): Project {
  return {
    schemaVersion: 2,
    gameId: 'a0000001-0000-4000-8000-000000000099',
    id: 'test-project',
    title: 'Test Project',
    description: '',
    startLocation: 'start',
    initialVariables: {},
    initialMemory: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fragments,
    assets: [],
    characters: [],
  };
}

function makeFragment(uid: string, locationId: string, overrides: Partial<Fragment> = {}): Fragment {
  return {
    uid,
    title: locationId,
    locationId,
    priority: 0,
    conditions: [],
    effects: [],
    text: '',
    choices: [],
    ...overrides,
  };
}

describe('validateFragment', () => {
  test('valid fragment returns no errors', () => {
    const f = makeFragment('f1', 'start', {
      conditions: ['instability >= 2'],
      effects: ['variables.trust += 1'],
    });
    expect(validateFragment(f)).toHaveLength(0);
  });

  test('invalid condition flagged', () => {
    const f = makeFragment('f1', 'start', {
      conditions: ['this is garbage'],
    });
    const errors = validateFragment(f);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].type).toBe('invalid-condition');
  });

  test('invalid effect flagged', () => {
    const f = makeFragment('f1', 'start', {
      effects: ['goto:forest'],
    });
    const errors = validateFragment(f);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].type).toBe('invalid-effect');
  });

  test('invalid choice condition flagged', () => {
    const f = makeFragment('f1', 'start', {
      choices: [{ uid: 'c1', label: 'Go', action: 'goto:forest', conditions: ['bad condition!!!'] }],
    });
    const errors = validateFragment(f);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].type).toBe('invalid-condition');
  });
});

describe('findBrokenLinks', () => {
  test('no broken links returns empty', () => {
    const project = makeProject([
      makeFragment('f1', 'start', {
        choices: [{ uid: 'c1', label: 'Go', action: 'goto:forest', conditions: [] }],
      }),
      makeFragment('f2', 'forest'),
    ]);
    expect(findBrokenLinks(project)).toHaveLength(0);
  });

  test('broken goto target detected', () => {
    const project = makeProject([
      makeFragment('f1', 'start', {
        choices: [{ uid: 'c1', label: 'Go', action: 'goto:void', conditions: [] }],
      }),
    ]);
    const errors = findBrokenLinks(project);
    expect(errors.length).toBe(1);
    expect(errors[0].type).toBe('broken-link');
    expect(errors[0].message).toContain('void');
  });

  test('non-goto actions are ignored', () => {
    const project = makeProject([
      makeFragment('f1', 'start', {
        choices: [{ uid: 'c1', label: 'Do', action: 'variables.trust += 1', conditions: [] }],
      }),
    ]);
    expect(findBrokenLinks(project)).toHaveLength(0);
  });

  test('multi-step action: only goto steps checked', () => {
    const project = makeProject([
      makeFragment('f1', 'start', {
        choices: [{ uid: 'c1', label: 'Go', action: 'variables.x += 1; goto:ghost', conditions: [] }],
      }),
    ]);
    const errors = findBrokenLinks(project);
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain('ghost');
  });
});

describe('validateProject', () => {
  test('valid project returns no errors', () => {
    const project = makeProject([
      makeFragment('f1', 'start', {
        choices: [{ uid: 'c1', label: 'Go', action: 'goto:forest', conditions: [] }],
      }),
      makeFragment('f2', 'forest'),
    ]);
    expect(validateProject(project)).toHaveLength(0);
  });

  test('missing start location is flagged', () => {
    const project = makeProject([makeFragment('f1', 'forest')]);
    project.startLocation = 'start'; // no 'start' fragment exists
    const errors = validateProject(project);
    const startError = errors.find(e => e.type === 'missing-start');
    expect(startError).toBeDefined();
  });

  test('broken link + invalid condition both caught', () => {
    const project = makeProject([
      makeFragment('f1', 'start', {
        conditions: ['not valid!!'],
        choices: [{ uid: 'c1', label: 'Go', action: 'goto:nowhere', conditions: [] }],
      }),
    ]);
    project.startLocation = 'start';
    const errors = validateProject(project);
    expect(errors.some(e => e.type === 'invalid-condition')).toBe(true);
    expect(errors.some(e => e.type === 'broken-link')).toBe(true);
  });

  test('empty project with no fragments flags missing start', () => {
    const project = makeProject([]);
    project.startLocation = 'intro';
    const errors = validateProject(project);
    expect(errors.some(e => e.type === 'missing-start')).toBe(true);
  });
});

describe('findDuplicateLocations', () => {
  test('flags duplicate locationId when both variants are unconditional', () => {
    const project = makeProject([
      makeFragment('f1', 'intro'),
      makeFragment('f2', 'intro'),
    ]);
    project.startLocation = 'intro';
    const errors = validateProject(project);
    expect(errors.some(e => e.type === 'duplicate-location')).toBe(true);
  });

  test('allows duplicate locationId when variants have unlock conditions', () => {
    const project = makeProject([
      makeFragment('f1', 'pasture', { conditions: ['variables.time == "morning"'] }),
      makeFragment('f2', 'pasture', { conditions: ['variables.time == "evening"'] }),
    ]);
    project.startLocation = 'pasture';
    const errors = validateProject(project);
    expect(errors.some(e => e.type === 'duplicate-location')).toBe(false);
  });
});

describe('findMissingAssetRefs', () => {
  test('flags missing background image', () => {
    const project = makeProject([
      makeFragment('f1', 'intro', { backgroundImage: 'missing.jpg' }),
    ]);
    project.startLocation = 'intro';
    const errors = validateProject(project);
    expect(errors.some(e => e.type === 'missing-asset')).toBe(true);
  });
});

describe('findOrphanScenes', () => {
  test('flags scene with no incoming links', () => {
    const project = makeProject([
      makeFragment('f1', 'intro', {
        choices: [{ uid: 'c1', label: 'Go', action: 'goto:forest', conditions: [] }],
      }),
      makeFragment('f2', 'forest'),
      makeFragment('f3', 'orphan'),
    ]);
    project.startLocation = 'intro';
    const errors = validateProject(project);
    expect(errors.some(e => e.type === 'orphan-scene' && e.message.includes('orphan'))).toBe(true);
  });
});
