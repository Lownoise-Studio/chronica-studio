export type ChronicaAppMode = 'studio' | 'player';

export function resolveAppMode(
  publicEnv: string | undefined,
  extraMode: unknown,
): ChronicaAppMode {
  if (publicEnv === 'player') return 'player';
  if (extraMode === 'player') return 'player';
  return 'studio';
}

export function getAppHomeHrefForMode(mode: ChronicaAppMode): '/player' | '/(tabs)' {
  return mode === 'player' ? '/player' : '/(tabs)';
}
