import { normalizeAssetUri } from './asset-resolver';
import { collectPackageAssetNames, packagePathForAsset } from './model-assets';
import { computeProjectContentHash } from './compiler/build-compiled-game';
import {
  CHRONICA_SCHEMA_VERSION_KNOWN_MAX,
  CHRONICA_SCHEMA_VERSION_MIN,
} from './schema-versions';
import { crc32 } from './crc32';
import { Project, ProjectAsset } from './types';

export const CHRONICA_PACKAGE_FORMAT = 'chronica-package';
export const CHRONICA_PACKAGE_VERSION = 1;
/** Lowest package format version this build can import. */
export const CHRONICA_PACKAGE_VERSION_MIN = 1;
/** Highest package format version this build can import without migration. */
export const CHRONICA_PACKAGE_VERSION_MAX = 1;
export const CHRONICA_PACKAGE_APP = 'Chronica Studio';

/**
 * Story schemaVersion bounds for the ZIP importer (`parseChronicaPackage`).
 * Accepts all **known** spec revisions (currently 1–3). Compat ingest applies
 * a stricter "fully enabled" ceiling — see `schema-versions.ts`.
 */
export const PACKAGE_SCHEMA_VERSION_MIN = CHRONICA_SCHEMA_VERSION_MIN;
export const PACKAGE_SCHEMA_VERSION_MAX = CHRONICA_SCHEMA_VERSION_KNOWN_MAX;

export const MANIFEST_PATH = 'manifest.json';
export const STORY_PATH = 'story.json';
export const ASSETS_PREFIX = 'assets/';

/**
 * Defensive ceilings for package import. These are not tight budgets — they
 * exist to stop a corrupt/hostile package from exhausting memory or storage
 * before the integrity checks run. Surfaced as typed oversized-* failures.
 */
export const PACKAGE_LIMITS = {
  /** Whole .chronica archive. */
  maxPackageBytes: 256 * 1024 * 1024,
  /** A single embedded asset file. */
  maxAssetBytes: 64 * 1024 * 1024,
  /** Number of embedded asset files. */
  maxAssetCount: 2000,
  /** story.json text. */
  maxStoryJsonBytes: 16 * 1024 * 1024,
  /** manifest.json text. */
  maxManifestJsonBytes: 4 * 1024 * 1024,
} as const;

/** Typed, user-facing reasons for a package import failure. Never raw exceptions. */
export type PackageImportReason =
  | 'invalid-zip'
  | 'oversized-package'
  | 'oversized-asset'
  | 'missing-manifest'
  | 'missing-story'
  | 'duplicate-manifest'
  | 'duplicate-story'
  | 'duplicate-asset-path'
  | 'path-traversal'
  | 'unexpected-entry'
  | 'invalid-json'
  | 'invalid-manifest'
  | 'unsupported-package-version'
  | 'invalid-story'
  | 'unsupported-schema-version'
  | 'gameid-mismatch'
  | 'hash-mismatch'
  | 'missing-asset'
  | 'corrupt-asset'
  | 'compile-failed'
  | 'incompatible-features';

export type PackageImportFailure = { ok: false; reason: PackageImportReason; error: string };

function fail(reason: PackageImportReason, error: string): PackageImportFailure {
  return { ok: false, reason, error };
}

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

export interface PackageEntryLike {
  path: string;
  data: Uint8Array;
}

function hasPathTraversal(path: string): boolean {
  return path.split('/').some(seg => seg === '..');
}

/**
 * Structural validation of raw ZIP entries before any hydration:
 * required single manifest/story, no duplicate paths, no path traversal,
 * no unexpected entries, and per-entry/aggregate size ceilings.
 *
 * Policy: every entry must be exactly manifest.json, story.json, or a file
 * under assets/. Anything else (top-level junk, executables, absolute paths
 * that normalized to an unexpected root) is rejected as unexpected-entry.
 */
