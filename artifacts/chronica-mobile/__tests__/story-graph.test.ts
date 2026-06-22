import { buildStoryGraph, computeLocationDepths, groupGraphNodes, resolveLocationTitle } from '../engine/story-graph';
import { Project } from '../engine/types';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    schemaVersion: 1,
    id: 'p1',
    title: 'Story',
    description: '',
    startLocation: 'intro',
    initialVariables: {},
    initialMemory: {},
    createdAt: '',
    updatedAt: '',
    assets: [],
    fragments: [],
    ...overrides,
  };
}

describe('buildStoryGraph', () => {
  test('builds nodes and edges from fragments and choices', () => {
    const project = makeProject({
      fragments: [
        {
          uid: 'f1',
          title: 'Intro',
          locationId: 'intro',
          priority: 0,
          conditions: [],
          effects: [],
          text: '',
          choices: [
            { uid: 'c1', label: 'Go forest', action: 'goto:forest', conditions: [] },
            { uid: 'c2', label: 'Secret', action: 'goto:forest', conditions: ['variables.key == true'] },
          ],
        },
        {
          uid: 'f2',
          title: 'Forest',
          locationId: 'forest',
          priority: 0,
          conditions: ['variables.visited == true'],
          effects: [],
          text: '',
          choices: [],
        },
      ],
    });

    const graph = buildStoryGraph(project);

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(2);

    const intro = graph.nodes.find(n => n.fragmentUid === 'f1')!;
    expect(intro.isStart).toBe(true);
    expect(intro.hasUnlockRequirements).toBe(false);
    expect(intro.outgoingCount).toBe(2);

    const forest = graph.nodes.find(n => n.fragmentUid === 'f2')!;
    expect(forest.hasUnlockRequirements).toBe(true);
    expect(forest.unlockCount).toBe(1);
    expect(forest.depth).toBe(1);

    expect(graph.edges.every(e => !e.broken)).toBe(true);
    expect(graph.edges.some(e => e.hasChoiceConditions)).toBe(true);
  });

  test('marks broken choice destinations', () => {
    const project = makeProject({
      fragments: [
        {
          uid: 'f1',
          title: 'Intro',
          locationId: 'intro',
          priority: 0,
          conditions: [],
          effects: [],
          text: '',
          choices: [{ uid: 'c1', label: 'Void', action: 'goto:void', conditions: [] }],
        },
      ],
    });

    const graph = buildStoryGraph(project);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].broken).toBe(true);
    expect(graph.nodes[0].hasBrokenOutgoing).toBe(true);
  });
});

describe('computeLocationDepths', () => {
  test('assigns BFS depth from start location', () => {
    const project = makeProject({
      startLocation: 'intro',
      fragments: [
        {
          uid: 'f1', title: 'Intro', locationId: 'intro', priority: 0,
          conditions: [], effects: [], text: '',
          choices: [{ uid: 'c1', label: 'Go', action: 'goto:mid', conditions: [] }],
        },
        {
          uid: 'f2', title: 'Mid', locationId: 'mid', priority: 0,
          conditions: [], effects: [], text: '',
          choices: [{ uid: 'c2', label: 'End', action: 'goto:end', conditions: [] }],
        },
        {
          uid: 'f3', title: 'End', locationId: 'end', priority: 0,
          conditions: [], effects: [], text: '', choices: [],
        },
        {
          uid: 'f4', title: 'Orphan', locationId: 'orphan', priority: 0,
          conditions: [], effects: [], text: '', choices: [],
        },
      ],
    });
    const graph = buildStoryGraph(project);
    const depths = computeLocationDepths(project.fragments, graph.edges, 'intro');

    expect(depths.get('intro')).toBe(0);
    expect(depths.get('mid')).toBe(1);
    expect(depths.get('end')).toBe(2);
    expect(depths.has('orphan')).toBe(false);
  });
});

describe('groupGraphNodes', () => {
  test('groups nodes by depth with unconnected section last', () => {
    const project = makeProject({
      fragments: [
        {
          uid: 'f1', title: 'Intro', locationId: 'intro', priority: 0,
          conditions: [], effects: [], text: '',
          choices: [{ uid: 'c1', label: 'Go', action: 'goto:forest', conditions: [] }],
        },
        {
          uid: 'f2', title: 'Forest', locationId: 'forest', priority: 0,
          conditions: [], effects: [], text: '', choices: [],
        },
        {
          uid: 'f3', title: 'Lost', locationId: 'lost', priority: 0,
          conditions: [], effects: [], text: '', choices: [],
        },
      ],
    });

    const graph = buildStoryGraph(project);
    const sections = groupGraphNodes(graph.nodes);

    expect(sections[0].title).toBe('Opening');
    expect(sections[0].nodes.some(n => n.locationId === 'intro')).toBe(true);
    expect(sections[1].title).toBe('Step 1');
    expect(sections[sections.length - 1].title).toBe('Unconnected');
    expect(sections[sections.length - 1].nodes.some(n => n.locationId === 'lost')).toBe(true);
  });
});

describe('resolveLocationTitle', () => {
  test('returns scene title when available', () => {
    const fragments = [
      {
        uid: 'f1', title: 'Forest Path', locationId: 'forest', priority: 0,
        conditions: [], effects: [], text: '', choices: [],
      },
    ];
    expect(resolveLocationTitle(fragments, 'forest')).toBe('Forest Path');
    expect(resolveLocationTitle(fragments, 'missing')).toBe('missing');
  });
});
