import { ProjectAsset } from './types';

export type AssetResolveIssue =
  | { kind: 'not-in-library'; reference: string; field: 'backgroundImage' | 'backgroundAudio' }
  | { kind: 'empty-uri'; reference: string; assetName: string; field: 'backgroundImage' | 'backgroundAudio' };

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

function findAssetRecord(
  assets: readonly ProjectAsset[],
  reference: string,
): ProjectAsset | undefined {
  const ref = reference.trim();
  if (!ref) return undefined;

  const byName = assets.find(a => a.name === ref);
  if (byName) return byName;

  const lower = ref.toLowerCase();
  const byNameInsensitive = assets.find(a => a.name.toLowerCase() === lower);
  if (byNameInsensitive) return byNameInsensitive;

  const byId = assets.find(a => a.id === ref);
  if (byId) return byId;

  const byExactUri = assets.find(a => a.uri === ref);
  if (byExactUri) return byExactUri;

  const base = ref.split('/').pop() ?? ref;
  return assets.find(a => a.name === base || a.name === ref || a.uri.endsWith(`/${base}`));
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

  const record = findAssetRecord(assets, ref);
  if (record?.uri?.trim()) return normalizeAssetUri(record.uri);

  if (isUriLike(ref)) return normalizeAssetUri(ref);

  return undefined;
}

/** Collect asset resolution issues for the current scene media references. */
export function resolveSceneAssetIssues(
  assets: readonly ProjectAsset[],
  fragment: { backgroundImage?: string; backgroundAudio?: string },
): AssetResolveIssue[] {
  const issues: AssetResolveIssue[] = [];

  const check = (
    reference: string | undefined,
    field: 'backgroundImage' | 'backgroundAudio',
    type: ProjectAsset['type'],
  ) => {
    const ref = reference?.trim();
    if (!ref) return;

    const pool = assets.filter(a => a.type === type);
    const record = findAssetRecord(pool, ref) ?? findAssetRecord(assets, ref);
    if (!record) {
      issues.push({ kind: 'not-in-library', reference: ref, field });
      return;
    }
    if (!record.uri?.trim()) {
      issues.push({ kind: 'empty-uri', reference: ref, assetName: record.name, field });
    }
  };

  check(fragment.backgroundImage, 'backgroundImage', 'image');
  check(fragment.backgroundAudio, 'backgroundAudio', 'audio');
  return issues;
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
