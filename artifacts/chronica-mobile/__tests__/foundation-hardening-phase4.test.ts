import { applyAssetRecipe, planAssetRecipeApplication } from '../engine/asset-recipes';
import { validateAssetContracts, validateDuplicateAssetImport } from '../engine/asset-contracts';
import { compileProject } from '../engine/compiler';
import { buildCompiledGame } from '../engine/compiler/build-compiled-game';
import { assertDeterministicReplay, replayRuntimeInputs } from '../engine/deterministic-simulation';
import { validatePackageRoundTripContent, validateRepeatedCompileStability, validateRepeatedExportStability } from '../engine/package-contracts';
import { validateRecipeIdempotency } from '../engine/recipe-contracts';
import { generatePlayableRoomFromAssets } from '../engine/playable-room-generator';
import { compareGeneratedRoomSnapshots, snapshotGeneratedRoom, validateRoomGeneratorDeterminism } from '../engine/room-generator-contracts';
import { validateRuntimeContracts } from '../engine/runtime-contracts';
import { getHarborLanternAdventureProject } from '../demo/harbor-lantern-adventure';
import { ChronicaRuntime } from '../runtime/chronica-runtime';
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
    title: 'Contract Tale',
    description: '',
    startLocation: 'room',
    initialVariables: {},
    initialMemory: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    assets: [sampleAsset('lantern_pickup.png'), sampleAsset('forest_bg.jpg')],
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
      adventure: {
        entry: { default: { x: 0.2, y: 0.8 } },
        interactables: [],
      },
    }],
    ...overrides,
  };
}

