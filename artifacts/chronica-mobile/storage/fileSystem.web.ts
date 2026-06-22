/**
 * Web stub for the file-system storage adapter.
 * All file operations are no-ops on web — only native (Android/iOS) has real FS.
 */
export const documentDirectory: string = '';

export async function ensureDir(_dir: string): Promise<void> {}

export async function copyFile(_from: string, _to: string): Promise<void> {}

export async function deleteFile(_uri: string): Promise<void> {}

export async function readText(_uri: string): Promise<string> {
  return '(file preview not available on web)';
}

export function assetDir(_projectId: string): string {
  return '';
}