export function validatePackageEntryStructure(
  entries: ReadonlyArray<PackageEntryLike>,
): { ok: true } | PackageImportFailure {
  let manifestCount = 0;
  let storyCount = 0;
  let assetCount = 0;
  const seen = new Set<string>();

  for (const entry of entries) {
    const path = normalizePackagePath(entry.path);
    if (!path || path.endsWith('/')) continue; // skip directory markers

    if (hasPathTraversal(path)) {
      return fail('path-traversal', `Package entry escapes the archive root: "${entry.path}".`);
    }

    const key = path.toLowerCase();
    if (seen.has(key)) {
      if (path === MANIFEST_PATH) return fail('duplicate-manifest', 'Package contains more than one manifest.json.');
      if (path === STORY_PATH) return fail('duplicate-story', 'Package contains more than one story.json.');
      return fail('duplicate-asset-path', `Package contains a duplicate entry path: "${path}".`);
    }
    seen.add(key);

    if (path === MANIFEST_PATH) {
      manifestCount++;
      if (entry.data.length > PACKAGE_LIMITS.maxManifestJsonBytes) {
        return fail('oversized-package', 'manifest.json exceeds the maximum allowed size.');
      }
    } else if (path === STORY_PATH) {
      storyCount++;
      if (entry.data.length > PACKAGE_LIMITS.maxStoryJsonBytes) {
        return fail('oversized-package', 'story.json exceeds the maximum allowed size.');
      }
    } else if (path.startsWith(ASSETS_PREFIX)) {
      assetCount++;
      if (entry.data.length > PACKAGE_LIMITS.maxAssetBytes) {
        return fail('oversized-asset', `Embedded asset exceeds the maximum allowed size: "${path}".`);
      }
    } else {
      return fail('unexpected-entry', `Package contains an unexpected entry: "${path}".`);
    }
  }

  if (manifestCount === 0) return fail('missing-manifest', 'Package missing manifest.json.');
  if (storyCount === 0) return fail('missing-story', 'Package missing story.json.');
  if (assetCount > PACKAGE_LIMITS.maxAssetCount) {
    return fail('oversized-package', `Package contains too many assets (${assetCount} > ${PACKAGE_LIMITS.maxAssetCount}).`);
  }
  return { ok: true };
}

/** Asset files present in the ZIP but absent from the manifest's assetsManifest. */
export function findUnlistedPackageAssets(
  entries: ReadonlyArray<PackageEntryLike>,
  assetsManifest: readonly PackageAssetManifestEntry[],
): string[] {
  const listed = new Set(assetsManifest.map(e => normalizePackagePath(e.path).toLowerCase()));
  const unlisted: string[] = [];
  for (const entry of entries) {
    const path = normalizePackagePath(entry.path);
    if (!path.startsWith(ASSETS_PREFIX) || path.endsWith('/')) continue;
    if (!listed.has(path.toLowerCase())) unlisted.push(path);
  }
  return unlisted;
}

export function collectReferencedAssetNames(project: Project): string[] {
  return collectPackageAssetNames(project);
}

export function findAssetByName(assets: ProjectAsset[], name: string): ProjectAsset | undefined {
  const trimmed = name.trim();
  return assets.find(a => a.name === trimmed)
    ?? assets.find(a => a.name.toLowerCase() === trimmed.toLowerCase());
}

