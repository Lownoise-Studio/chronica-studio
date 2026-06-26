import { ChronicaState, Fragment, SceneHotspot } from './types';
import { evaluateCondition } from './expression-evaluator';

const BOUNDS_EPSILON = 1e-6;

/** Whether hotspot bounds are valid normalized 0–1 rectangles. */
export function isValidHotspotBounds(hotspot: SceneHotspot): boolean {
  const { x, y, width, height } = hotspot;
  if (![x, y, width, height].every(n => typeof n === 'number' && Number.isFinite(n))) {
    return false;
  }
  if (x < 0 || y < 0 || width <= 0 || height <= 0) return false;
  return x + width <= 1 + BOUNDS_EPSILON && y + height <= 1 + BOUNDS_EPSILON;
}

/** Hotspots whose conditions all pass in the current state. */
export function getVisibleHotspots(fragment: Fragment, state: ChronicaState): SceneHotspot[] {
  const hotspots = fragment.hotspots ?? [];
  return hotspots.filter(
    hotspot =>
      !hotspot.conditions?.length ||
      hotspot.conditions.every(c => evaluateCondition(c, state)),
  );
}
