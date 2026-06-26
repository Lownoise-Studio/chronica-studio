import {
  getAppHomeHrefForMode,
  resolveAppMode,
} from '@/config/resolve-app-mode';

describe('resolveAppMode', () => {
  it('defaults to studio mode', () => {
    expect(resolveAppMode(undefined, undefined)).toBe('studio');
    expect(getAppHomeHrefForMode('studio')).toBe('/(tabs)');
  });

  it('detects player mode from public env or expo extra', () => {
    expect(resolveAppMode('player', undefined)).toBe('player');
    expect(resolveAppMode(undefined, 'player')).toBe('player');
    expect(getAppHomeHrefForMode('player')).toBe('/player');
  });
});
