import { normalizeAssetUri } from './asset-resolver';
import { computeProjectContentHash } from './compiler/build-compiled-game';
import { crc32 } from './crc32';
import { Project, ProjectAsset } from './types';

export const CHRONICA_PACKAGE_FORMAT = 'chronica-package';
export const CHRONICA_PACKAGE_VERSION = 1;
/** Lowest package format version this build can import. */
export const CHRONICA_PACKAGE_VERSION_MIN = 1;
/** Highest package format version this build can import without migration. */
export const CHRONICA_PACKAGE_VERSION_MAX = 1;
export const CHRONICA_PACKAGE_APP = 'Chronica Studio';

export const MANIFEST_PATH = 'manifest.json';
export const STORY_PATH = 'story.json';
export const ASSETS_PREFIX = 'assets/';

export interface PackageAssetManifestEntry {
  path: string;
  size: number;
  crc32: number;
}

export interface ChronicaPackageManifest {
  format: typeof CHRONICA_PACKAGE_FORMAT;
  version: number;
  app: typeof CHRONICA_PACKAGE_APP;
  exportedAt: string;
  title: string;
  gameId: string;
  /** Hash of authored story content at export time. */
  storyContentHash: string;
  /** Per-asset integrity entries for embedded assets/* files. */
  assetsManifest: PackageAssetManifestEntry[];
  assetCount: number;
  storySchemaVersion: number;
}

export interface PackageAssetFile {
  /** Path inside the .chronica zip, e.g. assets/forest.jpg */
  packagePath: string;
  asset: ProjectAsset;
  sourceUri: string;
}

export interface BuildPackagePlan {
  manifest: ChronicaPackageManifest;
  story: Project;
  assetFiles: PackageAssetFile[];
  missingAssets: MissingAssetReport[];
}

export interface MissingAssetReport {
  name: string;
  reason: 'not-in-library' | 'missing-file' | 'empty-uri';
  referencedBy: string[];
}

export type PackageExportDiagnosticType = MissingAssetReport['reason'];

export interface PackageExportDiagnostic {
  type: PackageExportDiagnosticType;
  assetName: string;
  message: string;
  referencedBy: string[];
}

export function missingAssetsToDiagnostics(reports: MissingAssetReport[]): PackageExportDiagnostic[] {
  return reports.map(report => ({
    type: report.reason,
    assetName: report.name,
    message: `Missing asset "${report.name}" (${report.reason}) referenced by: ${report.referencedBy.join(', ')}`,
    referencedBy: report.referencedBy,
  }));
}

export function buildAssetsManifest(
  files: ReadonlyArray<{ path: string; data: Uint8Array }>,
): PackageAssetManifestEntry[] {
  return files.map(({ path, data }) => ({
    path: normalizePackagePath(path),
    size: data.length,
    crc32: crc32(data),
  }));
}

export type PackageAssetVerifyResult =
  | { ok: true }
  | { ok: false; code: 'missing-asset' | 'corrupt-asset'; error: string };

/** Verify embedded asset bytes against manifest entries (pure — caller supplies zip map lookup). */
export function verifyPackageAssetsManifest(
  getAssetData: (packagePath: string) => Uint8Array | undefined,
  manifest: readonly PackageAssetManifestEntry[],
): PackageAssetVerifyResult {
  for (const entry of manifest) {
    const normalized = normalizePackagePath(entry.path);
    const data = getAssetData(normalized);
    if (!data) {
      return { ok: false, code: 'missing-asset', error: `Package missing asset file: ${entry.path}` };
    }
    if (data.length !== entry.size) {
      return { ok: false, code: 'corrupt-asset', error: `Package asset size mismatch: ${entry.path}` };
    }
    if (crc32(data) !== entry.crc32) {
      return { ok: false, code: 'corrupt-asset', error: `Package asset checksum mismatch: ${entry.path}` };
    }
  }
  return { ok: true };
}

