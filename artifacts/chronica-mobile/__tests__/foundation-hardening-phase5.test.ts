import {
  addAssetsBatchMutation,
  applyRecipeMutation,
  createInteractableMutation,
  deleteAssetMutation,
  EDITOR_MUTATION_CONTRACTS,
  executeSafeAssetDelete,
  generateRoomMutation,
  getAssetDeleteImpact,
  moveStageObjectMutation,
  renameAssetMutation,
  updateFragmentMutation,
  updateProjectMutation,
} from '../engine/editor-mutations';
import {
  computeEditorChangeSet,
  projectsStructurallyEqual,
  replayInverseTransaction,
  runEditorTransaction,
  runEditorTransactionBatch,
  verifyTransactionUndo,
} from '../engine/editor-transactions';
import type { Fragment, Project, ProjectAsset } from '../engine/types';

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
    title: 'Transaction Tale',
    description: '',
    startLocation: 'room',
    initialVariables: {},
    initialMemory: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    assets: [
      sampleAsset('Lantern.glb', 'model'),
      sampleAsset('forest_bg.jpg'),
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
      backgroundImage: 'forest_bg.jpg',
      stageAuthoring: {
        objects: [{
          uid: 'obj1',
          asset: 'Lantern.glb',
          x: 0.5,
          y: 0.5,
          layer: 'props',
        }],
      },
      adventure: {
        entry: { default: { x: 0.2, y: 0.8 } },
        interactables: [],
      },
    }],
    ...overrides,
  };
}

