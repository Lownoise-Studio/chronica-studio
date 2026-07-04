import { compileProject } from '../engine/compiler';
import { deserializeState, serializeState } from '../engine/chronica-session';
import { generatePlayableRoomFromAssets } from '../engine/playable-room-generator';
import { ChronicaRuntime } from '../runtime/chronica-runtime';
import type { ChronicaState, Fragment, Project, ProjectAsset } from '../engine/types';

function sampleAsset(name: string, type: ProjectAsset['type'] = 'image'): ProjectAsset {
  const ext = name.split('.').pop() ?? 'png';
  return {
    id: `asset-${name}`,
    name,
    type,
    uri: `file:///device/${name}`,
    mimeType: type === 'audio' ? 'audio/mpeg' : type === 'model' ? 'model/gltf-binary' : `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    size: 1024,
    importedAt: '',
  };
}

function legacyState(): Record<string, unknown> {
  return {
    location: 'intro',
    instability: 0,
    reality_layer: 0,
    memory: {},
    variables: { trust: 2 },
    dialogueLineIndex: 0,
  };
}

function makeLegacyProject(): Project {
  return {
    schemaVersion: 2,
    gameId: 'a0000001-0000-4000-8000-000000000099',
    id: 'legacy',
    title: 'Legacy Tale',
    description: '',
    startLocation: 'intro',
    initialVariables: {},
    initialMemory: {},
    createdAt: '',
    updatedAt: '',
    assets: [],
    characters: [],
    fragments: [{
      uid: 'f1',
      title: 'Intro',
      locationId: 'intro',
      priority: 0,
      conditions: [],
      effects: [],
      text: 'Legacy scene without adventure metadata.',
      choices: [],
    } satisfies Fragment],
  };
}

describe('foundation save regression', () => {
  test('deserializeState accepts saves without adventure player fields', () => {
    const state = deserializeState(legacyState());
    expect(state).not.toBeNull();
    expect(state?.playerX).toBeUndefined();
    expect(state?.playerY).toBeUndefined();
    expect(state?.lastLocationId).toBeUndefined();
    expect(state?.location).toBe('intro');
  });

  test('serializeState round-trips adventure player fields', () => {
    const state: ChronicaState = {
      location: 'room',
      instability: 0,
      reality_layer: 0,
      memory: {},
      variables: {},
      dialogueLineIndex: 0,
      playerX: 0.22,
      playerY: 0.71,
      lastLocationId: 'previous-room',
    };
    const parsed = deserializeState(JSON.parse(serializeState(state)));
    expect(parsed?.playerX).toBeCloseTo(0.22);
    expect(parsed?.playerY).toBeCloseTo(0.71);
    expect(parsed?.lastLocationId).toBe('previous-room');
  });

  test('generated adventure scenes preserve player position through runtime save/load', () => {
    const project = {
      schemaVersion: 3 as const,
      gameId: 'a0000001-0000-4000-8000-000000000099',
      id: 'p1',
      title: 'Room Tale',
      description: '',
      startLocation: 'generated_room',
      initialVariables: {},
      initialMemory: {},
      createdAt: '',
      updatedAt: '',
      assets: [
        sampleAsset('forest_bg.jpg'),
        sampleAsset('player_idle.png'),
        sampleAsset('npc_lamplighter.png'),
        sampleAsset('lantern_pickup.png'),
        sampleAsset('gate_locked.glb', 'model'),
        sampleAsset('forest_ambient.mp3', 'audio'),
        sampleAsset('footstep_gravel.wav', 'audio'),
        sampleAsset('sfx_pickup.wav', 'audio'),
      ],
      characters: [],
      fragments: [],
    };
    const generated = generatePlayableRoomFromAssets(project, {
      createNewScene: true,
      newSceneTitle: 'Demo Dock',
      setAsStartLocation: true,
    }).project;

    const compiled = compileProject(generated);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const runtime = new ChronicaRuntime(compiled.game);
    runtime.start();
    runtime.setRuntimeState({
      ...runtime.runtimeState!,
      playerX: 0.41,
      playerY: 0.63,
      lastLocationId: 'other-room',
    });

    const save = runtime.toSave('p1');
    expect(save).not.toBeNull();
    expect(save?.state.playerX).toBeCloseTo(0.41);
    expect(save?.state.playerY).toBeCloseTo(0.63);
    expect(save?.state.lastLocationId).toBe('other-room');

    const restored = new ChronicaRuntime(compiled.game);
    expect(restored.tryResume(save!)).toEqual({ ok: true });
    expect(restored.runtimeState?.playerX).toBeCloseTo(0.41);
    expect(restored.runtimeState?.playerY).toBeCloseTo(0.63);
    expect(restored.runtimeState?.lastLocationId).toBe('other-room');
  });

  test('legacy project still compiles without adventure fields', () => {
    const result = compileProject(makeLegacyProject());
    expect(result.ok).toBe(true);
  });
});