export function collectReferencedAssetNames(project: Project): string[] {
  const names = new Set<string>();
  for (const frag of project.fragments) {
    if (frag.backgroundImage?.trim()) names.add(frag.backgroundImage.trim());
    if (frag.backgroundAudio?.trim()) names.add(frag.backgroundAudio.trim());
  }
  for (const character of project.characters ?? []) {
    if (character.defaultPortrait?.trim()) names.add(character.defaultPortrait.trim());
    for (const expression of character.expressions ?? []) {
      if (expression.portrait?.trim()) names.add(expression.portrait.trim());
    }
  }
  return [...names];
}

export function findAssetByName(assets: ProjectAsset[], name: string): ProjectAsset | undefined {
  const trimmed = name.trim();
  return assets.find(a => a.name === trimmed)
    ?? assets.find(a => a.name.toLowerCase() === trimmed.toLowerCase());
}

export function packageAssetPath(filename: string): string {
  const safe = sanitizePackageFilename(filename);
  return `${ASSETS_PREFIX}${safe}`;
}

export function sanitizePackageFilename(filename: string): string {
  return filename.replace(/\\/g, '/').split('/').pop()?.replace(/[/\\]/g, '_') ?? filename.replace(/[/\\]/g, '_');
}

function normalizePackagePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^\.\//, '');
}

function lookupLocalUri(
  localUriByPackagePath: Record<string, string>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const trimmed = key.trim();
    if (!trimmed) continue;
    const normalized = normalizePackagePath(trimmed);
    const hit =
      localUriByPackagePath[trimmed]
      ?? localUriByPackagePath[normalized]
      ?? localUriByPackagePath[normalized.toLowerCase()];
    if (hit) return hit;
  }
  return undefined;
}

export function createPackageManifest(
  project: Project,
  assetCount: number,
  exportedAt: string,
): ChronicaPackageManifest {
  return {
    format: CHRONICA_PACKAGE_FORMAT,
    version: CHRONICA_PACKAGE_VERSION,
    app: CHRONICA_PACKAGE_APP,
    exportedAt,
    title: project.title,
    gameId: project.gameId,
    storyContentHash: computeProjectContentHash(project),
    assetsManifest: [],
    assetCount,
    storySchemaVersion: project.schemaVersion,
  };
}

/** Apply forward migrations for supported legacy package versions. */
export function migratePackageManifest(manifest: ChronicaPackageManifest): ChronicaPackageManifest {
  // v1 is current — chain future version steps here.
  return manifest;
}

export function assertSupportedPackageVersion(version: number): { ok: true } | { ok: false; error: string } {
  if (version < CHRONICA_PACKAGE_VERSION_MIN || version > CHRONICA_PACKAGE_VERSION_MAX) {
    return { ok: false, error: `Unsupported package version: ${version}` };
  }
  return { ok: true };
}

/** Referenced assets that could not be resolved to a loadable URI after import hydration. */
export function findUnresolvedImportAssets(project: Project): string[] {
  const unresolved: string[] = [];
  for (const name of collectReferencedAssetNames(project)) {
    const asset = findAssetByName(project.assets, name);
    if (!asset?.uri?.trim()) {
      unresolved.push(name);
    }
  }
  return unresolved;
}

