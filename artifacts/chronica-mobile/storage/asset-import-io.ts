import { Platform } from 'react-native';
import { unzipSync } from 'fflate';

import { createId } from '@/engine/identity';
import type { ProjectAsset } from '@/engine/types';
import {
  collectImportableAssetsFromZipMap,
  inferAssetType,
  mimeTypeForAssetFilename,
  planProjectAssetsFromImport,
  sanitizeAssetFilename,
  validateAssetImportPlan,
  type ImportableAssetFile,
} from '@/storage/asset-import';
import { assetDir, ensureDir, readBytes, toLocalFileUri, writeBytes } from '@/storage/fileSystem';
import { readPackageFileBytes } from '@/storage/read-package-file';

export type ImportAssetsResult =
  | { ok: true; assets: ProjectAsset[]; skipped: number }
  | { ok: false; error: string; cancelled?: boolean };

async function persistImportPlan(
  projectId: string,
  files: ImportableAssetFile[],
  existingNames: readonly string[],
): Promise<ProjectAsset[]> {
  const dir = assetDir(projectId);
  await ensureDir(dir);
  const { assets, destNames } = planProjectAssetsFromImport(files, existingNames, createId);

  for (let i = 0; i < files.length; i++) {
    const destUri = toLocalFileUri(`${dir}${destNames[i]}`);
    await writeBytes(destUri, files[i]!.bytes);
    assets[i]!.uri = destUri;
  }

  return assets;
}

export async function importAssetsFromZipBytes(
  projectId: string,
  bytes: Uint8Array,
  existingNames: readonly string[],
): Promise<ImportAssetsResult> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    return { ok: false, error: 'Could not read zip archive. The file may be corrupt or password-protected.' };
  }

  const plan = collectImportableAssetsFromZipMap(entries);
  const validation = validateAssetImportPlan(plan);
  if (!validation.ok) return { ok: false, error: validation.error };

  const assets = await persistImportPlan(projectId, plan.files, existingNames);
  return { ok: true, assets, skipped: plan.skipped };
}

export async function importAssetsFromFileUris(
  projectId: string,
  picks: { uri: string; name?: string | null; mimeType?: string | null; size?: number | null }[],
  existingNames: readonly string[],
): Promise<ImportAssetsResult> {
  const files: ImportableAssetFile[] = [];
  let skipped = 0;

  for (const pick of picks) {
    const rawName = pick.name?.trim() || pick.uri.split('/').pop() || 'asset';
    const name = sanitizeAssetFilename(rawName);
    const type = inferAssetType(name, pick.mimeType);
    if (!type) {
      skipped++;
      continue;
    }

    const bytes = await readBytes(pick.uri);
    files.push({
      name,
      type,
      bytes,
      mimeType: pick.mimeType ?? mimeTypeForAssetFilename(name, type),
    });
  }

  const validation = validateAssetImportPlan({ files, skipped });
  if (!validation.ok) return { ok: false, error: validation.error };

  const assets = await persistImportPlan(projectId, files, existingNames);
  return { ok: true, assets, skipped };
}

export async function pickAndImportAssetZip(
  projectId: string,
  existingNames: readonly string[],
): Promise<ImportAssetsResult> {
  if (Platform.OS === 'web') {
    return { ok: false, error: 'Zip import is not available in the web preview. Use the native mobile app.' };
  }

  const { getDocumentAsync } = await import('expo-document-picker');
  const result = await getDocumentAsync({
    type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.length) {
    return { ok: false, error: 'No file selected.', cancelled: true };
  }

  try {
    const bytes = await readPackageFileBytes(result.assets[0]!.uri);
    return importAssetsFromZipBytes(projectId, bytes, existingNames);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Could not read zip file.';
    return { ok: false, error: msg };
  }
}

export async function pickAndImportAssetFiles(
  projectId: string,
  existingNames: readonly string[],
): Promise<ImportAssetsResult> {
  if (Platform.OS === 'web') {
    return { ok: false, error: 'File import is not available in the web preview. Use the native mobile app.' };
  }

  const { getDocumentAsync } = await import('expo-document-picker');
  const result = await getDocumentAsync({
    type: ['image/*', 'audio/*', 'application/zip', 'application/x-zip-compressed'],
    copyToCacheDirectory: true,
    multiple: true,
  });

  if (result.canceled || !result.assets?.length) {
    return { ok: false, error: 'No files selected.', cancelled: true };
  }

  const zipAssets = result.assets.filter(asset => {
    const name = asset.name?.toLowerCase() ?? '';
    const mime = asset.mimeType?.toLowerCase() ?? '';
    return name.endsWith('.zip') || mime.includes('zip');
  });
  const fileAssets = result.assets.filter(asset => !zipAssets.includes(asset));

  if (zipAssets.length > 1) {
    return { ok: false, error: 'Select only one zip pack at a time.' };
  }

  if (zipAssets.length === 1 && fileAssets.length > 0) {
    return { ok: false, error: 'Import either a zip pack or individual files, not both at once.' };
  }

  if (zipAssets.length === 1) {
    try {
      const bytes = await readPackageFileBytes(zipAssets[0]!.uri);
      return importAssetsFromZipBytes(projectId, bytes, existingNames);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not read zip file.';
      return { ok: false, error: msg };
    }
  }

  try {
    return await importAssetsFromFileUris(projectId, fileAssets, existingNames);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Could not read selected files.';
    return { ok: false, error: msg };
  }
}
