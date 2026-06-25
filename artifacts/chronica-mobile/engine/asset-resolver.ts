import { ProjectAsset } from './types';

/** True when the string looks like a URI or absolute filesystem path. */
export function isUriLike(reference: string): boolean {
  return (
    reference.startsWith('file://') ||
    reference.startsWith('content://') ||
    reference.startsWith('http://') ||
    reference.startsWith('https://') ||
    reference.startsWith('blob:') ||
    reference.startsWith('data:') ||
    reference.startsWith('/')
  );
}

/** Ensure local paths are usable as React Native / Expo image source URIs. */
export function normalizeAssetUri(uri: string): string {
  const trimmed = uri.trim();
  if (!trimmed) return trimmed;
  if (
    trimmed.startsWith('file://') ||
    trimmed.startsWith('content://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    return `file://${trimmed}`;
  }
  return trimmed;
}

/**
 * Resolve a scene background (or audio) reference to a loadable URI.
 * Fragments store the project asset `name`; this also accepts id, uri, or basename.
 */
export function resolveAssetUri(
  assets: readonly ProjectAsset[],
  reference?: string,
): string | undefined {
  const ref = reference?.trim();
  if (!ref) return undefined;

  const byName = assets.find(a => a.name === ref && a.uri);
  if (byName) return normalizeAssetUri(byName.uri);

  const lower = ref.toLowerCase();
  const byNameInsensitive = assets.find(
    a => a.uri && a.name.toLowerCase() === lower,
  );
  if (byNameInsensitive) return normalizeAssetUri(byNameInsensitive.uri);

  const byId = assets.find(a => a.id === ref && a.uri);
  if (byId) return normalizeAssetUri(byId.uri);

  const byExactUri = assets.find(a => a.uri === ref);
  if (byExactUri) return normalizeAssetUri(byExactUri.uri);

  const base = ref.split('/').pop() ?? ref;
  const byBasename = assets.find(a => {
    if (!a.uri) return false;
    return a.name === base || a.name === ref || a.uri.endsWith(`/${base}`);
  });
  if (byBasename) return normalizeAssetUri(byBasename.uri);

  if (isUriLike(ref)) return normalizeAssetUri(ref);

  return undefined;
}

/**
 * Resolve fragment.backgroundImage (asset name) to a URI for the player UI.
 */
export function resolveSceneBackgroundUri(
  assets: readonly ProjectAsset[],
  backgroundImage?: string,
): string | undefined {
  return resolveAssetUri(
    assets.filter(a => a.type === 'image'),
    backgroundImage,
  );
}

/**
 * Resolve fragment.backgroundAudio (asset name) to a URI for playback.
 */
export function resolveSceneAudioUri(
  assets: readonly ProjectAsset[],
  backgroundAudio?: string,
): string | undefined {
  return resolveAssetUri(
    assets.filter(a => a.type === 'audio'),
    backgroundAudio,
  );
}