describe('foundation hardening phase 5 — editor transactions', () => {
  test('mutation contracts are documented for all editor actions', () => {
    expect(Object.keys(EDITOR_MUTATION_CONTRACTS)).toEqual(expect.arrayContaining([
      'rename-asset',
      'delete-asset',
      'apply-recipe',
      'generate-room',
      'update-fragment',
      'update-project',
      'move-stage-object',
      'create-interactable',
      'add-assets-batch',
    ]));
  });

  test('failed delete transaction rolls back when references exist', () => {
    const project = makeProject();
    const asset = project.assets.find(entry => entry.name === 'Lantern.glb')!;
    const impact = getAssetDeleteImpact(project, asset.id);

    expect(impact.blocked).toBe(true);
    expect(impact.referencePaths.length).toBeGreaterThan(0);

    const result = runEditorTransaction(project, deleteAssetMutation(asset.id));
    expect(result.ok).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.after).toBeNull();
    expect(result.diagnostics.some(item => item.code === 'referenced-asset')).toBe(true);
    expect(project.assets).toHaveLength(2);
  });

  test('safe delete executes when no references remain', () => {
    const project = makeProject({
      fragments: [{
        ...makeProject().fragments[0]!,
        backgroundImage: undefined,
        stageAuthoring: { objects: [] },
      }],
    });
    const asset = project.assets.find(entry => entry.name === 'Lantern.glb')!;
    const { transaction } = executeSafeAssetDelete(project, asset.id);

    expect(transaction.ok).toBe(true);
    expect(transaction.after!.assets.some(entry => entry.id === asset.id)).toBe(false);
  });

  test('rename preserves asset id and rewrites name-based references', () => {
    const project = makeProject();
    const asset = project.assets.find(entry => entry.name === 'Lantern.glb')!;
    const result = runEditorTransaction(project, renameAssetMutation(asset.id, 'Temple Lantern.glb'));

    expect(result.ok).toBe(true);
    const renamed = result.after!.assets.find(entry => entry.id === asset.id)!;
    expect(renamed.id).toBe(asset.id);
    expect(renamed.name).toBe('Temple Lantern.glb');
    expect(result.after!.fragments[0]!.stageAuthoring?.objects?.[0]?.asset).toBe('Temple Lantern.glb');
  });

  test('rename fails on duplicate display name', () => {
    const project = makeProject();
    const asset = project.assets.find(entry => entry.name === 'Lantern.glb')!;
    const result = runEditorTransaction(project, renameAssetMutation(asset.id, 'forest_bg.jpg'));

    expect(result.ok).toBe(false);
    expect(result.diagnostics.some(item => item.code === 'duplicate-name')).toBe(true);
  });

  test('batch import applies atomically and rolls back on duplicate batch id', () => {
    const project = makeProject({ assets: [] });
    const incoming = [
      sampleAsset('one.png'),
      { ...sampleAsset('two.png'), id: sampleAsset('one.png').id },
    ];

    const result = runEditorTransactionBatch(project, [addAssetsBatchMutation(incoming)], {
      label: 'Import batch',
    });

    expect(result.ok).toBe(false);
    expect(result.after).toBeNull();
    expect(project.assets).toHaveLength(0);
  });

  test('batch import commits all assets on success', () => {
    const project = makeProject({ assets: [] });
    const incoming = [sampleAsset('one.png'), sampleAsset('two.png')];
    const result = runEditorTransactionBatch(project, [addAssetsBatchMutation(incoming)]);

    expect(result.ok).toBe(true);
    expect(result.after!.assets).toHaveLength(2);
    expect(result.changeSet?.domains).toContain('assets');
  });

  test('nested validation stops batch before any mutation applies', () => {
    const project = makeProject({ assets: [] });
    const result = runEditorTransactionBatch(project, [
      addAssetsBatchMutation([sampleAsset('ok.png')]),
      deleteAssetMutation('missing-asset'),
    ]);

    expect(result.ok).toBe(false);
    expect(result.status).toBe('failed');
    expect(project.assets).toHaveLength(0);
  });

  test('dirty-state change set reports touched domains', () => {
    const project = makeProject();
    const result = runEditorTransaction(project, updateProjectMutation({ title: 'Renamed Tale' }));
    expect(result.ok).toBe(true);

    const changeSet = computeEditorChangeSet(project, result.after!);
    expect(changeSet.domains).toContain('settings');
    expect(changeSet.changedFields).toContain('title');
  });

  test('updateFragment mutation commits scene changes', () => {
    const project = makeProject();
    const result = runEditorTransaction(
      project,
      updateFragmentMutation('f1', { text: 'Updated room copy.' }),
    );

    expect(result.ok).toBe(true);
    expect(result.after!.fragments[0]!.text).toBe('Updated room copy.');
    expect(result.changeSet?.domains).toContain('scenes');
  });

  test('moveStageObject mutation updates coordinates', () => {
    const project = makeProject();
    const before = project.fragments[0]!.stageAuthoring!.objects![0]!;
    const result = runEditorTransaction(
      project,
      moveStageObjectMutation('f1', 'obj1', 0.1, -0.05),
    );

    expect(result.ok).toBe(true);
    const after = result.after!.fragments[0]!.stageAuthoring!.objects![0]!;
    expect(after.x).toBeGreaterThan(before.x);
    expect(after.y).toBeLessThan(before.y);
  });

  test('createInteractable mutation appends adventure object', () => {
    const project = makeProject();
    const result = runEditorTransaction(project, createInteractableMutation('f1', {
      uid: 'int_pickup',
      kind: 'pickup',
      label: 'Lantern',
      x: 0.4,
      y: 0.6,
      action: 'pickup:lantern',
      conditions: [],
      sprite: 'Lantern.glb',
    }));

    expect(result.ok).toBe(true);
    const interactables = result.after!.fragments[0]!.adventure!.interactables!;
    expect(interactables.some(item => item.uid === 'int_pickup')).toBe(true);
    expect(result.changeSet?.domains).toContain('adventure');
  });

  test('applyRecipe mutation is atomic', () => {
    const project = makeProject({
      assets: [sampleAsset('lantern_pickup.png'), ...makeProject().assets.slice(1)],
    });
    const asset = project.assets.find(entry => entry.name === 'lantern_pickup.png')!;
    const result = runEditorTransaction(project, applyRecipeMutation(asset.id, 'make_pickup', {
      createUid: () => '00000000-0000-4000-8000-000000000099',
    }));

    expect(result.ok).toBe(true);
    expect(result.after!.inventory?.length).toBe(1);
    expect(result.after!.fragments[0]!.hotspots?.length).toBe(1);
  });

  test('generateRoom mutation commits new scene atomically', () => {
    const assets = [
      sampleAsset('forest_bg.jpg'),
      sampleAsset('player_idle.png'),
      sampleAsset('npc_lamplighter.png'),
      sampleAsset('lantern_pickup.png'),
      sampleAsset('gate_locked.glb', 'model'),
      sampleAsset('forest_ambient.mp3', 'audio'),
    ];
    const project = makeProject({ assets, fragments: [] });
    const result = runEditorTransaction(project, generateRoomMutation({
      createNewScene: true,
      newSceneTitle: 'Demo Dock',
      createUid: () => '00000000-0000-4000-8000-000000000010',
      createActorUid: () => '00000000-0000-4000-8000-000000000011',
    }));

    expect(result.ok).toBe(true);
    expect(result.after!.fragments.length).toBe(1);
    expect(result.after!.fragments[0]!.adventure?.interactables?.length).toBeGreaterThan(0);
  });

  test('undo foundation restores original project via inverse replay', () => {
    const project = makeProject();
    const forward = runEditorTransaction(project, updateProjectMutation({ title: 'Changed' }));
    expect(forward.ok).toBe(true);

    const undo = replayInverseTransaction(forward.after!, forward);
    expect(undo.ok).toBe(true);
    expect(verifyTransactionUndo(project, undo)).toBe(true);
    expect(projectsStructurallyEqual(project, undo.after!)).toBe(true);
  });

  test('transaction replay after rename round-trips references', () => {
    const project = makeProject();
    const asset = project.assets.find(entry => entry.name === 'Lantern.glb')!;
    const forward = runEditorTransaction(project, renameAssetMutation(asset.id, 'Temple Lantern.glb'));
    const undo = replayInverseTransaction(forward.after!, forward);

    expect(verifyTransactionUndo(project, undo)).toBe(true);
    expect(undo.after!.fragments[0]!.stageAuthoring?.objects?.[0]?.asset).toBe('Lantern.glb');
  });
});
