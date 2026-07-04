import { isValidCondition } from './expression-evaluator';
import { getSceneGameplayPreview } from './gameplay-feedback';
import type {
  Fragment,
  LightingPreset,
  Project,
  StageComposition,
  StageLayer,
  StageObject,
} from './types';

export const STAGE_LAYERS: readonly StageLayer[] = [
  'background',
  'props',
  'foreground',
  'effects',
  'lighting',
  'ui-guides',
] as const;

export const STAGE_LAYER_LABELS: Record<StageLayer, string> = {
  background: 'Background',
  foreground: 'Foreground',
  props: 'Props',
  effects: 'Effects',
  lighting: 'Lighting',
  'ui-guides': 'UI Guides',
};

export const LIGHTING_PRESETS: readonly LightingPreset[] = [
  'morning',
  'day',
  'sunset',
  'night',
  'indoor',
  'cave',
] as const;

export const LIGHTING_PRESET_LABELS: Record<LightingPreset, string> = {
  morning: 'Morning',
  day: 'Day',
  sunset: 'Sunset',
  night: 'Night',
  indoor: 'Indoor',
  cave: 'Cave',
};

export const LIGHTING_PRESET_TINTS: Record<LightingPreset, string> = {
  morning: '#ffd9a322',
  day: '#ffffff08',
  sunset: '#ff9a5a33',
  night: '#1a2a4a55',
  indoor: '#f5e6c822',
  cave: '#2a1a3a44',
};

export const DEFAULT_SNAP_GRID = 0.05;

const LAYER_RANK: Record<StageLayer, number> = {
  background: 0,
  props: 1,
  foreground: 2,
  effects: 3,
  lighting: 4,
  'ui-guides': 5,
};

export function emptyStageComposition(): StageComposition {
  return { objects: [], lightingPreset: 'day', cameraGuides: { centerGuides: true } };
}

export function normalizeStageComposition(composition: StageComposition | undefined): StageComposition {
  if (!composition) return emptyStageComposition();
  return {
    objects: [...(composition.objects ?? [])].map(normalizeStageObject),
    lightingPreset: composition.lightingPreset ?? 'day',
    cameraGuides: { ...(composition.cameraGuides ?? {}) },
    showPresentationOverlay: composition.showPresentationOverlay,
  };
}

export function normalizeStageObject(object: StageObject): StageObject {
  return {
    ...object,
    x: clamp01(object.x),
    y: clamp01(object.y),
    scale: object.scale ?? 1,
    rotation: object.rotation ?? 0,
    zIndex: object.zIndex ?? 0,
    visibleWhen: [...(object.visibleWhen ?? [])],
    hotspotRef: object.hotspotRef?.trim() || object.interactionRef?.trim() || undefined,
    interactionRef: object.interactionRef?.trim() || object.hotspotRef?.trim() || undefined,
    presentation: object.presentation ? { ...object.presentation } : undefined,
    locked: !!object.locked,
    hidden: !!object.hidden,
  };
}

export function serializeStageComposition(composition: StageComposition): string {
  return JSON.stringify(normalizeStageComposition(composition));
}

export function sortStageObjectsByLayer(objects: readonly StageObject[]): StageObject[] {
  return [...objects].sort((a, b) => {
    const layerDiff = LAYER_RANK[a.layer] - LAYER_RANK[b.layer];
    if (layerDiff !== 0) return layerDiff;
    const zDiff = (a.zIndex ?? 0) - (b.zIndex ?? 0);
    if (zDiff !== 0) return zDiff;
    return a.uid.localeCompare(b.uid);
  });
}

export function snapValue(value: number, grid = DEFAULT_SNAP_GRID): number {
  const snapped = Math.round(value / grid) * grid;
  return clamp01(Number(snapped.toFixed(4)));
}

export function snapStageObject(object: StageObject, grid = DEFAULT_SNAP_GRID): StageObject {
  return {
    ...object,
    x: snapValue(object.x, grid),
    y: snapValue(object.y, grid),
  };
}

