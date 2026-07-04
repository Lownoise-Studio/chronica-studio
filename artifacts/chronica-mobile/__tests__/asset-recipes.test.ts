import { compileProject } from '../engine/compiler';
import {
  applyAssetRecipe,
  planAssetRecipeApplication,
  readableAssetLabel,
} from '../engine/asset-recipes';
import type { Project, ProjectAsset } from '../engine/types';

const ACTOR_UID = '00000000-0000-4000-8000-000000000099';
const STAGE_UID = '00000000-0000-4000-8000-000000000098';
const HOTSPOT_UID = '00000000-0000-4000-8000-000000000097';

function sampleAsset(name: string, type: ProjectAsset['type'] = 'image'): ProjectAsset {
  const ext = name.split('.').pop() ?? 'png';
  return {
    id: `asset-${name}`,
    name,
    type,
    uri: `file:///device/${name}`,
    mimeType: type === 'audio' ? 'audio/mpeg' : type === 'model' ? 'model/gltf-binary' : `image/${ext}`,
    size: 1024,
    importedAt: '',
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    schemaVersion: 3,
    gameId: 'a0000001-0000-4000-8000-000000000099',
    id: 'p1',
    title: 'Recipe Tale',
    description: '',
    startLocation: 'room',
    initialVariables: {},
    initialMemory: {},
    createdAt: '',
    updatedAt: '',
    assets: [
      sampleAsset('lantern_pickup.png'),
      sampleAsset('door_wood.glb', 'model'),
      sampleAsset('npc_lamplighter.png'),
      sampleAsset('forest_bg.jpg'),
      sampleAsset('forest_ambient.mp3', 'audio'),
      sampleAsset('footstep_gravel.wav', 'audio'),
    ],
    characters: [],
    fragments: [{
      uid: 'f1',
      title: 'Room',
      locationId: 'room',
      priority: 0,
      conditions: [],
      effects: [],
      text: 'A room.',
      choices: [],
    }],
    ...overrides,
  };
}

describe('asset recipe planning', () => {
  test('make_pickup plan includes inventory, hotspot, and stage object preview', () => {
    const project = makeProject();
    const asset = project.assets.find(entry => entry.name === 'lantern_pickup.png')!;
    const plan = planAssetRecipeApplication(project, asset.id, 'make_pickup');

    expect(plan.ok).toBe(true);
    expect(plan.canApply).toBe(true);
    expect(plan.preview.some(line => line.category === 'Inventory')).toBe(true);
    expect(plan.preview.some(line => line.category === 'Hotspot')).toBe(true);
    expect(plan.preview.some(line => line.category === 'Stage object')).toBe(true);
    expect(plan.patch?.fragment.hotspots?.length).toBe(1);
    expect(plan.patch?.catalog.inventory?.length).toBe(1);
  });

  test('make_door plan creates unlocked door placeholder', () => {
    const project = makeProject();
    const asset = project.assets.find(entry => entry.name === 'door_wood.glb')!;
    const plan = planAssetRecipeApplication(project, asset.id, 'make_door');

    expect(plan.ok).toBe(true);
    expect(plan.preview.some(line => line.summary.includes('unlocked'))).toBe(true);
    expect(plan.patch?.fragment.hotspots?.[0]?.interactionKind).toBe('trigger');
  });

  test('make_npc plan includes dialogue hook and NPC profile', () => {
    const project = makeProject();
    const asset = project.assets.find(entry => entry.name === 'npc_lamplighter.png')!;
    const plan = planAssetRecipeApplication(project, asset.id, 'make_npc', {
      createActorUid: () => ACTOR_UID,
    });

    expect(plan.ok).toBe(true);
    expect(plan.patch?.catalog.npcProfiles?.length).toBe(1);
    expect(plan.patch?.fragment.stageActors?.length).toBe(1);
    expect(plan.preview.some(line => line.category === 'Dialogue hook')).toBe(true);
  });

  test('make_background blocks overwrite without confirmation', () => {
    const project = makeProject({
      fragments: [{
        uid: 'f1',
        title: 'Room',
        locationId: 'room',
        priority: 0,
        conditions: [],
        effects: [],
        text: 'A room.',
        choices: [],
        backgroundImage: 'existing.jpg',
      }],
    });
    const asset = project.assets.find(entry => entry.name === 'forest_bg.jpg')!;
    const blocked = planAssetRecipeApplication(project, asset.id, 'make_background');
    expect(blocked.canApply).toBe(false);
    expect(blocked.conflicts.some(conflict => conflict.kind === 'overwrite-background-image')).toBe(true);

    const allowed = planAssetRecipeApplication(project, asset.id, 'make_background', { confirmOverwrite: true });
    expect(allowed.canApply).toBe(true);
    expect(allowed.patch?.fragment.backgroundImage).toBe('forest_bg.jpg');
  });

  test('make_ambient assigns backgroundAudio', () => {
    const project = makeProject();
    const asset = project.assets.find(entry => entry.name === 'forest_ambient.mp3')!;
    const plan = planAssetRecipeApplication(project, asset.id, 'make_ambient');
    expect(plan.patch?.fragment.backgroundAudio).toBe('forest_ambient.mp3');
  });

  test('low-confidence assets require manual confirmation', () => {
    const project = makeProject({
      assets: [sampleAsset('IMG_0001.png')],
    });
    const asset = project.assets[0]!;
    const blocked = planAssetRecipeApplication(project, asset.id, 'make_ui');
    expect(blocked.requiresManualConfirmation).toBe(true);
    expect(blocked.canApply).toBe(false);

    const allowed = planAssetRecipeApplication(project, asset.id, 'make_ui', {
      confirmLowConfidence: true,
      createUid: () => STAGE_UID,
    });
    expect(allowed.canApply).toBe(true);
  });
});

