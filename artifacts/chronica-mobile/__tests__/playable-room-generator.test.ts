import { compileProject } from '../engine/compiler';
import { getVisibleInteractables } from '../engine/adventure';
import {
  generatePlayableRoomFromAssets,
  planPlayableRoomFromAssets,
  selectPlayableRoomAssets,
} from '../engine/playable-room-generator';
import { ChronicaRuntime } from '../runtime/chronica-runtime';
import type { Project, ProjectAsset } from '../engine/types';

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

function fullAssetSet(): ProjectAsset[] {
  return [
    sampleAsset('forest_bg.jpg'),
    sampleAsset('player_idle.png'),
    sampleAsset('npc_lamplighter.png'),
    sampleAsset('lantern_pickup.png'),
    sampleAsset('gate_locked.glb', 'model'),
    sampleAsset('forest_ambient.mp3', 'audio'),
    sampleAsset('footstep_gravel.wav', 'audio'),
    sampleAsset('sfx_pickup.wav', 'audio'),
  ];
}

function makeProject(assets: ProjectAsset[], fragments: Project['fragments'] = []): Project {
  return {
    schemaVersion: 3,
    gameId: 'a0000001-0000-4000-8000-000000000099',
    id: 'p1',
    title: 'Room Tale',
    description: '',
    startLocation: fragments[0]?.locationId ?? 'generated_room',
    initialVariables: {},
    initialMemory: {},
    createdAt: '',
    updatedAt: '',
    assets,
    characters: [],
    fragments,
  };
}

describe('playable room asset selection', () => {
  test('selects classified assets for a full import set', () => {
    const project = makeProject(fullAssetSet());
    const selection = selectPlayableRoomAssets(project);
    expect(selection.background?.name).toBe('forest_bg.jpg');
    expect(selection.player?.name).toBe('player_idle.png');
    expect(selection.npc?.name).toBe('npc_lamplighter.png');
    expect(selection.pickup?.name).toBe('lantern_pickup.png');
    expect(selection.ambient?.name).toBe('forest_ambient.mp3');
    expect(selection.footstepSfx?.name).toBe('footstep_gravel.wav');
  });
});

describe('playable room planning', () => {
  test('plans a room with full asset set', () => {
    const project = makeProject(fullAssetSet());
    const plan = planPlayableRoomFromAssets(project, { createNewScene: true });
    expect(plan.ok).toBe(true);
    expect(plan.canApply).toBe(true);
    expect(plan.preview.some(line => line.category === 'NPC')).toBe(true);
    expect(plan.preview.some(line => line.category === 'Pickup')).toBe(true);
    expect(plan.preview.some(line => line.category === 'Gate')).toBe(true);
    expect(plan.patch?.fragment.adventure?.interactables?.length).toBeGreaterThanOrEqual(4);
  });

  test('plans a room with missing optional assets using placeholders', () => {
    const project = makeProject([sampleAsset('room.png')]);
    const plan = planPlayableRoomFromAssets(project, {
      createNewScene: true,
      includeAmbient: false,
      includeSfx: false,
    });
    expect(plan.ok).toBe(true);
    expect(plan.canApply).toBe(true);
    expect(plan.preview.some(line => line.summary.includes('placeholder'))).toBe(true);
    expect(plan.patch?.fragment.adventure?.interactables?.length).toBeGreaterThan(0);
  });

  test('does not overwrite existing adventure without confirmation', () => {
    const project = makeProject(fullAssetSet(), [{
      uid: 'f1',
      title: 'Existing',
      locationId: 'room',
      priority: 0,
      conditions: [],
      effects: [],
      text: 'Existing room.',
      choices: [],
      adventure: {
        entry: { default: { x: 0.5, y: 0.5 } },
        interactables: [{ uid: 'old', kind: 'trigger', label: 'Old', x: 0.5, y: 0.5, action: '', conditions: [] }],
      },
    }]);
    const blocked = planPlayableRoomFromAssets(project, { fragmentUid: 'f1' });
    expect(blocked.canApply).toBe(false);
    expect(blocked.conflicts.some(conflict => conflict.kind === 'overwrite-adventure')).toBe(true);

    const allowed = planPlayableRoomFromAssets(project, { fragmentUid: 'f1', confirmOverwrite: true });
    expect(allowed.canApply).toBe(true);
  });
});

describe('playable room generation', () => {
  test('generates an immediately playable room with locked gate flow', () => {
    const project = makeProject(fullAssetSet());
    const { project: nextProject, plan } = generatePlayableRoomFromAssets(project, {
      createNewScene: true,
      newSceneTitle: 'Demo Dock',
      setAsStartLocation: true,
    });

    const compiled = compileProject(nextProject);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const runtime = new ChronicaRuntime(compiled.game);
    runtime.start();
    expect(runtime.currentFragment?.locationId).toBe(plan.targetLocationId);

    const fragment = runtime.currentFragment!;
    const visible = getVisibleInteractables(fragment, runtime.runtimeState!);
    const roomSlug = plan.targetLocationId.replace(/[^a-z0-9_]+/gi, '_');
    const lockedGate = visible.find(item => item.uid.includes('locked_gate'));
    const pickup = visible.find(item => item.kind === 'pickup');
    expect(lockedGate).toBeTruthy();
    expect(pickup).toBeFalsy();

    const npc = visible.find(item => item.kind === 'npc');
    expect(npc).toBeTruthy();
    runtime.activateInteractable(npc!);
    const afterTalk = getVisibleInteractables(fragment, runtime.runtimeState!);
    expect(afterTalk.find(item => item.kind === 'pickup')).toBeTruthy();

    const pickupItem = afterTalk.find(item => item.kind === 'pickup')!;
    runtime.activateInteractable(pickupItem);
    const afterPickup = getVisibleInteractables(fragment, runtime.runtimeState!);
    expect(afterPickup.find(item => item.uid.includes('locked_gate'))).toBeFalsy();
    expect(afterPickup.find(item => item.uid.includes('open_gate'))).toBeTruthy();
  });

  test('generate throws when overwrite confirmation is missing', () => {
    const project = makeProject(fullAssetSet(), [{
      uid: 'f1',
      title: 'Existing',
      locationId: 'room',
      priority: 0,
      conditions: [],
      effects: [],
      text: 'Existing room.',
      choices: [],
      adventure: {
        entry: { default: { x: 0.5, y: 0.5 } },
        interactables: [{ uid: 'old', kind: 'trigger', label: 'Old', x: 0.5, y: 0.5, action: '', conditions: [] }],
      },
    }]);
    expect(() => generatePlayableRoomFromAssets(project, { fragmentUid: 'f1' })).toThrow(/Overwrite confirmation required/);
  });
});
