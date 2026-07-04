import { applyMissingAssetSeverity } from './validation-severity';
import type { Project, ProjectAsset, ValidationError } from './types';

export const MODEL_EXTENSIONS = new Set(['glb', 'gltf']);

export const MODEL_MIME_BY_EXT: Record<string, string> = {
  glb: 'model/gltf-binary',
  gltf: 'model/gltf+json',
};

export const SOURCE_SPECIFIC_ASSET_FIELDS = [
  'meshyId',
  'syntyPackId',
  'blenderFile',
  'unityGuid',
  'unrealAssetPath',
] as const;

export type ProjectAssetType = ProjectAsset['type'];

export function isModelFilename(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return MODEL_EXTENSIONS.has(ext);
}

export function isModelMimeType(mimeType?: string | null): boolean {
  if (!mimeType) return false;
  return mimeType === 'model/gltf-binary' || mimeType === 'model/gltf+json';
}

export function inferModelTypeFromFilename(filename: string): 'model' | null {
  return isModelFilename(filename) ? 'model' : null;
}

export function mimeTypeForModelFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return MODEL_MIME_BY_EXT[ext] ?? 'model/gltf-binary';
}

export function isModelAsset(asset: Pick<ProjectAsset, 'type' | 'name' | 'mimeType'>): boolean {
  return asset.type === 'model' || isModelFilename(asset.name) || isModelMimeType(asset.mimeType);
}

/** Portable package path — models live under assets/models/. */
export function packageModelAssetPath(filename: string): string {
  const safe = filename.replace(/\\/g, '/').split('/').pop()?.replace(/[/\\]/g, '_') ?? filename.replace(/[/\\]/g, '_');
  return `assets/models/${safe}`;
}

export function packagePathForAsset(asset: Pick<ProjectAsset, 'name' | 'type'>): string {
  if (asset.type === 'model') return packageModelAssetPath(asset.name);
  const safe = asset.name.replace(/\\/g, '/').split('/').pop()?.replace(/[/\\]/g, '_') ?? asset.name.replace(/[/\\]/g, '_');
  return `assets/${safe}`;
}

export function findAssetById(assets: readonly ProjectAsset[], id: string): ProjectAsset | undefined {
  const trimmed = id.trim();
  return assets.find(asset => asset.id === trimmed);
}

export function collectStageAuthoringAssetNames(project: Project): string[] {
  const names = new Set<string>();
  for (const fragment of project.fragments) {
    for (const object of fragment.stageAuthoring?.objects ?? []) {
      if (object.asset?.trim()) names.add(object.asset.trim());
    }
  }
  return [...names];
}

export function collectPreviewImageAssetNames(assets: readonly ProjectAsset[]): string[] {
  const names = new Set<string>();
  for (const asset of assets) {
    const previewId = asset.previewImageAssetId?.trim();
    if (!previewId) continue;
    const preview = findAssetById(assets, previewId);
    if (preview?.name) names.add(preview.name);
  }
  return [...names];
}

export function collectPackageAssetNames(project: Project): string[] {
  const names = new Set<string>();
  for (const name of collectRuntimeReferencedAssetNames(project)) names.add(name);
  for (const name of collectStageAuthoringAssetNames(project)) names.add(name);
  for (const name of collectPreviewImageAssetNames(project.assets)) names.add(name);
  return [...names];
}

/** Gameplay/runtime references — excludes editor-only stageAuthoring. */
export function collectRuntimeReferencedAssetNames(project: Project): string[] {
  const names = new Set<string>();
  for (const frag of project.fragments) {
    if (frag.backgroundImage?.trim()) names.add(frag.backgroundImage.trim());
    if (frag.backgroundAudio?.trim()) names.add(frag.backgroundAudio.trim());
    for (const actor of frag.stageActors ?? []) {
      if (actor.asset?.trim()) names.add(actor.asset.trim());
      for (const expression of actor.expressions ?? []) {
        if (expression.asset?.trim()) names.add(expression.asset.trim());
      }
    }
  }
  for (const character of project.characters ?? []) {
    if (character.defaultPortrait?.trim()) names.add(character.defaultPortrait.trim());
    for (const expression of character.expressions ?? []) {
      if (expression.portrait?.trim()) names.add(expression.portrait.trim());
    }
  }
  return [...names];
}

export function findDuplicateAssetIds(assets: readonly ProjectAsset[]): string[] {
  const seen = new Map<string, string>();
  const duplicates: string[] = [];
  for (const asset of assets) {
    const id = asset.id.trim();
    if (!id) continue;
    const prior = seen.get(id);
    if (prior && prior !== asset.name) duplicates.push(id);
    else seen.set(id, asset.name);
  }
  return duplicates;
}

export interface UnsupportedAssetFieldWarning {
  assetName: string;
  field: string;
}

export function findUnsupportedAssetFieldWarnings(rawAssets: readonly Record<string, unknown>[]): UnsupportedAssetFieldWarning[] {
  const warnings: UnsupportedAssetFieldWarning[] = [];
  for (const raw of rawAssets) {
    const name = typeof raw.name === 'string' ? raw.name : 'asset';
    for (const field of SOURCE_SPECIFIC_ASSET_FIELDS) {
      if (field in raw) warnings.push({ assetName: name, field });
    }
  }
  return warnings;
}

