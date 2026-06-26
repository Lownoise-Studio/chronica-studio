import type { ExpoConfig, ConfigContext } from 'expo/config';

import appJson from './app.json';

const base = appJson.expo as ExpoConfig;

const PLAYER_EAS_PROJECT_ID = '465f6328-9713-4a7e-9b6a-d1817a57cc85';

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function mergeExtra(
  configExtra: ExpoConfig['extra'],
  baseExtra: ExpoConfig['extra'],
  chronicaAppMode: 'studio' | 'player',
): ExpoConfig['extra'] {
  const merged = {
    ...asRecord(configExtra),
    ...asRecord(baseExtra),
  };
  const existingEas = asRecord(merged.eas);

  return {
    ...merged,
    chronicaAppMode,
    eas: {
      ...existingEas,
      ...(chronicaAppMode === 'player'
        ? { projectId: existingEas.projectId ?? PLAYER_EAS_PROJECT_ID }
        : {}),
    },
  };
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const isPlayer = process.env.CHRONICA_APP_MODE === 'player';

  if (!isPlayer) {
    return {
      ...config,
      ...base,
      extra: mergeExtra(config.extra, base.extra, 'studio'),
    };
  }

  return {
    ...config,
    ...base,
    name: 'Chronica Player',
    slug: 'chronica-player',
    scheme: 'chronicaplayer',
    extra: mergeExtra(config.extra, base.extra, 'player'),
    ios: {
      ...base.ios,
      bundleIdentifier: 'studio.lownoise.chronicaplayer',
      infoPlist: {
        ...base.ios?.infoPlist,
        CFBundleDocumentTypes: [
          {
            CFBundleTypeName: 'Chronica Game Package',
            CFBundleTypeRole: 'Viewer',
            LSHandlerRank: 'Owner',
            LSItemContentTypes: ['public.zip-archive', 'public.data'],
          },
        ],
      },
    },
    android: {
      ...base.android,
      package: 'studio.lownoise.chronicaplayer',
      intentFilters: [
        {
          action: 'VIEW',
          category: ['BROWSABLE', 'DEFAULT'],
          data: [
            { mimeType: 'application/zip' },
            { mimeType: 'application/octet-stream' },
            { mimeType: 'application/x-zip-compressed' },
          ],
        },
      ],
    },
    plugins: (base.plugins ?? []).filter(
      plugin => !(Array.isArray(plugin) && plugin[0] === 'expo-image-picker'),
    ),
  };
};