export function validatePackageManifest(data: unknown): { ok: true; manifest: ChronicaPackageManifest } | { ok: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'manifest.json is not an object.' };
  }
  const m = data as Record<string, unknown>;
  if (m.format !== CHRONICA_PACKAGE_FORMAT) {
    return { ok: false, error: 'manifest.json has invalid format.' };
  }
  if (typeof m.version !== 'number') {
    return { ok: false, error: 'manifest.json missing version.' };
  }
  const versionCheck = assertSupportedPackageVersion(m.version);
  if (!versionCheck.ok) return versionCheck;
  if (m.app !== CHRONICA_PACKAGE_APP) {
    return { ok: false, error: 'manifest.json app field is not Chronica Studio.' };
  }
  if (typeof m.exportedAt !== 'string' || !m.exportedAt) {
    return { ok: false, error: 'manifest.json missing exportedAt.' };
  }
  if (typeof m.title !== 'string' || !m.title) {
    return { ok: false, error: 'manifest.json missing title.' };
  }
  if (typeof m.gameId !== 'string' || !m.gameId) {
    return { ok: false, error: 'manifest.json missing gameId.' };
  }
  if (typeof m.assetCount !== 'number') {
    return { ok: false, error: 'manifest.json missing assetCount.' };
  }
  if (typeof m.storySchemaVersion !== 'number') {
    return { ok: false, error: 'manifest.json missing storySchemaVersion.' };
  }
  if (typeof m.storyContentHash !== 'string' || !m.storyContentHash.trim()) {
    return { ok: false, error: 'manifest.json missing storyContentHash.' };
  }
  if (!Array.isArray(m.assetsManifest)) {
    return { ok: false, error: 'manifest.json missing assetsManifest.' };
  }
  for (const item of m.assetsManifest) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'manifest.json assetsManifest has invalid entry.' };
    }
    const entry = item as Record<string, unknown>;
    if (typeof entry.path !== 'string' || !entry.path) {
      return { ok: false, error: 'manifest.json assetsManifest entry missing path.' };
    }
    if (typeof entry.size !== 'number' || entry.size < 0) {
      return { ok: false, error: `manifest.json assetsManifest entry invalid size for ${entry.path}.` };
    }
    if (typeof entry.crc32 !== 'number') {
      return { ok: false, error: `manifest.json assetsManifest entry missing crc32 for ${entry.path}.` };
    }
  }
  if (m.assetCount !== m.assetsManifest.length) {
    return {
      ok: false,
      error: 'manifest.json assetCount does not match assetsManifest length.',
    };
  }
  const manifest = migratePackageManifest(m as unknown as ChronicaPackageManifest);
  return { ok: true, manifest };
}

export function validatePackageStory(data: unknown): { ok: true; story: Project } | { ok: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'story.json is not an object.' };
  }
  const s = data as Record<string, unknown>;
  if (!s.schemaVersion) {
    return { ok: false, error: 'story.json missing schemaVersion.' };
  }
  if (!s.id || !s.title) {
    return { ok: false, error: 'story.json missing id or title.' };
  }
  if (!s.gameId || typeof s.gameId !== 'string') {
    return { ok: false, error: 'story.json missing gameId.' };
  }
  if (!Array.isArray(s.fragments)) {
    return { ok: false, error: 'story.json fragments must be an array.' };
  }
  if (!Array.isArray(s.assets)) {
    return { ok: false, error: 'story.json assets must be an array.' };
  }
  return { ok: true, story: s as unknown as Project };
}

export function findMissingPackageAssets(
  project: Project,
  fileExists: (uri: string) => boolean,
): MissingAssetReport[] {
  const referenced = collectReferencedAssetNames(project);
  const reports: MissingAssetReport[] = [];

  for (const name of referenced) {
    const refs: string[] = [];
    for (const frag of project.fragments) {
      if (frag.backgroundImage?.trim() === name) {
        refs.push(frag.title || frag.locationId);
      }
      if (frag.backgroundAudio?.trim() === name) {
        refs.push(`${frag.title || frag.locationId} (audio)`);
      }
    }
    for (const character of project.characters ?? []) {
      if (character.defaultPortrait?.trim() === name) {
        refs.push(`${character.displayName} (portrait)`);
      }
      for (const expression of character.expressions ?? []) {
        if (expression.portrait?.trim() === name) {
          refs.push(`${character.displayName} (${expression.id})`);
        }
      }
    }

    const asset = findAssetByName(project.assets, name);
    if (!asset) {
      reports.push({ name, reason: 'not-in-library', referencedBy: refs });
      continue;
    }
    if (!asset.uri?.trim()) {
      reports.push({ name, reason: 'empty-uri', referencedBy: refs });
      continue;
    }
    if (!fileExists(asset.uri)) {
      reports.push({ name, reason: 'missing-file', referencedBy: refs });
    }
  }

  return reports;
}

