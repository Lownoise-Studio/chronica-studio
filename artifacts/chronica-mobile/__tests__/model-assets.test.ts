import { compileProject } from '../engine/compiler';
import { buildCompiledGame, computeProjectContentHash, fragmentForRuntimeCompile } from '../engine/compiler/build-compiled-game';
import {
  collectPackageAssetNames,
  findDuplicateAssetIds,
  findMissingStageObjectAssetRefs,
  findUnsupportedAssetFieldWarnings,
  getModelAssetLibraryMessages,
  modelAssetHasPreview,
  packageModelAssetPath,
  packagePathForAsset,
  suggestedPreviewImageName,
  validateModelAssetsInLibrary,
} from '../engine/model-assets';
import { resolveStageObjectPresentationUri } from '../engine/asset-resolver';
import {
  buildPackageStory,
  hydrateImportedPackageProject,
  planChronicaPackage,
} from '../engine/chronica-package';
import { validateProject } from '../engine/validator';
import {
  collectImportableAssetsFromZipMap,
  inferAssetTypeFromFilename,
  planProjectAssetsFromImport,
} from '../storage/asset-import';
import { insertStageObjectFromAsset } from '../engine/stage-placement';
import type { Fragment, Project, StageObject } from '../engine/types';

const GLB_BYTES = new Uint8Array([0x67, 0x6c, 0x54, 0x46]);
const GLTF_BYTES = new Uint8Array([0x7b, 0x22, 0x61, 0x73]);

function makeProject(fragment: Partial<Fragment> = {}, assets: Project['assets'] = []): Project {
  const baseAssets = assets.length ? assets : [{
    id: 'img1',
    name: 'prop.png',
    type: 'image' as const,
    uri: 'file:///device/prop.png',
    mimeType: 'image/png',
    size: 100,
    importedAt: '',
  }];
  return {
    schemaVersion: 3,
    gameId: 'a0000001-0000-4000-8000-000000000099',
    id: 'p1',
    title: 'Model Tale',
    description: '',
    startLocation: 'room',
    initialVariables: {},
    initialMemory: {},
    createdAt: '',
    updatedAt: '',
    assets: baseAssets,
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
      backgroundImage: 'prop.png',
      ...fragment,
    }],
  };
}

function sampleModelAsset(overrides: Partial<Project['assets'][number]> = {}) {
  return {
    id: 'm1',
    name: 'chest.glb',
    type: 'model' as const,
    uri: 'file:///device/chest.glb',
    mimeType: 'model/gltf-binary',
    size: 4096,
    importedAt: '2026-01-01T00:00:00.000Z',
    source: 'In-house',
    license: 'CC0',
    ...overrides,
  };
}