export function validateProjectAssets(project: Project): ValidationError[] {
  const errors: ValidationError[] = [];
  const duplicateIds = findDuplicateAssetIds(project.assets);
  for (const id of duplicateIds) {
    errors.push({
      fragmentUid: '',
      fragmentTitle: 'Project',
      type: 'missing-asset',
      message: `Duplicate asset id "${id}" — each asset id must be unique`,
    });
  }

  for (const asset of project.assets) {
    if (asset.type === 'model' && !isModelFilename(asset.name) && !isModelMimeType(asset.mimeType)) {
      errors.push({
        fragmentUid: '',
        fragmentTitle: 'Project',
        type: 'missing-asset',
        severity: 'warning',
        message: `Model asset "${asset.name}" should use .glb or .gltf extension`,
      });
    }
    const previewId = asset.previewImageAssetId?.trim();
    if (previewId && !findAssetById(project.assets, previewId)) {
      errors.push(applyMissingAssetSeverity({
        fragmentUid: '',
        fragmentTitle: 'Project',
        type: 'missing-asset',
        message: `Asset "${asset.name}" references missing preview image id "${previewId}"`,
      }));
    }
  }

  return errors;
}

export function findMissingStageObjectAssetRefs(project: Project): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const fragment of project.fragments) {
    const meta = { fragmentUid: fragment.uid, fragmentTitle: fragment.title || fragment.locationId };
    for (const object of fragment.stageAuthoring?.objects ?? []) {
      const ref = object.asset?.trim();
      if (!ref) continue;
      const asset = project.assets.find(a => a.name === ref)
        ?? project.assets.find(a => a.name.toLowerCase() === ref.toLowerCase());
      if (!asset) {
        errors.push({
          ...meta,
          type: 'missing-asset',
          message: `Stage object "${object.label || object.uid}" references missing asset "${ref}"`,
        });
      }
    }
  }
  return errors;
}

export function normalizeImportedModelAsset(asset: ProjectAsset): ProjectAsset {
  if (asset.type !== 'model') return asset;
  return {
    ...asset,
    mimeType: asset.mimeType?.trim() || mimeTypeForModelFilename(asset.name),
  };
}

export interface ModelAssetLibraryMessage {
  kind: 'warning' | 'info';
  message: string;
}

export const MODEL_IMPORT_GUIDANCE: readonly string[] = [
  'Prefer GLB (binary glTF) for single-file portability in Chronica packages.',
  'Use glTF + separate textures only when needed; embed textures in GLB when possible.',
  'Export from Blender, Unity, Unreal, Synty, or Meshy into glTF — avoid source-specific runtime fields.',
  'Keep models under package size limits; simplify materials for mobile preview.',
  'Add a PNG/JPG preview thumbnail so stage authoring shows a recognizable card.',
];

export function formatModelAssetSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function modelAssetHasPreview(
  asset: Pick<ProjectAsset, 'previewImageAssetId'>,
  assets: readonly ProjectAsset[],
): boolean {
  const previewId = asset.previewImageAssetId?.trim();
  if (!previewId) return false;
  const preview = findAssetById(assets, previewId);
  return !!preview?.uri?.trim();
}

export function suggestedPreviewImageName(modelName: string): string {
  const dot = modelName.lastIndexOf('.');
  const stem = dot > 0 ? modelName.slice(0, dot) : modelName;
  return `${stem}_preview.png`;
}

/** Editor/library validation messages for a single model asset. */
export function getModelAssetLibraryMessages(
  asset: ProjectAsset,
  assets: readonly ProjectAsset[],
): ModelAssetLibraryMessage[] {
  if (!isModelAsset(asset)) return [];

  const messages: ModelAssetLibraryMessage[] = [];

  if (!isModelFilename(asset.name) && !isModelMimeType(asset.mimeType)) {
    messages.push({
      kind: 'warning',
      message: 'Model filename should use a .glb or .gltf extension.',
    });
  }

  if (!asset.uri?.trim()) {
    messages.push({
      kind: 'warning',
      message: 'Model file URI is empty — re-import this asset.',
    });
  }

  const previewId = asset.previewImageAssetId?.trim();
  if (!previewId) {
    messages.push({
      kind: 'warning',
      message: 'No preview thumbnail linked — stage authoring will show a placeholder card.',
    });
  } else if (!findAssetById(assets, previewId)) {
    messages.push({
      kind: 'warning',
      message: `Linked preview image id "${previewId}" was not found in the asset library.`,
    });
  } else if (!modelAssetHasPreview(asset, assets)) {
    messages.push({
      kind: 'warning',
      message: 'Linked preview image has no loadable URI.',
    });
  }

  if (!asset.source?.trim()) {
    messages.push({
      kind: 'info',
      message: 'Optional: add a source label (e.g. Blender export, Sketchfab) for your records.',
    });
  }

  return messages;
}

export function validateModelAssetsInLibrary(project: Project): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const asset of project.assets) {
    if (!isModelAsset(asset)) continue;
    for (const message of getModelAssetLibraryMessages(asset, project.assets)) {
      if (message.kind !== 'warning') continue;
      errors.push({
        fragmentUid: '',
        fragmentTitle: 'Asset library',
        type: 'missing-asset',
        severity: 'warning',
        message: `Model "${asset.name}": ${message.message}`,
      });
    }
  }
  return errors;
}
