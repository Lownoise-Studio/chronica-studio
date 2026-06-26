import {
  clampHotspotBounds,
  getHotspotDisplayLabel,
  MIN_HOTSPOT_SIZE,
  nudgeHotspot,
  normalizeTapToHotspot,
  resizeHotspot,
  summarizeHotspotAction,
} from '../engine/hotspot-helpers';
import { SceneHotspot } from '../engine/types';

const baseHotspot: SceneHotspot = {
  uid: 'h1',
  label: '',
  x: 0.4,
  y: 0.4,
  width: 0.2,
  height: 0.2,
  action: 'goto:hall',
  conditions: [],
};

describe('hotspot-helpers', () => {
  test('clampHotspotBounds enforces minimum size and 0–1 range', () => {
    expect(clampHotspotBounds({ x: -0.2, y: -0.1, width: 0.01, height: 0.01 })).toEqual({
      x: 0,
      y: 0,
      width: MIN_HOTSPOT_SIZE,
      height: MIN_HOTSPOT_SIZE,
    });

    expect(clampHotspotBounds({ x: 0.95, y: 0.95, width: 0.2, height: 0.2 })).toEqual({
      x: 0.8,
      y: 0.8,
      width: 0.2,
      height: 0.2,
    });
  });

  test('nudgeHotspot moves within bounds', () => {
    const moved = nudgeHotspot(baseHotspot, 0.5, 0.5);
    expect(moved.x).toBeLessThanOrEqual(1 - moved.width);
    expect(moved.y).toBeLessThanOrEqual(1 - moved.height);
  });

  test('resizeHotspot widens and narrows with clamping', () => {
    const wider = resizeHotspot(baseHotspot, 'wider');
    expect(wider.width).toBeGreaterThan(baseHotspot.width);

    const tiny = { ...baseHotspot, width: MIN_HOTSPOT_SIZE, height: MIN_HOTSPOT_SIZE };
    const narrower = resizeHotspot(tiny, 'narrower');
    expect(narrower.width).toBeGreaterThanOrEqual(MIN_HOTSPOT_SIZE);
  });

  test('normalizeTapToHotspot centers on tap', () => {
    const bounds = normalizeTapToHotspot(100, 50, 200, 100, 0.2);
    expect(bounds.width).toBe(0.2);
    expect(bounds.x).toBeCloseTo(0.4, 2);
    expect(bounds.y).toBeCloseTo(0.4, 2);
  });

  test('getHotspotDisplayLabel falls back to Hotspot N', () => {
    expect(getHotspotDisplayLabel({ label: 'Lantern' }, 2)).toBe('Lantern');
    expect(getHotspotDisplayLabel({ label: '' }, 2)).toBe('Hotspot 2');
    expect(getHotspotDisplayLabel({ label: '   ' }, 3)).toBe('Hotspot 3');
  });

  test('summarizeHotspotAction describes goto and variable actions', () => {
    const resolve = (id: string) => (id === 'hall' ? 'Exposure' : undefined);

    expect(summarizeHotspotAction('', resolve)).toBe('No action set');
    expect(summarizeHotspotAction('goto:hall', resolve)).toBe('Goes to: Exposure');
    expect(summarizeHotspotAction('goto:missing', resolve)).toBe('Goes to: missing');
    expect(summarizeHotspotAction('variables.found = true', resolve)).toBe('Sets variable');
    expect(summarizeHotspotAction('goto:hall; variables.found = true', resolve)).toBe(
      'Goes to: Exposure · Sets variable',
    );
  });
});
