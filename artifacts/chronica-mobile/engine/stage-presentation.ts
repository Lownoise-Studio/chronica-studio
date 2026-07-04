import { evaluateCondition } from './expression-evaluator';
import {
  LIGHTING_PRESET_TINTS,
  normalizeStageComposition,
  sortStageObjectsByLayer,
} from './stage-authoring';
import type {
  ChronicaState,
  LightingPreset,
  SceneHotspot,
  StageComposition,
  StageObject,
  StagePresentationMetadata,
  PresentationTransitionKind,
} from './types';

export interface StageObjectHotspotLink {
  objectUid: string;
  hotspotUid: string;
}

export interface RenderableStageObject {
  object: StageObject;
  layerIndex: number;
  linkedHotspot?: SceneHotspot;
  presentationStyle: StagePresentationStyle;
}

export interface StagePresentationStyle {
  opacity: number;
  translateX: number;
  translateY: number;
  scale: number;
}

export function resolveStageObjectHotspotRef(object: StageObject): string | undefined {
  return object.hotspotRef?.trim() || object.interactionRef?.trim() || undefined;
}

export function resolveObjectHotspotLinks(
  composition: StageComposition | undefined,
  hotspots: readonly SceneHotspot[],
): StageObjectHotspotLink[] {
  const normalized = normalizeStageComposition(composition);
  const hotspotIds = new Set(hotspots.map(h => h.uid));
  const links: StageObjectHotspotLink[] = [];
  for (const object of normalized.objects) {
    const ref = resolveStageObjectHotspotRef(object);
    if (ref && hotspotIds.has(ref)) {
      links.push({ objectUid: object.uid, hotspotUid: ref });
    }
  }
  return links;
}

export function getObjectForHotspot(
  composition: StageComposition | undefined,
  hotspotUid: string,
): StageObject | undefined {
  const normalized = normalizeStageComposition(composition);
  return normalized.objects.find(o => resolveStageObjectHotspotRef(o) === hotspotUid);
}

export function getHotspotForObject(
  object: StageObject,
  hotspots: readonly SceneHotspot[],
): SceneHotspot | undefined {
  const ref = resolveStageObjectHotspotRef(object);
  if (!ref) return undefined;
  return hotspots.find(h => h.uid === ref);
}

export function isStageObjectVisible(
  object: StageObject,
  state: ChronicaState | null | undefined,
  options?: { includeEditorHidden?: boolean },
): boolean {
  if (object.hidden && !options?.includeEditorHidden) return false;
  for (const condition of object.visibleWhen ?? []) {
    if (!condition.trim()) continue;
    if (!state || !evaluateCondition(condition, state)) return false;
  }
  return true;
}

export interface RenderStageObjectsOptions {
  /** When true, include editor-hidden objects (still respects visibility conditions). */
  includeEditorHidden?: boolean;
  previewState?: ChronicaState | null;
}

/** Objects to render in presentation preview, in layer order. */
export function getRenderableStageObjects(
  composition: StageComposition | undefined,
  options: RenderStageObjectsOptions = {},
): RenderableStageObject[] {
  const normalized = normalizeStageComposition(composition);
  const sorted = sortStageObjectsByLayer(normalized.objects);
  const renderable: RenderableStageObject[] = [];

  sorted.forEach((object, layerIndex) => {
    if (!options.includeEditorHidden && object.hidden) return;
    if (!isStageObjectVisible(object, options.previewState, {
      includeEditorHidden: options.includeEditorHidden,
    })) return;
    renderable.push({
      object,
      layerIndex,
      presentationStyle: buildPresentationStyle(object.presentation),
    });
  });

  return renderable;
}

export function buildPresentationStyle(
  presentation: StagePresentationMetadata | undefined,
): StagePresentationStyle {
  const style: StagePresentationStyle = {
    opacity: 1,
    translateX: 0,
    translateY: 0,
    scale: 1,
  };
  if (!presentation?.enter) return style;

  switch (presentation.enter) {
    case 'fade-in':
      return { ...style, opacity: 0.92 };
    case 'fade-out':
      return { ...style, opacity: 0.45 };
    case 'slide':
      return { ...style, translateY: -0.02 };
    case 'zoom':
      return { ...style, scale: 1.04 };
    default:
      return style;
  }
}

export function getPresentationTransitionLabel(kind: PresentationTransitionKind): string {
  switch (kind) {
    case 'fade-in':
      return 'Fade in';
    case 'fade-out':
      return 'Fade out';
    case 'slide':
      return 'Slide';
    case 'zoom':
      return 'Zoom';
    default:
      return kind;
  }
}

export function resolveLightingTint(composition: StageComposition | undefined): string | undefined {
  const preset = normalizeStageComposition(composition).lightingPreset as LightingPreset | undefined;
  return preset ? LIGHTING_PRESET_TINTS[preset] : undefined;
}

/** Playtest overlay must not intercept taps — hotspots remain the interaction source. */
export function presentationOverlayPointerEvents(): 'none' {
  return 'none';
}

export function shouldShowPlaytestPresentationOverlay(
  composition: StageComposition | undefined,
  enabled: boolean,
): boolean {
  if (!enabled) return false;
  const normalized = normalizeStageComposition(composition);
  if (normalized.showPresentationOverlay === false) return false;
  return normalized.objects.length > 0;
}

export function computeStageObjectBounds(
  object: StageObject,
  canvasWidth: number,
  canvasHeight: number,
): { left: number; top: number; width: number; height: number } {
  const width = Math.max(28, (object.scale ?? 1) * 56);
  const height = width;
  return {
    width,
    height,
    left: Math.max(0, object.x * canvasWidth - width / 2),
    top: Math.max(0, object.y * canvasHeight - height / 2),
  };
}

export function computeHotspotCenter(
  hotspot: SceneHotspot,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  return {
    x: (hotspot.x + hotspot.width / 2) * canvasWidth,
    y: (hotspot.y + hotspot.height / 2) * canvasHeight,
  };
}
