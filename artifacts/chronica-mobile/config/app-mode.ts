import Constants from 'expo-constants';

import {
  getAppHomeHrefForMode,
  resolveAppMode,
  type ChronicaAppMode,
} from '@/config/resolve-app-mode';

const appMode = resolveAppMode(
  process.env.EXPO_PUBLIC_CHRONICA_APP_MODE,
  Constants.expoConfig?.extra?.chronicaAppMode,
);

export type { ChronicaAppMode };

export function getChronicaAppMode(): ChronicaAppMode {
  return appMode;
}

export function isPlayerApp(): boolean {
  return appMode === 'player';
}

export function isStudioApp(): boolean {
  return appMode === 'studio';
}

export function getAppHomeHref(): '/player' | '/(tabs)' {
  return getAppHomeHrefForMode(appMode);
}
