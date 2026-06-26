import { compileProject } from '../engine/compiler';
import { buildCompiledGame } from '../engine/compiler/build-compiled-game';
import { activateHotspot, choose, startSession } from '../engine/chronica-session';
import { isValidHotspotBounds, getVisibleHotspots } from '../engine/hotspots';
import { resolveHotspotActivation } from '../engine/turn-resolver';
import { validateProject } from '../engine/validator';
import { Project, SceneHotspot } from '../engine/types';

function makeProject(hotspots: SceneHotspot[] = []): Project {
  return {
    schemaVersion: 2,
    gameId: 'a0000001-0000-4000-8000-000000000099',
    id: 'p1',
    title: 'Hotspot Tale',
    description: '',
    startLocation: 'room',
    initialVariables: {},
    initialMemory: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    assets: [],
    characters: [],
    fragments: [
      {
        uid: 'f1',
        title: 'Room',
        locationId: 'room',
        priority: 0,
        conditions: [],
        effects: [],
        text: 'A dusty room.',
        choices: [],
        hotspots,
      },
      {
        uid: 'f2',
        title: 'Hall',
        locationId: 'hall',
        priority: 0,
        conditions: [],
        effects: [],
        text: 'The hall.',
        choices: [],
      },
    ],
  };
}

const lanternHotspot: SceneHotspot = {
  uid: 'h1',
  label: 'Lantern',
  x: 0.2,
  y: 0.3,
  width: 0.2,
  height: 0.2,
  action: 'goto:hall; variables.foundLantern = true',
  conditions: [],
};

describe('hotspot gameplay model', () => {
  test('validates hotspot bounds', () => {
    expect(isValidHotspotBounds(lanternHotspot)).toBe(true);
    expect(isValidHotspotBounds({ ...lanternHotspot, width: 1.5 })).toBe(false);
  });

  test('compiler embeds hotspotActions without changing choiceActions contract', () => {
    const project = makeProject([lanternHotspot]);
    const result = compileProject(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.game.hotspotActions.h1).toEqual([
      { kind: 'goto', locationId: 'hall' },
      { kind: 'assign', path: 'variables.foundLantern', rawValue: 'true' },
    ]);
    expect(result.game.choiceActions).toEqual({});
  });

  test('hotspot activation uses same execution path as choices', () => {
    const game = buildCompiledGame(makeProject([lanternHotspot]));
    const session = startSession(game);
    expect(session.visibleHotspots).toHaveLength(1);

    const after = activateHotspot(lanternHotspot, session.state, game);
    expect(after.fragment?.locationId).toBe('hall');
    expect(after.visibleHotspots).toHaveLength(0);
    expect(session.state.variables.foundLantern).toBe(true);
  });

  test('conditions gate hotspot visibility', () => {
    const gated: SceneHotspot = {
      ...lanternHotspot,
      uid: 'h2',
      conditions: ['variables.key == true'],
    };
    const game = buildCompiledGame(makeProject([gated]));
    const session = startSession(game);
    expect(getVisibleHotspots(session.fragment!, session.state)).toHaveLength(0);

    session.state.variables.key = true;
    expect(getVisibleHotspots(session.fragment!, session.state)).toHaveLength(1);
  });

  test('rejects invalid hotspot actions at compile time', () => {
    const bad = makeProject([{ ...lanternHotspot, action: 'goto:missing' }]);
    const errors = validateProject(bad);
    expect(errors.some(e => e.type === 'broken-link')).toBe(true);
  });

  test('resolveHotspotActivation returns null for unknown uid', () => {
    const game = buildCompiledGame(makeProject([]));
    const state = startSession(game).state;
    const unknown = { ...lanternHotspot, uid: 'missing' };
    expect(resolveHotspotActivation(unknown, state, game)).toBeNull();
  });

  test('choose still works alongside hotspots', () => {
    const project = makeProject([lanternHotspot]);
    project.fragments[0].choices = [{
      uid: 'c1',
      label: 'Stay',
      action: 'goto:room',
      conditions: [],
    }];
    const game = buildCompiledGame(project);
    const session = startSession(game);
    const after = choose(session.visibleChoices[0], session.state, game);
    expect(after.fragment?.locationId).toBe('room');
  });
});