export function moveStageObject(
  object: StageObject,
  dx: number,
  dy: number,
  options: { snap?: boolean; grid?: number } = {},
): StageObject {
  if (object.locked) return object;
  const next = {
    ...object,
    x: clamp01(object.x + dx),
    y: clamp01(object.y + dy),
  };
  return options.snap ? snapStageObject(next, options.grid) : next;
}

export function duplicateStageObject(object: StageObject, newUid: string): StageObject {
  return normalizeStageObject({
    ...object,
    uid: newUid,
    label: object.label ? `${object.label} copy` : undefined,
    x: snapValue(Math.min(0.95, object.x + 0.04)),
    y: snapValue(Math.min(0.95, object.y + 0.04)),
    locked: false,
    hidden: false,
  });
}

export function toggleStageObjectLock(object: StageObject): StageObject {
  return { ...object, locked: !object.locked };
}

export function toggleStageObjectHidden(object: StageObject): StageObject {
  return { ...object, hidden: !object.hidden };
}

export function alignStageObjects(
  objects: readonly StageObject[],
  selectedUids: readonly string[],
  axis: 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom',
): StageObject[] {
  const selected = objects.filter(o => selectedUids.includes(o.uid) && !o.locked);
  if (selected.length < 2) return [...objects];

  const xs = selected.map(o => o.x);
  const ys = selected.map(o => o.y);
  let targetX = xs[0];
  let targetY = ys[0];
  switch (axis) {
    case 'left':
      targetX = Math.min(...xs);
      break;
    case 'center-x':
      targetX = xs.reduce((a, b) => a + b, 0) / xs.length;
      break;
    case 'right':
      targetX = Math.max(...xs);
      break;
    case 'top':
      targetY = Math.min(...ys);
      break;
    case 'center-y':
      targetY = ys.reduce((a, b) => a + b, 0) / ys.length;
      break;
    case 'bottom':
      targetY = Math.max(...ys);
      break;
  }

  const selectedSet = new Set(selected.map(o => o.uid));
  return objects.map(object => {
    if (!selectedSet.has(object.uid) || object.locked) return object;
    return normalizeStageObject({
      ...object,
      x: axis === 'top' || axis === 'center-y' || axis === 'bottom' ? object.x : targetX,
      y: axis === 'left' || axis === 'center-x' || axis === 'right' ? object.y : targetY,
    });
  });
}

export function bringStageObjectForward(
  objects: readonly StageObject[],
  uid: string,
): StageObject[] {
  const sorted = sortStageObjectsByLayer(objects);
  const index = sorted.findIndex(o => o.uid === uid);
  if (index < 0 || index === sorted.length - 1) return [...objects];
  const current = sorted[index];
  const next = sorted[index + 1];
  if (current.layer !== next.layer) {
    return objects.map(o => (o.uid === uid ? { ...o, layer: next.layer } : o));
  }
  const targetZ = (next.zIndex ?? 0) + 1;
  return objects.map(o => (o.uid === uid ? { ...o, zIndex: targetZ } : o));
}

export function sendStageObjectBackward(
  objects: readonly StageObject[],
  uid: string,
): StageObject[] {
  const sorted = sortStageObjectsByLayer(objects);
  const index = sorted.findIndex(o => o.uid === uid);
  if (index <= 0) return [...objects];
  const current = sorted[index];
  const prev = sorted[index - 1];
  if (current.layer !== prev.layer) {
    return objects.map(o => (o.uid === uid ? { ...o, layer: prev.layer } : o));
  }
  const targetZ = Math.max(0, (prev.zIndex ?? 0) - 1);
  return objects.map(o => (o.uid === uid ? { ...o, zIndex: targetZ } : o));
}

export function selectStageGroup(objects: readonly StageObject[], groupId: string): string[] {
  return objects.filter(o => o.groupId === groupId).map(o => o.uid);
}

