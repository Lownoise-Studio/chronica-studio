import {
  buildUnlockCondition,
  conditionUsesVariable,
  extractProjectVariables,
  extractVariableFromEffect,
  getGotoTarget,
  getSceneOptions,
  isValidDestination,
  isVariableInConditions,
  setGotoInAction,
} from '../engine/editor-helpers';
import { Project } from '../engine/types';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    schemaVersion: 2,
    gameId: 'a0000001-0000-4000-8000-000000000099',
    id: 'p1',
    title: 'Story',
    description: '',
    startLocation: 'intro',
    initialVariables: {},
    initialMemory: {},
    createdAt: '',
    updatedAt: '',
    assets: [],
    characters: [],
    fragments: [],
    ...overrides,
  };
}

describe('extractVariableFromEffect', () => {
  test('parses assignment', () => {
    expect(extractVariableFromEffect('variables.visited_forest = true')).toEqual({
      name: 'visited_forest',
      rawValue: 'true',
    });
  });

  test('parses increment', () => {
    expect(extractVariableFromEffect('variables.trust += 1')).toEqual({
      name: 'trust',
      rawValue: '1',
    });
  });

  test('returns null for non-variable effects', () => {
    expect(extractVariableFromEffect('goto:forest')).toBeNull();
  });
});

describe('buildUnlockCondition', () => {
  test('boolean template', () => {
    expect(buildUnlockCondition('visited_forest', 'boolean', 'true')).toBe(
      'variables.visited_forest == true',
    );
  });

  test('number template', () => {
    expect(buildUnlockCondition('trust', 'number', '3')).toBe('variables.trust >= 1');
  });

  test('string template with quotes', () => {
    expect(buildUnlockCondition('mood', 'string', '"somber"')).toBe(
      'variables.mood == "somber"',
    );
  });

  test('string template without quotes', () => {
    expect(buildUnlockCondition('mood', 'string', 'calm')).toBe(
      'variables.mood == "calm"',
    );
  });
});

describe('conditionUsesVariable', () => {
  test('detects variable reference', () => {
    expect(conditionUsesVariable('variables.trust >= 3', 'trust')).toBe(true);
    expect(conditionUsesVariable('variables.trust >= 3', 'trus')).toBe(false);
  });
});

describe('isVariableInConditions', () => {
  test('finds variable across conditions', () => {
    expect(
      isVariableInConditions('trust', ['variables.trust >= 2', 'variables.mood == "x"']),
    ).toBe(true);
    expect(isVariableInConditions('trust', ['variables.mood == "x"'])).toBe(false);
  });
});

describe('extractProjectVariables', () => {
  test('collects from effects, choice actions, and initialVariables', () => {
    const project = makeProject({
      initialVariables: { trust: 0, mood: 'calm' },
      fragments: [
        {
          uid: 'f1',
          title: 'Intro',
          locationId: 'intro',
          priority: 0,
          conditions: [],
          effects: ['variables.visited_forest = true'],
          text: '',
          choices: [
            { uid: 'c1', label: 'Go', action: 'variables.trust += 1; goto:forest', conditions: [] },
          ],
        },
      ],
    });

    const vars = extractProjectVariables(project);
    expect(vars.map(v => v.name).sort()).toEqual(['mood', 'trust', 'visited_forest']);
    expect(vars.find(v => v.name === 'visited_forest')?.type).toBe('boolean');
    expect(vars.find(v => v.name === 'trust')?.type).toBe('number');
    expect(vars.find(v => v.name === 'mood')?.type).toBe('string');
  });
});

describe('getSceneOptions', () => {
  test('returns sorted scene list with titles', () => {
    const options = getSceneOptions([
      {
        uid: 'f2',
        title: 'Forest',
        locationId: 'forest',
        priority: 0,
        conditions: [],
        effects: [],
        text: '',
        choices: [],
      },
      {
        uid: 'f1',
        title: 'Intro',
        locationId: 'intro',
        priority: 0,
        conditions: [],
        effects: [],
        text: '',
        choices: [],
      },
    ]);
    expect(options).toEqual([
      { uid: 'f2', locationId: 'forest', title: 'Forest' },
      { uid: 'f1', locationId: 'intro', title: 'Intro' },
    ]);
  });
});

describe('getGotoTarget', () => {
  test('extracts goto from multi-step action', () => {
    expect(getGotoTarget('variables.x += 1; goto:forest')).toBe('forest');
    expect(getGotoTarget('set:flag')).toBeNull();
  });
});

describe('setGotoInAction', () => {
  test('replaces existing goto step', () => {
    expect(setGotoInAction('variables.x += 1; goto:old', 'new')).toBe(
      'variables.x += 1; goto:new',
    );
  });

  test('adds goto when missing', () => {
    expect(setGotoInAction('variables.x += 1', 'forest')).toBe(
      'variables.x += 1; goto:forest',
    );
  });

  test('sets goto-only action', () => {
    expect(setGotoInAction('', 'intro')).toBe('goto:intro');
  });
});

describe('isValidDestination', () => {
  test('checks membership in known locations', () => {
    const known = new Set(['intro', 'forest']);
    expect(isValidDestination('forest', known)).toBe(true);
    expect(isValidDestination('void', known)).toBe(false);
    expect(isValidDestination('', known)).toBe(false);
  });
});
