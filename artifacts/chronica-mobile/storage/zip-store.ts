/**
 * Minimal ZIP read/write (STORE / no compression only).
 * Zero external dependencies — sufficient for .chronica packages.
 */

import { crc32 } from '@/engine/crc32';

export { crc32 };

export interface ZipEntry {
  path: string;
  data: Uint8Array;
}

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

function readUint16(view: DataView, offset: number) {
  return view.getUint16(offset, true);
}

function readUint32(view: DataView, offset: number) {
  return view.getUint32(offset, true);
}

export function normalizeZipPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^\.\//, '');
}

export function encodeZip(entries: ZipEntry[]): Uint8Array {
  const normalized = entries.map(e => ({
    path: normalizeZipPath(e.path),
    data: e.data,
  }));

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of normalized) {
    const nameBytes = new TextEncoder().encode(entry.path);
    const checksum = crc32(entry.data);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(localHeader.buffer);
    writeUint32(view, 0, SIG_LOCAL);
    writeUint16(view, 4, 20);
    writeUint16(view, 6, 0);
    writeUint16(view, 8, 0);
    writeUint16(view, 10, 0);
    writeUint16(view, 12, 0);
    writeUint32(view, 14, checksum);
    writeUint32(view, 18, entry.data.length);
    writeUint32(view, 22, entry.data.length);
    writeUint16(view, 26, nameBytes.length);
    writeUint16(view, 28, 0);
    localHeader.set(nameBytes, 30);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cview = new DataView(centralHeader.buffer);
    writeUint32(cview, 0, SIG_CENTRAL);
    writeUint16(cview, 4, 20);
    writeUint16(cview, 6, 20);
    writeUint16(cview, 8, 0);
    writeUint16(cview, 10, 0);
    writeUint16(cview, 12, 0);
    writeUint16(cview, 14, 0);
    writeUint32(cview, 16, checksum);
    writeUint32(cview, 20, entry.data.length);
    writeUint32(cview, 24, entry.data.length);
    writeUint16(cview, 28, nameBytes.length);
    writeUint16(cview, 30, 0);
    writeUint16(cview, 32, 0);
    writeUint16(cview, 34, 0);
    writeUint16(cview, 36, 0);
    writeUint32(cview, 38, 0);
    writeUint32(cview, 42, offset);
    centralHeader.set(nameBytes, 46);

    localParts.push(localHeader, entry.data);
    centralParts.push(centralHeader);
    offset += localHeader.length + entry.data.length;
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const eocd = new Uint8Array(22);
  const eview = new DataView(eocd.buffer);
  writeUint32(eview, 0, SIG_EOCD);
  writeUint16(eview, 4, 0);
  writeUint16(eview, 6, 0);
  writeUint16(eview, 8, normalized.length);
  writeUint16(eview, 10, normalized.length);
  writeUint32(eview, 12, centralSize);
  writeUint32(eview, 16, offset);
  writeUint16(eview, 20, 0);

  const total = offset + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const part of localParts) {
    out.set(part, pos);
    pos += part.length;
  }
  for (const part of centralParts) {
    out.set(part, pos);
    pos += part.length;
  }
  out.set(eocd, pos);
  return out;
}

export function decodeZip(data: Uint8Array): ZipEntry[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let eocdOffset = -1;
  for (let i = data.length - 22; i >= 0; i--) {
    if (readUint32(view, i) === SIG_EOCD) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error('Invalid ZIP: end of central directory not found');

  const entryCount = readUint16(view, eocdOffset + 10);
  const centralOffset = readUint32(view, eocdOffset + 16);
  const entries: ZipEntry[] = [];
  let pos = centralOffset;

  for (let i = 0; i < entryCount; i++) {
    if (readUint32(view, pos) !== SIG_CENTRAL) {
      throw new Error('Invalid ZIP: bad central directory entry');
    }
    const compression = readUint16(view, pos + 10);
    if (compression !== 0) {
      throw new Error(`Unsupported ZIP compression method: ${compression}`);
    }
    const checksum = readUint32(view, pos + 16);
    const compSize = readUint32(view, pos + 20);
    const uncompSize = readUint32(view, pos + 24);
    const nameLen = readUint16(view, pos + 28);
    const extraLen = readUint16(view, pos + 30);
    const commentLen = readUint16(view, pos + 32);
    const localOffset = readUint32(view, pos + 42);
    const nameBytes = data.subarray(pos + 46, pos + 46 + nameLen);
    const path = new TextDecoder().decode(nameBytes);
    pos += 46 + nameLen + extraLen + commentLen;

    if (readUint32(view, localOffset) !== SIG_LOCAL) {
      throw new Error('Invalid ZIP: bad local file header');
    }
    const localNameLen = readUint16(view, localOffset + 26);
    const localExtraLen = readUint16(view, localOffset + 28);
    const fileStart = localOffset + 30 + localNameLen + localExtraLen;
    const fileData = data.subarray(fileStart, fileStart + uncompSize);

    if (fileData.length !== uncompSize || compSize !== uncompSize) {
      throw new Error(`ZIP size mismatch for ${path}`);
    }
    if (crc32(fileData) !== checksum) {
      throw new Error(`ZIP checksum mismatch for ${path}`);
    }

    entries.push({ path: normalizeZipPath(path), data: fileData });
  }

  return entries;
}

export function zipEntryMap(entries: ZipEntry[]): Map<string, Uint8Array> {
  const map = new Map<string, Uint8Array>();
  for (const e of entries) {
    map.set(e.path, e.data);
  }
  return map;
}

export function getZipBinaryFile(map: Map<string, Uint8Array>, path: string): Uint8Array | undefined {
  const normalized = normalizeZipPath(path);
  const direct = map.get(normalized);
  if (direct) return direct;
  for (const [key, data] of map) {
    const entryPath = normalizeZipPath(key);
    if (entryPath === normalized || entryPath.toLowerCase() === normalized.toLowerCase()) {
      return data;
    }
  }
  return undefined;
}

export function getZipTextFile(map: Map<string, Uint8Array>, path: string): string | null {
  const data = getZipBinaryFile(map, path);
  if (!data) return null;
  return new TextDecoder().decode(data);
}