describe('engine contracts phase 4', () => {
  describe('runtime contracts', () => {
    test('validateRuntimeContracts passes after start and transition', () => {
      const project = getHarborLanternAdventureProject();
      const compiled = compileProject(project);
      expect(compiled.ok).toBe(true);
      if (!compiled.ok) return;

      const runtime = new ChronicaRuntime(compiled.game);
      runtime.start();

      const initial = validateRuntimeContracts({
        game: compiled.game,
        started: runtime.isStarted,
        state: runtime.runtimeState,
        fragment: runtime.currentFragment,
        visibleChoiceUids: runtime.visibleChoices.map(choice => choice.uid),
        visibleHotspotUids: runtime.visibleHotspots.map(hotspot => hotspot.uid),
        visibleInteractableUids: runtime.visibleInteractables.map(item => item.uid),
        history: runtime.pathHistory,
      });
      expect(initial.ok).toBe(true);

      const lamplighter = runtime.visibleInteractables.find(item => item.uid === 'hl-dock-lamplighter');
      runtime.activateInteractable(lamplighter!);

      const afterInteract = validateRuntimeContracts({
        game: compiled.game,
        started: runtime.isStarted,
        state: runtime.runtimeState,
        fragment: runtime.currentFragment,
        visibleChoiceUids: runtime.visibleChoices.map(choice => choice.uid),
        visibleHotspotUids: runtime.visibleHotspots.map(hotspot => hotspot.uid),
        visibleInteractableUids: runtime.visibleInteractables.map(item => item.uid),
        history: runtime.pathHistory,
      });
      expect(afterInteract.ok).toBe(true);
    });
  });

  describe('deterministic simulation', () => {
    test('identical inputs produce identical runtime state', () => {
      const project = getHarborLanternAdventureProject();
      const result = assertDeterministicReplay(project, [
        { type: 'activateInteractable', interactableUid: 'hl-dock-lamplighter' },
      ]);
      expect(result.equal).toBe(true);
      expect(result.validation.ok).toBe(true);
    });

    test('replayRuntimeInputs is deterministic for movement', () => {
      const project = getHarborLanternAdventureProject();
      const game = buildCompiledGame(project);
      const a = replayRuntimeInputs(game, [{ type: 'movePlayer', dx: 0.2, dy: 0, seconds: 0.5 }]);
      const b = replayRuntimeInputs(game, [{ type: 'movePlayer', dx: 0.2, dy: 0, seconds: 0.5 }]);
      expect(JSON.stringify(a.runtimeState)).toBe(JSON.stringify(b.runtimeState));
    });
  });

  describe('asset contracts', () => {
    test('flags duplicate asset ids and duplicate names', () => {
      const project = makeProject({
        assets: [
          { ...sampleAsset('a.png'), id: 'dup-id' },
          { ...sampleAsset('b.png'), id: 'dup-id' },
          { ...sampleAsset('shared.png'), id: 'asset-1' },
          { ...sampleAsset('shared.png'), id: 'asset-2' },
        ],
      });
      const result = validateAssetContracts(project);
      expect(result.ok).toBe(false);
      expect(result.errors.some(error => error.code === 'duplicate-id')).toBe(true);
      expect(result.warnings.some(warning => warning.code === 'duplicate-name')).toBe(true);
    });

    test('duplicate import is reported predictably', () => {
      const project = makeProject();
      const asset = project.assets[0]!;
      const result = validateDuplicateAssetImport(project, { id: asset.id, name: asset.name });
      expect(result.warnings.some(warning => warning.code === 'duplicate-import')).toBe(true);
    });
  });

  describe('recipe contracts', () => {
    test('second make_pickup plan reports existing objects instead of silently duplicating', () => {
      const project = makeProject();
      const asset = project.assets.find(entry => entry.name === 'lantern_pickup.png')!;
      const first = applyAssetRecipe(project, asset.id, 'make_pickup', {
        createUid: () => '00000000-0000-4000-8000-000000000099',
      }).project;

      const secondPlan = planAssetRecipeApplication(first, asset.id, 'make_pickup');
      expect(secondPlan.conflicts.some(conflict => conflict.kind === 'duplicate-recipe-object')).toBe(true);
      expect(secondPlan.canApply).toBe(false);

      const validation = validateRecipeIdempotency(
        first,
        first.fragments[0]!,
        'make_pickup',
        asset,
        'Lantern Pickup',
      );
      expect(validation.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('room generator contracts', () => {
    test('repeated generation produces identical snapshots', () => {
      const assets = [
        sampleAsset('forest_bg.jpg'),
        sampleAsset('player_idle.png'),
        sampleAsset('npc_lamplighter.png'),
        sampleAsset('lantern_pickup.png'),
        sampleAsset('gate_locked.glb', 'model'),
        sampleAsset('forest_ambient.mp3', 'audio'),
      ];
      const project = makeProject({ assets, fragments: [] });
      const validation = validateRoomGeneratorDeterminism(project, {
        createNewScene: true,
        newSceneTitle: 'Demo Dock',
        createUid: () => '00000000-0000-4000-8000-000000000010',
        createActorUid: () => '00000000-0000-4000-8000-000000000011',
      });
      expect(validation.ok).toBe(true);

      const opts = {
        createNewScene: true,
        newSceneTitle: 'Demo Dock',
        createUid: () => '00000000-0000-4000-8000-000000000010',
        createActorUid: () => '00000000-0000-4000-8000-000000000011',
      };
      const first = generatePlayableRoomFromAssets(project, opts);
      const second = generatePlayableRoomFromAssets(project, opts);
      expect(
        compareGeneratedRoomSnapshots(
          snapshotGeneratedRoom(first.plan.patch!.fragment),
          snapshotGeneratedRoom(second.plan.patch!.fragment),
        ),
      ).toBe(true);
    });
  });

  describe('package contracts', () => {
    test('repeated compile is stable', () => {
      const project = getHarborLanternAdventureProject();
      expect(validateRepeatedCompileStability(project).ok).toBe(true);
    });

    test('repeated export planning is stable', () => {
      const project = getHarborLanternAdventureProject();
      expect(validateRepeatedExportStability(project).ok).toBe(true);
    });

    test('package round-trip preserves normalized story content', () => {
      const project = getHarborLanternAdventureProject();
      expect(validatePackageRoundTripContent(project).ok).toBe(true);
    });
  });
});
