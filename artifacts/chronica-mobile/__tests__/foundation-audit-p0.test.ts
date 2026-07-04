import { applyRecipeMutation, executeApplyRecipeTransaction, executeGenerateRoomTransaction } from '../engine/editor-mutations';
import { runEditorTransaction } from '../engine/editor-transactions';
import { buildMissingAssetIssue, resolveValidationSeverity } from '../engine/validation-severity';
import { findMissingAssetReferences } from '../engine/asset-reference-safety';
import { validateProjectAssets } from '../engine/model-assets';
import { validateProject } from '../engine/validator';
import type { Fragment, Project, ProjectAsset } from '../engine/types';

function sampleAsset(name: string): ProjectAsset {
  return {
    id: `asset-${name}`,
    name,
    type: 'image',
    uri: `file:///device/${name}`,
    mimeType: 'image/png',
    size: 1024,
    importedAt: '',
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    schemaVersion: 3,
    gameId: 'a0000001-0000-4000-8000-000000000099',
    id: 'p1',
    title: 'P0 Tale',
    description: '',
    startLocation: 'room',
    initialVariables: {},
    initialMemory: {},
    createdAt: '',
    updatedAt: '',
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

describe('foundation audit P0 follow-up', () => {
  test('recipe transaction commits one atomic project snapshot', () => {
    const project = makeProject();
    const asset = project.assets.find(entry => entry.name === 'lantern_pickup.png')!;
    const result = executeApplyRecipeTransaction(project, asset.id, 'make_pickup', {
      createUid: () => '00000000-0000-4000-8000-000000000099',
    });

    expect(result.transaction.ok).toBe(true);
    expect(result.transaction.after!.inventory?.length).toBe(1);
    expect(result.transaction.after!.fragments[0]!.hotspots?.length).toBe(1);
    expect(result.transaction.after!.fragments.length).toBe(project.fragments.length);
  });

  test('room generation transaction commits new scene atomically', () => {
    const assets = [
      sampleAsset('forest_bg.jpg'),
      sampleAsset('player_idle.png'),
      sampleAsset('npc_lamplighter.png'),
      sampleAsset('lantern_pickup.png'),
      sampleAsset('gate_locked.glb'),
      sampleAsset('forest_ambient.mp3'),
    ];
    const project = makeProject({ assets, fragments: [] });
    const result = executeGenerateRoomTransaction(project, {
      createNewScene: true,
      newSceneTitle: 'Demo Dock',
      createUid: () => '00000000-0000-4000-8000-000000000010',
      createActorUid: () => '00000000-0000-4000-8000-000000000011',
    });

    expect(result.transaction.ok).toBe(true);
    expect(result.transaction.after!.fragments.length).toBe(1);
    expect(result.transaction.after!.fragments[0]!.adventure?.interactables?.length).toBeGreaterThan(0);
  });

  test('failed recipe transaction does not mutate project', () => {
    const project = makeProject({ fragments: [] });
    const asset = project.assets[0]!;
    const result = runEditorTransaction(project, applyRecipeMutation(asset.id, 'make_pickup'));

    expect(result.ok).toBe(false);
    expect(result.after).toBeNull();
    expect(result.diagnosticReport).not.toBeNull();
    expect(project.fragments).toHaveLength(0);
  });

  test('missing preview asset is warning across validators', () => {
    const project = makeProject({
      assets: [
        {
          ...sampleAsset('Lantern.glb'),
          type: 'model',
          mimeType: 'model/gltf-binary',
          previewImageAssetId: 'missing-preview',
        },
      ],
    });

    const fromRefs = findMissingAssetReferences(project);
    const fromAssets = validateProjectAssets(project);
    const previewRef = fromRefs.find(item => item.message.includes('previewImageAssetId'));
    const previewAsset = fromAssets.find(item => item.message.includes('preview'));

    expect(previewRef?.severity).toBe('warning');
    expect(previewAsset?.severity).toBe('warning');
    expect(resolveValidationSeverity(previewRef!)).toBe('warning');
  });

  test('optional sprite missing asset is warning in unified severity', () => {
    const issue = buildMissingAssetIssue(
      { fragmentUid: 'f1', fragmentTitle: 'Room' },
      'Adventure interactable "Lantern" sprite "missing.png" is missing',
    );
    expect(issue.severity).toBe('warning');
    expect(resolveValidationSeverity(issue, { strictValidation: true })).toBe('warning');
  });

  test('background image missing remains warning in default compile path', () => {
    const project = makeProject({
      fragments: [{
        ...(makeProject().fragments[0] as Fragment),
        backgroundImage: 'missing_bg.jpg',
      }],
    });
    project.startLocation = 'room';

    const errors = validateProject(project);
    const missingBg = errors.find(item => item.message.includes('Background image'));
    expect(missingBg?.severity).toBe('warning');
    expect(resolveValidationSeverity(missingBg!)).toBe('warning');
  });
});