export function packageAssetPath(filename: string, type?: ProjectAsset['type']): string {
  if (type === 'model') return packagePathForAsset({ name: filename, type: 'model' });
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

export function assertSupportedPackageVersion(version: number): { ok: true } | PackageImportFailure {
  if (version < CHRONICA_PACKAGE_VERSION_MIN || version > CHRONICA_PACKAGE_VERSION_MAX) {
    return fail(
      'unsupported-package-version',
      `Unsupported package version ${version}. This build supports ${CHRONICA_PACKAGE_VERSION_MIN}–${CHRONICA_PACKAGE_VERSION_MAX}.`,
    );
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

export const DEFAULT_PACKAGE_TITLE = 'Untitled Story';

export function validatePackageManifest(data: unknown): { ok: true; manifest: ChronicaPackageManifest } | PackageImportFailure {
  if (!data || typeof data !== 'object') {
    return fail('invalid-manifest', 'manifest.json is not an object.');
  }
  const m = data as Record<string, unknown>;
  if (m.format !== CHRONICA_PACKAGE_FORMAT) {
    return fail('invalid-manifest', 'manifest.json has invalid format.');
  }
  if (typeof m.version !== 'number') {
    return fail('invalid-manifest', 'manifest.json missing version.');
  }
  const versionCheck = assertSupportedPackageVersion(m.version);
  if (!versionCheck.ok) return versionCheck;
  if (m.app !== CHRONICA_PACKAGE_APP) {
    return fail('invalid-manifest', 'manifest.json app field is not Chronica Studio.');
  }
  if (typeof m.exportedAt !== 'string' || !m.exportedAt) {
    return fail('invalid-manifest', 'manifest.json missing exportedAt.');
  }
  // Title is non-critical metadata: default it rather than reject the package.
  const title = typeof m.title === 'string' && m.title.trim() ? m.title : DEFAULT_PACKAGE_TITLE;
  if (typeof m.gameId !== 'string' || !m.gameId) {
    return fail('invalid-manifest', 'manifest.json missing gameId.');
  }
  if (typeof m.assetCount !== 'number') {
    return fail('invalid-manifest', 'manifest.json missing assetCount.');
  }
  if (typeof m.storySchemaVersion !== 'number') {
    return fail('invalid-manifest', 'manifest.json missing storySchemaVersion.');
  }
  if (typeof m.storyContentHash !== 'string' || !m.storyContentHash.trim()) {
    return fail('invalid-manifest', 'manifest.json missing storyContentHash.');
  }
  if (!Array.isArray(m.assetsManifest)) {
    return fail('invalid-manifest', 'manifest.json missing assetsManifest.');
  }
  const seenPaths = new Set<string>();
  for (const item of m.assetsManifest) {
    if (!item || typeof item !== 'object') {
      return fail('invalid-manifest', 'manifest.json assetsManifest has invalid entry.');
    }
    const entry = item as Record<string, unknown>;
    if (typeof entry.path !== 'string' || !entry.path) {
      return fail('invalid-manifest', 'manifest.json assetsManifest entry missing path.');
    }
    const normalizedPath = normalizePackagePath(entry.path).toLowerCase();
    if (seenPaths.has(normalizedPath)) {
      return fail('duplicate-asset-path', `manifest.json lists a duplicate asset path: ${entry.path}.`);
    }
    seenPaths.add(normalizedPath);
    if (typeof entry.size !== 'number' || entry.size < 0) {
      return fail('invalid-manifest', `manifest.json assetsManifest entry invalid size for ${entry.path}.`);
    }
    if (typeof entry.crc32 !== 'number') {
      return fail('invalid-manifest', `manifest.json assetsManifest entry missing crc32 for ${entry.path}.`);
    }
  }
  if (m.assetCount !== m.assetsManifest.length) {
    return fail('invalid-manifest', 'manifest.json assetCount does not match assetsManifest length.');
  }
  // Unknown future fields are preserved harmlessly via the cast — never rejected.
  const manifest = migratePackageManifest({ ...(m as unknown as ChronicaPackageManifest), title });
  return { ok: true, manifest };
}

export function validatePackageStory(data: unknown): { ok: true; story: Project } | PackageImportFailure {
  if (!data || typeof data !== 'object') {
    return fail('invalid-story', 'story.json is not an object.');
  }
  const s = data as Record<string, unknown>;
  if (typeof s.schemaVersion !== 'number') {
    return fail('invalid-story', 'story.json missing schemaVersion.');
  }
  if (s.schemaVersion < PACKAGE_SCHEMA_VERSION_MIN || s.schemaVersion > PACKAGE_SCHEMA_VERSION_MAX) {
    return fail(
      'unsupported-schema-version',
      `Unsupported story schema version ${s.schemaVersion}. This build supports ${PACKAGE_SCHEMA_VERSION_MIN}–${PACKAGE_SCHEMA_VERSION_MAX}.`,
    );
  }
  if (!s.id || !s.title) {
    return fail('invalid-story', 'story.json missing id or title.');
  }
  if (!s.gameId || typeof s.gameId !== 'string') {
    return fail('invalid-story', 'story.json missing gameId.');
  }
  if (!Array.isArray(s.fragments)) {
    return fail('invalid-story', 'story.json fragments must be an array.');
  }
  if (!Array.isArray(s.assets)) {
    return fail('invalid-story', 'story.json assets must be an array.');
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
      packagePath: packagePathForAsset(asset),
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
      : packagePathForAsset(asset);

    const localUri = lookupLocalUri(
      localUriByPackagePath,
      pkgPath,
      packagePathForAsset(asset),
      packageAssetPath(asset.name, asset.type),
      packageAssetPath(filename, asset.type),
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

  for (const frag of story.fragments) {
    for (const actor of frag.stageActors ?? []) {
      for (const ref of [
        actor.asset,
        ...(actor.expressions ?? []).map(expression => expression.asset),
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