describe('asset recipe application', () => {
  test('applying pickup adds catalog entries and scene objects', () => {
    const project = makeProject();
    const asset = project.assets.find(entry => entry.name === 'lantern_pickup.png')!;
    const result = applyAssetRecipe(project, asset.id, 'make_pickup', {
      createUid: () => HOTSPOT_UID,
      createActorUid: () => ACTOR_UID,
    });

    expect(result.project.inventory?.some(item => item.assetName === asset.name)).toBe(true);
    const fragment = result.project.fragments[0]!;
    expect(fragment.hotspots?.length).toBe(1);
    expect(fragment.stageAuthoring?.objects.some(object => object.asset === asset.name)).toBe(true);
    expect(readableAssetLabel(asset)).toBe('Lantern Pickup');
  });

  test('applying pickup to adventure scene adds interactable', () => {
    const project = makeProject({
      fragments: [{
        uid: 'f1',
        title: 'Dock',
        locationId: 'room',
        priority: 0,
        conditions: [],
        effects: [],
        text: '',
        choices: [],
        adventure: {
          entry: { default: { x: 0.5, y: 0.75 } },
          interactables: [],
        },
      }],
    });
    const asset = project.assets.find(entry => entry.name === 'lantern_pickup.png')!;
    const result = applyAssetRecipe(project, asset.id, 'make_pickup', {
      createUid: () => HOTSPOT_UID,
    });
    expect(result.project.fragments[0]?.adventure?.interactables?.some(item => item.kind === 'pickup')).toBe(true);
  });

  test('apply does not overwrite background without confirmation', () => {
    const project = makeProject({
      fragments: [{
        uid: 'f1',
        title: 'Room',
        locationId: 'room',
        priority: 0,
        conditions: [],
        effects: [],
        text: 'A room.',
        choices: [],
        backgroundImage: 'existing.jpg',
      }],
    });
    const asset = project.assets.find(entry => entry.name === 'forest_bg.jpg')!;
    expect(() => applyAssetRecipe(project, asset.id, 'make_background')).toThrow(/Overwrite confirmation required/);
  });

  test('runtime compile output changes only when adventure/scene fields are authored', () => {
    const project = makeProject();
    const beforeResult = compileProject(project);
    expect(beforeResult.ok).toBe(true);
    if (!beforeResult.ok) return;

    const asset = project.assets.find(entry => entry.name === 'lantern_pickup.png')!;
    const afterProject = applyAssetRecipe(project, asset.id, 'make_pickup', {
      createUid: () => HOTSPOT_UID,
      createActorUid: () => ACTOR_UID,
    }).project;
    const afterResult = compileProject(afterProject);
    expect(afterResult.ok).toBe(true);
    if (!afterResult.ok) return;

    expect(afterResult.game.fragments[0]?.hotspots?.length).toBeGreaterThan(
      beforeResult.game.fragments[0]?.hotspots?.length ?? 0,
    );
  });
});
