import { SceneHotspot } from './types';
import { parseActionString } from './actions/parse-action';

export const MIN_HOTSPOT_SIZE = 0.08;
export const HOTSPOT_NUDGE_STEP = 0.05;
export const HOTSPOT_RESIZE_STEP = 0.04;
export const DEFAULT_HOTSPOT_SIZE = 0.18;

export type HotspotBounds = Pick<SceneHotspot, 'x' | 'y' | 'width' | 'height'>;

export type HotspotResizeDirection = 'wider' | 'narrower' | 'taller' | 'shorter';

/** Clamp normalized hotspot bounds to valid 0–1 range with minimum size. */
export function clampHotspotBounds(bounds: HotspotBounds): HotspotBounds {
  const width = Math.max(MIN_HOTSPOT_SIZE, Math.min(1, bounds.width));
  const height = Math.max(MIN_HOTSPOT_SIZE, Math.min(1, bounds.height));
  const x = Math.min(1 - width, Math.max(0, bounds.x));
  const y = Math.min(1 - height, Math.max(0, bounds.y));
  return { x, y, width, height };
}

export function nudgeHotspot(
  hotspot: HotspotBounds,
  dx: number,
  dy: number,
): HotspotBounds {
  return clampHotspotBounds({
    ...hotspot,
    x: hotspot.x + dx,
    y: hotspot.y + dy,
  });
}

export function resizeHotspot(
  hotspot: HotspotBounds,
  direction: HotspotResizeDirection,
  step = HOTSPOT_RESIZE_STEP,
): HotspotBounds {
  let { x, y, width, height } = hotspot;

  switch (direction) {
    case 'wider':
      width += step;
      x -= step / 2;
      break;
    case 'narrower':
      width -= step;
      x += step / 2;
      break;
    case 'taller':
      height += step;
      y -= step / 2;
      break;
    case 'shorter':
      height -= step;
      y += step / 2;
      break;
  }

  return clampHotspotBounds({ x, y, width, height });
}

export function normalizeTapToHotspot(
  locationX: number,
  locationY: number,
  stageWidth: number,
  stageHeight: number,
  size = DEFAULT_HOTSPOT_SIZE,
): HotspotBounds {
  const half = size / 2;
  return clampHotspotBounds({
    x: locationX / stageWidth - half,
    y: locationY / stageHeight - half,
    width: size,
    height: size,
  });
}

/** Display label for tabs, preview, and playtest chips. */
export function getHotspotDisplayLabel(hotspot: Pick<SceneHotspot, 'label'>, ordinal: number): string {
  const trimmed = hotspot.label?.trim();
  return trimmed ? trimmed : `Hotspot ${ordinal}`;
}

/** Short human-readable summary of a hotspot action string. */
export function summarizeHotspotAction(
  action: string,
  resolveSceneTitle?: (locationId: string) => string | undefined,
): string {
  const trimmed = action?.trim();
  if (!trimmed) return 'No action set';

  const parsed = parseActionString(trimmed);
  if (!parsed.ok) return 'Runs action';

  if (parsed.steps.length === 0) return 'No action set';

  const parts: string[] = [];
  for (const step of parsed.steps) {
    switch (step.kind) {
      case 'goto': {
        const title = resolveSceneTitle?.(step.locationId);
        parts.push(title ? `Goes to: ${title}` : `Goes to: ${step.locationId}`);
        break;
      }
      case 'assign':
        parts.push('Sets variable');
        break;
      case 'set':
        parts.push(`Sets ${step.flag}`);
        break;
      case 'clear':
        parts.push(`Clears ${step.flag}`);
        break;
      case 'increment':
      case 'decrement':
        parts.push('Updates variable');
        break;
    }
  }

  return parts.length === 1 ? parts[0] : parts.join(' · ');
}

export function resolveSceneTitleFromOptions(
  locationId: string,
  scenes: ReadonlyArray<{ locationId: string; title: string }>,
): string | undefined {
  const match = scenes.find(s => s.locationId === locationId);
  return match?.title?.trim() || undefined;
}