/** Story JSON for the package — portable asset paths, scene refs unchanged. */
export function buildPackageStory(project: Project, packagedAssets: PackageAssetFile[]): Project {
  return {
    ...project,
    schemaVersion: project.schemaVersion,
    assets: packagedAssets.map(({ asset, packagePath }) => ({
      ...asset,
      uri: packagePath,
    })),
    fragments: project.fragments.map(f => ({ ...f })),
  };
}

export function planChronicaPackage(
  project: Project,
  fileExists: (uri: string) => boolean,
  exportedAt: string,
): BuildPackagePlan {
  const missingAssets = findMissingPackageAssets(project, fileExists);
  const referenced = collectReferencedAssetNames(project);
  const assetFiles: PackageAssetFile[] = [];

  for (const name of referenced) {
    const asset = findAssetByName(project.assets, name);
    if (!asset || !asset.uri?.trim() || !fileExists(asset.uri)) continue;
    assetFiles.push({
      packagePath: packageAssetPath(asset.name),
      asset,
      sourceUri: asset.uri,
    });
  }

  const story = buildPackageStory(project, assetFiles);
  const manifest = {
    ...createPackageManifest(project, assetFiles.length, exportedAt),
    storyContentHash: computeProjectContentHash(story),
  };

  return { manifest, story, assetFiles, missingAssets };
}

export function hydrateImportedPackageProject(
  story: Project,
  localUriByPackagePath: Record<string, string>,
): Project {
  const safeName = (name: string) => sanitizePackageFilename(name);
  const assets = story.assets.map(asset => {
    const filename = safeName(asset.name);
    const pkgPath = asset.uri?.startsWith(ASSETS_PREFIX)
      ? normalizePackagePath(asset.uri)
      : packageAssetPath(asset.name);

    const localUri = lookupLocalUri(
      localUriByPackagePath,
      pkgPath,
      packageAssetPath(asset.name),
      packageAssetPath(filename),
      filename,
      asset.name,
      asset.uri ?? '',
    );

    if (localUri) {
      return { ...asset, uri: normalizeAssetUri(localUri) };
    }
    if (asset.uri && !asset.uri.startsWith(ASSETS_PREFIX)) {
      return { ...asset, uri: normalizeAssetUri(asset.uri) };
    }
    return { ...asset, uri: '' };
  });

  const knownNames = new Set(assets.map(a => a.name.toLowerCase()));
  for (const frag of story.fragments) {
    for (const ref of [frag.backgroundImage, frag.backgroundAudio]) {
      const name = ref?.trim();
      if (!name || knownNames.has(name.toLowerCase())) continue;

      const localUri = lookupLocalUri(
        localUriByPackagePath,
        packageAssetPath(name),
        packageAssetPath(safeName(name)),
        safeName(name),
        name,
      );
      if (!localUri) continue;

      assets.push({
        id: name,
        name,
        type: frag.backgroundAudio?.trim() === name ? 'audio' : 'image',
        uri: normalizeAssetUri(localUri),
        mimeType: '',
        size: 0,
        importedAt: new Date().toISOString(),
      });
      knownNames.add(name.toLowerCase());
    }
  }

  for (const character of story.characters ?? []) {
    for (const ref of [
      character.defaultPortrait,
      ...(character.expressions ?? []).map(expression => expression.portrait),
    ]) {
      const name = ref?.trim();
      if (!name || knownNames.has(name.toLowerCase())) continue;

      const localUri = lookupLocalUri(
        localUriByPackagePath,
        packageAssetPath(name),
        packageAssetPath(safeName(name)),
        safeName(name),
        name,
      );
      if (!localUri) continue;

      assets.push({
        id: name,
        name,
        type: 'image',
        uri: normalizeAssetUri(localUri),
        mimeType: '',
        size: 0,
        importedAt: new Date().toISOString(),
      });
      knownNames.add(name.toLowerCase());
    }
  }

  return {
    ...story,
    assets,
    fragments: story.fragments.map(f => ({ ...f })),
  };
}

export function isChronicaPackageBytes(data: Uint8Array): boolean {
  return data.length >= 4
    && data[0] === 0x50
    && data[1] === 0x4b
    && (data[2] === 0x03 || data[2] === 0x05 || data[2] === 0x07);
}
