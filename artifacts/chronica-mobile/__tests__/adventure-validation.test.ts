import { validateFragmentAdventure, validateProjectAdventures } from '../engine/adventure-validation';
import type { Fragment, Project } from '../engine/types';

function makeProject(input: Partial<Fragment> & Pick<Fragment, 'uid' | 'locationId'>): Project {
  const { uid, locationId, ...rest } = input;
  const base: Fragment = {
    title: 'Room',
    priority: 0,
    conditions: [],
    effects: [],
    text: 'Room',
    choices: [],
    ...rest,
    uid,
    locationId,
  };
  return {
    schemaVersion: 3,
    gameId: 'a0000001-0000-4000-8000-000000000099',
    id: 'p1',
    title: 'Adventure Tale',
    description: '',
    startLocation: locationId,
    initialVariables: {},
    initialMemory: {},
    createdAt: '',
    updatedAt: '',
    assets: [{ id: 'a1', name: 'bg.png', type: 'image', uri: 'file://bg.png', mimeType: 'image/png', size: 1, importedAt: '' }],
    characters: [],
    fragments: [base],
  };
}

describe('adventure validation', () => {
  test('flags missing player spawn as error', () => {
    const project = makeProject({
      uid: 'f1',
      locationId: 'room',
      adventure: {
        entry: { default: { x: 2, y: 0.5 } },
        interactables: [],
      },
    });
    const issues = validateFragmentAdventure(project.fragments[0]!, project);
    expect(issues.some(issue => issue.severity === 'error' && issue.message.includes('player spawn'))).toBe(true);
  });

  test('flags invalid collider bounds', () => {
    const project = makeProject({
      uid: 'f1',
      locationId: 'room',
      adventure: {
        entry: { default: { x: 0.2, y: 0.8 } },
        colliders: [{ uid: 'bad', x: 0.9, y: 0, width: 0.5, height: 0.2 }],
        interactables: [],
      },
    });
    const issues = validateFragmentAdventure(project.fragments[0]!, project);
    expect(issues.some(issue => issue.message.includes('invalid bounds'))).toBe(true);
  });

  test('flags unknown transition targets', () => {
    const project = makeProject({
      uid: 'f1',
      locationId: 'room',
      adventure: {
        entry: { default: { x: 0.2, y: 0.8 } },
        interactables: [{
          uid: 'door1',
          kind: 'door',
          label: 'Exit',
          x: 0.8,
          y: 0.5,
          action: 'goto:missing-room',
          conditions: [],
        }],
      },
    });
    const issues = validateFragmentAdventure(project.fragments[0]!, project);
    expect(issues.some(issue => issue.type === 'broken-link')).toBe(true);
  });

  test('warns when interactable sprite is missing from library', () => {
    const project = makeProject({
      uid: 'f1',
      locationId: 'room',
      adventure: {
        entry: { default: { x: 0.2, y: 0.8 } },
        interactables: [{
          uid: 'npc1',
          kind: 'npc',
          label: 'Guide',
          x: 0.4,
          y: 0.4,
          action: 'variables.met = true',
          conditions: [],
          sprite: 'missing.png',
        }],
      },
    });
    const issues = validateProjectAdventures(project);
    expect(issues.some(issue => issue.severity === 'warning' && issue.message.includes('missing.png'))).toBe(true);
  });
});
