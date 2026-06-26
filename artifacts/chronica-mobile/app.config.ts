import type { ExpoConfig, ConfigContext } from 'expo/config';

import appJson from './app.json';

const base = appJson.expo as ExpoConfig;

export default ({ config }: ConfigContext): ExpoConfig => {
  const isPlayer = process.env.CHRONICA_APP_MODE === 'player';

  if (!isPlayer) {
    return {
      ...config,
      ...base,
      extra: {
        ...base.extra,
        chronicaAppMode: 'studio',
      },
    };
  }

  return {
    ...config,
    ...base,
    name: 'Chronica Player',
    slug: 'chronica-player',
    scheme: 'chronicaplayer',
    extra: {
      ...base.extra,
      chronicaAppMode: 'player',
    },
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