export function assignStageGroup(objects: readonly StageObject[], uids: readonly string[], groupId: string): StageObject[] {
  const uidSet = new Set(uids);
  return objects.map(o => (uidSet.has(o.uid) ? { ...o, groupId } : o));
}

export function validateStageObject(object: StageObject): string[] {
  const issues: string[] = [];
  if (!object.asset.trim()) issues.push('Missing asset');
  if (!STAGE_LAYERS.includes(object.layer)) issues.push('Invalid layer');
  if (object.x < 0 || object.x > 1 || object.y < 0 || object.y > 1) issues.push('Position out of bounds');
  for (const condition of object.visibleWhen ?? []) {
    if (condition.trim() && !isValidCondition(condition)) issues.push(`Invalid condition: ${condition}`);
  }
  return issues;
}

export function stripStageAuthoringFromFragment<T extends Fragment>(fragment: T): Omit<T, 'stageAuthoring'> {
  const { stageAuthoring: _ignored, ...runtimeFragment } = fragment;
  return runtimeFragment;
}

export interface SceneInspectorSection {
  title: string;
  items: string[];
}

export function buildSceneInspectorSections(
  fragment: Fragment,
  project: Pick<Project, 'inventory' | 'objectives' | 'worldState' | 'npcProfiles' | 'gameplayVariables'>,
): SceneInspectorSection[] {
  const composition = normalizeStageComposition(fragment.stageAuthoring);
  const preview = getSceneGameplayPreview(fragment, project);
  const sections: SceneInspectorSection[] = [
    {
      title: 'Objects',
      items: composition.objects.length
        ? composition.objects.map(o => `${o.label || o.asset} (${STAGE_LAYER_LABELS[o.layer]})`)
        : ['No stage objects'],
    },
    {
      title: 'Hotspots',
      items: (fragment.hotspots ?? []).length
        ? (fragment.hotspots ?? []).map(h => h.label || h.uid)
        : ['No hotspots'],
    },
    {
      title: 'Actors',
      items: (fragment.stageActors ?? []).length
        ? (fragment.stageActors ?? []).map(a => a.label || a.asset || a.uid)
        : ['No stage actors'],
    },
    {
      title: 'Components',
      items: [
        ...preview.inventory.map(i => `Inventory: ${i.label}`),
        ...preview.objectives.map(o => `Objective: ${o.title}`),
        ...preview.worldState.map(w => `World: ${w.label}`),
      ].length
        ? [
            ...preview.inventory.map(i => `Inventory: ${i.label}`),
            ...preview.objectives.map(o => `Objective: ${o.title}`),
            ...preview.worldState.map(w => `World: ${w.label}`),
          ]
        : ['No gameplay catalog references'],
    },
    {
      title: 'Variables used',
      items: collectSceneVariableRefs(fragment).length
        ? collectSceneVariableRefs(fragment)
        : ['None referenced'],
    },
    {
      title: 'Objectives referenced',
      items: preview.objectives.length
        ? preview.objectives.map(o => o.title)
        : ['None referenced'],
    },
    {
      title: 'Inventory references',
      items: preview.inventory.length
        ? preview.inventory.map(i => i.label)
        : ['None referenced'],
    },
  ];
  return sections;
}

function collectSceneVariableRefs(fragment: Fragment): string[] {
  const refs = new Set<string>();
  const haystack = [
    ...fragment.conditions,
    ...fragment.effects,
    ...(fragment.hotspots ?? []).flatMap(h => [h.action, ...h.conditions]),
    ...(fragment.stageActors ?? []).flatMap(a => a.visibleWhen ?? []),
    ...(fragment.stageAuthoring?.objects ?? []).flatMap(o => o.visibleWhen ?? []),
  ].join('\n');
  const matches = haystack.matchAll(/(?:variables|memory)\.(\w+)/g);
  for (const match of matches) refs.add(`${match[0].startsWith('memory') ? 'memory' : 'variables'}.${match[1]}`);
  return Array.from(refs).sort();
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
