import { compileProject, buildCompiledGame } from '../engine/compiler';
import { activateHotspot, startSession } from '../engine/chronica-session';
import { computeProjectContentHash } from '../engine/compiler/build-compiled-game';
import { collectReferencedAssetNames } from '../engine/chronica-package';
import { ChronicaRuntime } from '../runtime/chronica-runtime';
import type { Fragment, Project, SceneHotspot } from '../engine/types';

function makeProject(fragments: Fragment[], overrides: Partial<Project> = {}): Project {
  return {
    schemaVersion: 3,
    gameId: 'a0000001-0000-4000-8000-000000000099',
    id: 'p1',
    title: 'Hardening',
    description: '',
    startLocation: 'room',
    initialVariables: { inspected: false },
    initialMemory: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    assets: [],
    characters: [],
    fragments,
    ...overrides,
  };
}

const inspectHotspot: SceneHotspot = {
  uid: 'h-inspect',
  label: 'Inspect',
  x: 0.3,
  y: 0.3,
  width: 0.2,
  height: 0.2,
  action: 'variables.inspected = true',
  conditions: ['variables.inspected != true'],
};

describe('engine hardening', () => {
  test('multi-line dialogue hides choices and hotspots until exhausted', () => {
    const project = makeProject([
      {
        uid: 'f1',
        title: 'Room',
        locationId: 'room',
        priority: 0,
        conditions: [],
        effects: [],
        text: '',
        dialogue: [
          { uid: 'l1', speakerId: null, text: 'Line one.' },
          { uid: 'l2', speakerId: null, text: 'Line two.' },
          { uid: 'l3', speakerId: null, text: 'Line three.' },
        ],
        choices: [{ uid: 'c1', label: 'Leave', action: 'goto:hall', conditions: [] }],
        hotspots: [inspectHotspot],
      },
      {
        uid: 'f2',
        title: 'Hall',
        locationId: 'hall',
        priority: 0,
        conditions: [],
        effects: [],
        text: 'Hall.',
        choices: [],
      },
    ]);

    const compiled = compileProject(project);
    if (!compiled.ok) throw new Error('compile failed');
    const runtime = new ChronicaRuntime(compiled.game);
    runtime.start();

    expect(runtime.visibleChoices).toHaveLength(0);
    expect(runtime.visibleHotspots).toHaveLength(0);

    runtime.advanceDialogue();
    expect(runtime.visibleChoices).toHaveLength(0);
    expect(runtime.visibleHotspots).toHaveLength(0);

    runtime.advanceDialogue();
    expect(runtime.visibleChoices).toHaveLength(1);
    expect(runtime.visibleHotspots).toHaveLength(1);
  });

  test('same-scene hotspot preserves dialogue index while revealing gated choices', () => {
    const project = makeProject([
      {
        uid: 'f1',
        title: 'Room',
        locationId: 'room',
        priority: 0,
        conditions: [],
        effects: [],
        text: '',
        dialogue: [
          { uid: 'l1', speakerId: null, text: 'Look around.' },
          { uid: 'l2', speakerId: null, text: 'Something glints.' },
        ],
        choices: [
          {
            uid: 'c1',
            label: 'Use the unlocked door',
            action: 'goto:hall',
            conditions: ['variables.inspected == true'],
          },
        ],
        hotspots: [inspectHotspot],
      },
      {
        uid: 'f2',
        title: 'Hall',
        locationId: 'hall',
        priority: 0,
        conditions: [],
        effects: [],
        text: 'Hall.',
        choices: [],
      },
    ]);

    const compiled = compileProject(project);
    if (!compiled.ok) throw new Error('compile failed');
    const rt = new ChronicaRuntime(compiled.game);
    rt.start();
    rt.advanceDialogue();
    expect(rt.runtimeState?.dialogueLineIndex).toBe(1);

    rt.activateHotspot(rt.visibleHotspots[0]!);
    expect(rt.currentFragment?.locationId).toBe('room');
    expect(rt.runtimeState?.dialogueLineIndex).toBe(1);
    expect(rt.runtimeState?.variables.inspected).toBe(true);
    expect(rt.visibleChoices).toHaveLength(1);
  });

  test('ChronicaRuntime resume preserves dialogue progress on first applyTurn', () => {
    const project = makeProject([
      {
        uid: 'f1',
        title: 'Room',
        locationId: 'room',
        priority: 0,
        conditions: [],
        effects: [],
        text: '',
        dialogue: [
          { uid: 'l1', speakerId: null, text: 'One.' },
          { uid: 'l2', speakerId: null, text: 'Two.' },
          { uid: 'l3', speakerId: null, text: 'Three.' },
        ],
        choices: [],
      },
    ]);

    const game = buildCompiledGame(project);
    const rt = new ChronicaRuntime(game);
    rt.start();
    rt.advanceDialogue();
    rt.advanceDialogue();
    expect(rt.runtimeState?.dialogueLineIndex).toBe(2);

    const save = rt.toSave('p1')!;
    const rt2 = new ChronicaRuntime(game);
    expect(rt2.tryResume(save)).toEqual({ ok: true });
    expect(rt2.runtimeState?.dialogueLineIndex).toBe(2);
  });

  test('content hash changes when characters are edited', () => {
    const base = makeProject([
      {
        uid: 'f1',
        title: 'Room',
        locationId: 'room',
        priority: 0,
        conditions: [],
        effects: [],
        text: 'Hi.',
        choices: [],
      },
    ]);

    const withCharacter = makeProject(base.fragments, {
      characters: [{
        uid: 'c1',
        characterId: 'elena',
        displayName: 'Elena',
        defaultPortrait: 'elena.png',
      }],
      assets: [{
        id: 'a1',
        name: 'elena.png',
        type: 'image',
        uri: 'file:///elena.png',
        mimeType: 'image/png',
        size: 1,
        importedAt: '',
      }],
    });

    expect(computeProjectContentHash(withCharacter)).not.toBe(computeProjectContentHash(base));
    expect(collectReferencedAssetNames(withCharacter)).toContain('elena.png');
  });

  test('same-location fragment swap resets dialogue index', () => {
    const project = makeProject([
      {
        uid: 'f-before',
        title: 'Room (before)',
        locationId: 'room',
        priority: 0,
        conditions: ['variables.inspected != true'],
        effects: [],
        text: '',
        dialogue: [
          { uid: 'l1', speakerId: null, text: 'Before inspect.' },
          { uid: 'l2', speakerId: null, text: 'Still before.' },
        ],
        choices: [],
        hotspots: [inspectHotspot],
      },
      {
        uid: 'f-after',
        title: 'Room (after)',
        locationId: 'room',
        priority: 1,
        conditions: ['variables.inspected == true'],
        effects: [],
        text: '',
        dialogue: [{ uid: 'l3', speakerId: null, text: 'After inspect.' }],
        choices: [],
      },
    ]);

    const game = buildCompiledGame(project);
    const rt = new ChronicaRuntime(game);
    rt.start();
    rt.advanceDialogue();
    expect(rt.runtimeState?.dialogueLineIndex).toBe(1);
    expect(rt.currentFragment?.uid).toBe('f-before');

    rt.activateHotspot(rt.visibleHotspots[0]!);
    expect(rt.currentFragment?.uid).toBe('f-after');
    expect(rt.runtimeState?.dialogueLineIndex).toBe(0);
    expect(rt.getDialoguePresentation()?.text).toBe('After inspect.');
  });

  test('hotspot-only action keeps session on same fragment via chronica-session', () => {
    const project = makeProject([
      {
        uid: 'f1',
        title: 'Room',
        locationId: 'room',
        priority: 0,
        conditions: [],
        effects: [],
        text: 'Room.',
        choices: [],
        hotspots: [inspectHotspot],
      },
    ]);

    const game = buildCompiledGame(project);
    const session = startSession(game);
    expect(session.fragment?.locationId).toBe('room');

    const after = activateHotspot(inspectHotspot, session.state, game);
    expect(after.fragment?.locationId).toBe('room');
    expect(session.state.variables.inspected).toBe(true);
    expect(after.visibleHotspots).toHaveLength(0);
  });
});
