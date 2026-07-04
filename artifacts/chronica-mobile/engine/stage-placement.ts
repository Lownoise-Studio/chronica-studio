import {
  DEFAULT_SNAP_GRID,
  normalizeStageComposition,
  normalizeStageObject,
  snapStageObject,
  sortStageObjectsByLayer,
} from './stage-authoring';
import type { ProjectAsset, StageComposition, StageLayer, StageObject } from './types';

export type StageAssetFilter = 'all' | ProjectAsset['type'];

export type StageScenePresetKind =
  | 'background-image'
  | 'dialogue'
  | 'exploration'
  | 'locked-door'
  | 'item-pickup';

export interface StageScenePresetDefinition {
  kind: StageScenePresetKind;
  title: string;
  description: string;
}

export const STAGE_SCENE_PRESET_DEFINITIONS: StageScenePresetDefinition[] = [
  {
    kind: 'background-image',
    title: 'Background image scene',
    description: 'Full-scene backdrop object with safe-area guides.',
  },
  {
    kind: 'dialogue',
    title: 'Dialogue scene',
    description: 'Framing props with a clear center for characters.',
  },
  {
    kind: 'exploration',
    title: 'Exploration scene',
    description: 'Scattered props with rule-of-thirds guides.',
  },
  {
    kind: 'locked-door',
    title: 'Locked door scene',
    description: 'Door prop placement ready to link to a hotspot.',
  },
  {
    kind: 'item-pickup',
    title: 'Item pickup scene',
    description: 'Centered pickup prop ready to link to a hotspot.',
  },
];

export function filterStageAssets(
  assets: readonly ProjectAsset[],
  filter: StageAssetFilter,
): ProjectAsset[] {
  if (filter === 'all') return [...assets];
  return assets.filter(asset => asset.type === filter);
}

export function createStageObjectFromAsset(
  asset: Pick<ProjectAsset, 'name' | 'type'>,
  options: {
    uid: string;
    x?: number;
    y?: number;
    layer?: StageLayer;
    label?: string;
    zIndex?: number;
  },
): StageObject {
  const layer = options.layer ?? (asset.type === 'model' ? 'props' : asset.type === 'image' ? 'props' : 'effects');
  return normalizeStageObject({
    uid: options.uid,
    label: options.label ?? asset.name,
    asset: asset.name,
    x: options.x ?? 0.5,
    y: options.y ?? 0.55,
    scale: 1,
    rotation: 0,
    layer,
    zIndex: options.zIndex ?? 0,
  });
}

export function insertStageObjectFromAsset(
  composition: StageComposition | undefined,
  asset: Pick<ProjectAsset, 'name' | 'type'>,
  options: {
    createUid: () => string;
    x?: number;
    y?: number;
    layer?: StageLayer;
    label?: string;
  },
): { composition: StageComposition; object: StageObject } {
  const normalized = normalizeStageComposition(composition);
  const object = createStageObjectFromAsset(asset, {
    uid: options.createUid(),
    x: options.x,
    y: options.y,
    layer: options.layer,
    label: options.label,
    zIndex: normalized.objects.length,
  });
  return {
    composition: normalizeStageComposition({
      ...normalized,
      objects: [...normalized.objects, object],
    }),
    object,
  };
}

export function updateStageObjectTransform(
  object: StageObject,
  patch: Partial<Pick<StageObject, 'x' | 'y' | 'scale' | 'rotation'>>,
  options: { snap?: boolean; grid?: number } = {},
): StageObject {
  if (object.locked) return object;
  let next = normalizeStageObject({ ...object, ...patch });
  if (options.snap && (patch.x !== undefined || patch.y !== undefined)) {
    next = snapStageObject(next, options.grid ?? DEFAULT_SNAP_GRID);
  }
  return next;
}

export function deleteStageObjects(
  objects: readonly StageObject[],
  uids: readonly string[],
): StageObject[] {
  const uidSet = new Set(uids);
  return objects.filter(object => !uidSet.has(object.uid));
}

export function setStageObjectHotspotRef(
  object: StageObject,
  hotspotUid: string | undefined,
): StageObject {
  const ref = hotspotUid?.trim() || undefined;
  return normalizeStageObject({
    ...object,
    hotspotRef: ref,
    interactionRef: ref,
  });
}

export function setStageObjectLayer(object: StageObject, layer: StageLayer): StageObject {
  return normalizeStageObject({ ...object, layer });
}

/** Layer ordering after a layer change should remain stable for untouched objects. */
export function layerOrderPreserved(
  before: readonly StageObject[],
  after: readonly StageObject[],
  changedUid: string,
): boolean {
  const beforeOthers = sortStageObjectsByLayer(before.filter(o => o.uid !== changedUid)).map(o => o.uid);
  const afterOthers = sortStageObjectsByLayer(after.filter(o => o.uid !== changedUid)).map(o => o.uid);
  return beforeOthers.join('|') === afterOthers.join('|');
}

export function buildStageScenePreset(
  kind: StageScenePresetKind,
  options: { assetName?: string; createUid: () => string },
): StageComposition {
  const asset = options.assetName ?? '';
  const uid = () => options.createUid();
  const baseObject = (label: string, layer: StageLayer, x: number, y: number, scale = 1): StageObject =>
    normalizeStageObject({
      uid: uid(),
      label,
      asset,
      x,
      y,
      scale,
      rotation: 0,
      layer,
      zIndex: 0,
    });

  switch (kind) {
    case 'background-image':
      return normalizeStageComposition({
        objects: asset ? [baseObject('Background', 'background', 0.5, 0.5, 1.15)] : [],
        lightingPreset: 'day',
        cameraGuides: { safeArea: true, centerGuides: true },
      });
    case 'dialogue':
      return normalizeStageComposition({
        objects: asset
          ? [
            baseObject('Frame left', 'foreground', 0.18, 0.62, 0.9),
            baseObject('Frame right', 'foreground', 0.82, 0.62, 0.9),
          ]
          : [],
        lightingPreset: 'indoor',
        cameraGuides: { centerGuides: true, safeArea: true },
      });
    case 'exploration':
      return normalizeStageComposition({
        objects: asset
          ? [
            baseObject('Prop A', 'props', 0.25, 0.7, 0.85),
            baseObject('Prop B', 'props', 0.5, 0.75, 0.75),
            baseObject('Prop C', 'props', 0.78, 0.68, 0.9),
          ]
          : [],
        lightingPreset: 'day',
        cameraGuides: { ruleOfThirds: true, centerGuides: true },
      });
    case 'locked-door':
      return normalizeStageComposition({
        objects: asset ? [baseObject('Door', 'props', 0.72, 0.58, 1.05)] : [],
        lightingPreset: 'indoor',
        cameraGuides: { centerGuides: true },
      });
    case 'item-pickup':
      return normalizeStageComposition({
        objects: asset ? [baseObject('Pickup item', 'props', 0.5, 0.62, 0.75)] : [],
        lightingPreset: 'day',
        cameraGuides: { centerGuides: true },
      });
    default:
      return normalizeStageComposition(undefined);
  }
}

export function mergeStageScenePreset(
  composition: StageComposition | undefined,
  kind: StageScenePresetKind,
  options: { assetName?: string; createUid: () => string },
): StageComposition {
  const normalized = normalizeStageComposition(composition);
  const preset = buildStageScenePreset(kind, options);
  return normalizeStageComposition({
    ...normalized,
    lightingPreset: preset.lightingPreset ?? normalized.lightingPreset,
    cameraGuides: { ...normalized.cameraGuides, ...preset.cameraGuides },
    objects: [...normalized.objects, ...preset.objects],
  });
}