describe('portable 3D model assets', () => {
  test('GLB asset accepted on import', () => {
    expect(inferAssetTypeFromFilename('chest.glb')).toBe('model');
    const plan = collectImportableAssetsFromZipMap({ 'models/chest.glb': GLB_BYTES });
    expect(plan.files).toHaveLength(1);
    expect(plan.files[0]?.mimeType).toBe('model/gltf-binary');
    const { assets } = planProjectAssetsFromImport(plan.files, [], () => 'id1');
    expect(assets[0]?.type).toBe('model');
  });

  test('GLTF asset accepted on import', () => {
    expect(inferAssetTypeFromFilename('prop.gltf')).toBe('model');
    const plan = collectImportableAssetsFromZipMap({ 'prop.gltf': GLTF_BYTES });
    expect(plan.files[0]?.mimeType).toBe('model/gltf+json');
  });

  test('package export includes model asset under assets/models/', () => {
    const model = sampleModelAsset();
    const project = makeProject({
      stageAuthoring: {
        objects: [{
          uid: 'obj1',
          label: 'Chest',
          asset: 'chest.glb',
          x: 0.5,
          y: 0.5,
          layer: 'props',
        }],
      },
    }, [model, ...makeProject().assets]);
    const plan = planChronicaPackage(project, () => true, '2026-06-22T12:00:00.000Z');
    expect(plan.missingAssets).toHaveLength(0);
    expect(plan.assetFiles.some(f => f.packagePath === 'assets/models/chest.glb')).toBe(true);
    expect(packagePathForAsset(model)).toBe('assets/models/chest.glb');
    expect(packageModelAssetPath('chest.glb')).toBe('assets/models/chest.glb');
  });

  test('package import preserves model metadata', () => {
    const model = sampleModelAsset({ uri: 'assets/models/chest.glb' });
    const project = makeProject({}, [model]);
    const packaged = buildPackageStory(project, [{
      packagePath: 'assets/models/chest.glb',
      asset: model,
      sourceUri: 'file:///device/chest.glb',
    }]);
    const hydrated = hydrateImportedPackageProject(packaged, {
      'assets/models/chest.glb': 'file:///imported/chest.glb',
    });
    const restored = hydrated.assets.find(a => a.name === 'chest.glb');
    expect(restored?.type).toBe('model');
    expect(restored?.mimeType).toBe('model/gltf-binary');
    expect(restored?.source).toBe('In-house');
    expect(restored?.license).toBe('CC0');
    expect(restored?.uri).toBe('file:///imported/chest.glb');
  });

  test('StageObject can reference model asset with placeholder presentation', () => {
    const model = sampleModelAsset();
    const preview = {
      id: 'img1',
      name: 'prop.png',
      type: 'image' as const,
      uri: 'file:///device/prop.png',
      mimeType: 'image/png',
      size: 1,
      importedAt: '',
    };
    const withPreview = { ...model, previewImageAssetId: 'img1' };
    const project = makeProject({
      stageAuthoring: {
        objects: [{
          uid: 'obj1',
          label: 'Chest',
          asset: 'chest.glb',
          x: 0.5,
          y: 0.5,
          layer: 'props',
        }],
      },
    }, [withPreview, preview]);

    const { object } = insertStageObjectFromAsset(undefined, { name: 'chest.glb', type: 'model' }, {
      createUid: () => 'obj2',
    });
    expect(object.asset).toBe('chest.glb');

    const presentation = resolveStageObjectPresentationUri(project.assets, 'chest.glb');
    expect(presentation?.kind).toBe('model');
    if (presentation?.kind === 'model') {
      expect(presentation.previewUri).toBe('file:///device/prop.png');
    }
    expect(collectPackageAssetNames(project)).toContain('chest.glb');
  });

  test('missing model reference reports validation issue', () => {
    const project = makeProject({
      stageAuthoring: {
        objects: [{
          uid: 'obj1',
          label: 'Missing prop',
          asset: 'missing.glb',
          x: 0.5,
          y: 0.5,
          layer: 'props',
        }],
      },
    });
    const errors = findMissingStageObjectAssetRefs(project);
    expect(errors.some(e => e.message.includes('missing.glb'))).toBe(true);
    expect(validateProject(project).some(e => e.message.includes('missing.glb'))).toBe(true);
  });

  test('duplicate asset ids are flagged', () => {
    const duplicates = findDuplicateAssetIds([
      sampleModelAsset({ id: 'dup' }),
      { ...sampleModelAsset({ id: 'dup', name: 'other.glb' }) },
    ]);
    expect(duplicates).toContain('dup');
  });

  test('unsupported source-specific fields are warned', () => {
    const warnings = findUnsupportedAssetFieldWarnings([
      { name: 'chest.glb', type: 'model', meshyId: 'abc', unityGuid: 'xyz' },
    ]);
    expect(warnings.map(w => w.field)).toEqual(expect.arrayContaining(['meshyId', 'unityGuid']));
  });

  test('model library messages warn when preview thumbnail is missing', () => {
    const model = sampleModelAsset();
    const messages = getModelAssetLibraryMessages(model, [model]);
    expect(messages.some(m => m.kind === 'warning' && m.message.includes('preview thumbnail'))).toBe(true);
    expect(modelAssetHasPreview(model, [model])).toBe(false);
  });

  test('model library validation includes missing preview warnings', () => {
    const project = makeProject({}, [sampleModelAsset()]);
    const warnings = validateModelAssetsInLibrary(project);
    expect(warnings.some(w => w.message.includes('chest.glb'))).toBe(true);
  });

  test('linking preview image clears missing preview warning', () => {
    const preview = {
      id: 'img-preview',
      name: 'chest_preview.png',
      type: 'image' as const,
      uri: 'file:///preview.png',
      mimeType: 'image/png',
      size: 10,
      importedAt: '',
    };
    const model = sampleModelAsset({ previewImageAssetId: 'img-preview' });
    const messages = getModelAssetLibraryMessages(model, [model, preview]);
    expect(messages.some(m => m.message.includes('preview thumbnail'))).toBe(false);
    expect(modelAssetHasPreview(model, [model, preview])).toBe(true);
    expect(suggestedPreviewImageName('chest.glb')).toBe('chest_preview.png');
  });

  test('compiler/runtime output remains unchanged when stage references model assets', () => {
    const model = sampleModelAsset();
    const project = makeProject({}, [model, ...makeProject().assets.filter(a => a.name !== 'prop.png'), {
      id: 'img1',
      name: 'prop.png',
      type: 'image' as const,
      uri: 'file:///device/prop.png',
      mimeType: 'image/png',
      size: 100,
      importedAt: '',
    }]);
    const baseline = compileProject(project);
    expect(baseline.ok).toBe(true);
    if (!baseline.ok) return;

    const withModelStage = makeProject({
      stageAuthoring: {
        objects: [{
          uid: 'obj1',
          label: 'Chest',
          asset: 'chest.glb',
          x: 0.5,
          y: 0.5,
          layer: 'props',
        } as StageObject],
      },
    }, project.assets);

    const compiled = compileProject(withModelStage);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    expect(compiled.game.contentHash).toBe(baseline.game.contentHash);
    expect(compiled.game.hotspotActions).toEqual(baseline.game.hotspotActions);
    expect(compiled.game.fragments[0]).not.toHaveProperty('stageAuthoring');
    expect(fragmentForRuntimeCompile(withModelStage.fragments[0])).not.toHaveProperty('stageAuthoring');
    expect(computeProjectContentHash(withModelStage)).toBe(computeProjectContentHash(project));

    const built = buildCompiledGame(withModelStage);
    expect(built.fragments[0]).not.toHaveProperty('stageAuthoring');
  });
});
