import {
  ADVENTURE_SHEET_FLEX,
  ADVENTURE_STAGE_FLEX,
  getDialogueBubbleVariant,
  shouldShowHotspotAccessibilityList,
  shouldShowHotspotGuidancePulse,
} from '../engine/player-presentation';

describe('player presentation polish', () => {
  test('adventure layout uses ~70/30 stage to sheet ratio', () => {
    expect(ADVENTURE_STAGE_FLEX).toBe(7);
    expect(ADVENTURE_SHEET_FLEX).toBe(3);
    expect(ADVENTURE_STAGE_FLEX / (ADVENTURE_STAGE_FLEX + ADVENTURE_SHEET_FLEX)).toBeCloseTo(0.7);
  });

  describe('getDialogueBubbleVariant', () => {
    test('uses caption for narration in adventure layout', () => {
      expect(getDialogueBubbleVariant(true, true)).toBe('caption');
    });

    test('uses card for character dialogue in adventure layout', () => {
      expect(getDialogueBubbleVariant(true, false)).toBe('card');
    });

    test('uses card for narration in reading layout', () => {
      expect(getDialogueBubbleVariant(false, true)).toBe('card');
    });
  });

  describe('shouldShowHotspotAccessibilityList', () => {
    test('shows list only in advanced adventure mode after dialogue', () => {
      expect(shouldShowHotspotAccessibilityList(true, true, true, 2)).toBe(true);
      expect(shouldShowHotspotAccessibilityList(false, true, true, 2)).toBe(false);
      expect(shouldShowHotspotAccessibilityList(true, false, true, 2)).toBe(false);
      expect(shouldShowHotspotAccessibilityList(true, true, false, 2)).toBe(false);
      expect(shouldShowHotspotAccessibilityList(true, true, true, 0)).toBe(false);
    });
  });

  describe('shouldShowHotspotGuidancePulse', () => {
    test('shows pulse after dialogue for normal play with hotspots', () => {
      expect(shouldShowHotspotGuidancePulse(false, true, 3)).toBe(true);
      expect(shouldShowHotspotGuidancePulse(true, true, 3)).toBe(false);
      expect(shouldShowHotspotGuidancePulse(false, false, 3)).toBe(false);
      expect(shouldShowHotspotGuidancePulse(false, true, 0)).toBe(false);
    });
  });
});
