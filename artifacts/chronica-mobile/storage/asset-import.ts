import { sanitizePackageFilename } from '@/engine/chronica-package';
import type { ProjectAsset } from '@/engine/types';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac']);

/** Per-file limit for a single image or audio import. */
export const MAX_ASSET_FILE_BYTES = 25 * 1024 * 1024;

/** Total bytes allowed in one zip / multi-file import batch. */
export const MAX_ASSET_BATCH_BYTES = 150 * 1024 * 1024;

/** Maximum number of assets imported in one batch. */
export const MAX_ASSET_IMPORT_COUNT = 250;

export type ImportableAssetFile = {
  name: string;
  type: 'image' | 'audio';
  bytes: Uint8Array;
  mimeType: string;
};

export type AssetImportPlan = {
  files: ImportableAssetFile[];
  skipped: number;
};

export type AssetImportValidationResult =
  | { ok: true }
  | { ok: false; error: string };

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
};

export function sanitizeAssetFilename(filename: string): string {
  const safe = sanitizePackageFilename(filename).replace(/[^\w.\- ()[\]]+/g, '_');
  return safe.trim() || 'asset';
}

export function isSkippableAssetZipEntry(path: string): boolean {
  const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.endsWith('/')) return true;
  if (normalized.includes('__MACOSX/')) return true;
  if (normalized.split('/').some(part => part.startsWith('.'))) return true;
  const base = normalized.split('/').pop()?.toLowerCase() ?? '';
  if (base === 'thumbs.db' || base === 'desktop.ini') return true;
  return false;
}

export function assetNameFromZipPath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) return 'asset';
  const fileName = parts[parts.length - 1]!;
  if (parts.length === 1) return sanitizeAssetFilename(fileName);
  const parent = parts[parts.length - 2]!;
  return sanitizeAssetFilename(`${parent}_${fileName}`);
}

export function inferAssetTypeFromFilename(filename: string): 'image' | 'audio' | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio';
  return null;
}

export function inferAssetType(filename: string, mimeType?: string | null): 'image' | 'audio' | null {
  if (mimeType?.startsWith('image/')) return 'image';
  if (mimeType?.startsWith('audio/')) return 'audio';
  return inferAssetTypeFromFilename(filename);
}

export function mimeTypeForAssetFilename(filename: string, type: 'image' | 'audio'): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? (type === 'image' ? 'image/png' : 'audio/mpeg');
}

export function uniqueAssetName(desired: string, taken: ReadonlySet<string>): string {
  const key = desired.toLowerCase();
  if (!taken.has(key)) return desired;

  const dot = desired.lastIndexOf('.');
  const stem = dot > 0 ? desired.slice(0, dot) : desired;
  const ext = dot > 0 ? desired.slice(dot) : '';

  for (let i = 2; i < 10_000; i++) {
    const candidate = `${stem}_${i}${ext}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }

  return `${stem}_copy${ext}`;
}

export function collectImportableAssetsFromZipMap(
  entries: Record<string, Uint8Array>,
): AssetImportPlan {
  const files: ImportableAssetFile[] = [];
  let skipped = 0;

  for (const [path, bytes] of Object.entries(entries)) {
    if (isSkippableAssetZipEntry(path)) {
      skipped++;
      continue;
    }

    const name = assetNameFromZipPath(path);
    const type = inferAssetTypeFromFilename(name);
    if (!type) {
      skipped++;
      continue;
    }

    files.push({
      name,
      type,
      bytes,
      mimeType: mimeTypeForAssetFilename(name, type),
    });
  }

  files.sort((a, b) => a.name.localeCompare(b.name));
  return { files, skipped };
}

export function validateAssetImportPlan(plan: AssetImportPlan): AssetImportValidationResult {
  if (plan.files.length === 0) {
    return {
      ok: false,
      error: plan.skipped > 0
        ? 'No supported image or audio files were found in this import. Use PNG, JPG, WEBP, GIF, MP3, WAV, OGG, or M4A.'
        : 'No files were found to import.',
    };
  }

  if (plan.files.length > MAX_ASSET_IMPORT_COUNT) {
    return {
      ok: false,
      error: `Too many files (${plan.files.length}). Import at most ${MAX_ASSET_IMPORT_COUNT} assets at once.`,
    };
  }

  let totalBytes = 0;
  for (const file of plan.files) {
    if (file.bytes.byteLength > MAX_ASSET_FILE_BYTES) {
      const mb = (file.bytes.byteLength / (1024 * 1024)).toFixed(1);
      const maxMb = Math.round(MAX_ASSET_FILE_BYTES / (1024 * 1024));
      return {
        ok: false,
        error: `"${file.name}" is too large (${mb} MB). Each asset must be ${maxMb} MB or smaller.`,
      };
    }
    totalBytes += file.bytes.byteLength;
  }

  if (totalBytes > MAX_ASSET_BATCH_BYTES) {
    const mb = (totalBytes / (1024 * 1024)).toFixed(1);
    const maxMb = Math.round(MAX_ASSET_BATCH_BYTES / (1024 * 1024));
    return {
      ok: false,
      error: `This import is too large (${mb} MB total). Keep batches under ${maxMb} MB.`,
    };
  }

  return { ok: true };
}

export function planProjectAssetsFromImport(
  files: ImportableAssetFile[],
  existingNames: readonly string[],
  createId: () => string,
  importedAt = new Date().toISOString(),
): { assets: ProjectAsset[]; destNames: string[] } {
  const taken = new Set(existingNames.map(name => name.toLowerCase()));
  const assets: ProjectAsset[] = [];
  const destNames: string[] = [];

  for (const file of files) {
    const name = uniqueAssetName(file.name, taken);
    taken.add(name.toLowerCase());
    destNames.push(name);
    assets.push({
      id: createId(),
      name,
      type: file.type,
      uri: '',
      mimeType: file.mimeType,
      size: file.bytes.byteLength,
      importedAt,
    });
  }

  return { assets, destNames };
}
