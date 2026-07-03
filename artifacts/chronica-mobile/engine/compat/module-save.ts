import type { ModuleSaveEntry, ModuleSavePayload, ModuleSavePayloads } from './types';

export type NormalizedModuleSave = {
  config?: unknown;
  data?: ModuleSavePayload;
};

function isModuleSaveEntry(value: unknown): value is ModuleSaveEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === 'string' && 'data' in entry;
}

function isConfigDataRecord(value: ModuleSavePayload): value is { config?: unknown; data: unknown } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return 'data' in value;
}

/**
 * Normalize legacy record or canonical array module payloads into a lookup map.
 * Record values may be bare data or `{ config?, data }` objects.
 */
export function normalizeModuleSavePayloads(
  payloads: ModuleSavePayloads | undefined,
): Map<string, NormalizedModuleSave> {
  const out = new Map<string, NormalizedModuleSave>();
  if (!payloads) return out;

  if (Array.isArray(payloads)) {
    for (const entry of payloads) {
      if (!isModuleSaveEntry(entry)) continue;
      out.set(entry.id, { config: entry.config, data: entry.data });
    }
    return out;
  }

  for (const [id, value] of Object.entries(payloads)) {
    if (isConfigDataRecord(value)) {
      out.set(id, { config: value.config, data: value.data });
    } else {
      out.set(id, { data: value });
    }
  }
  return out;
}

export function isModuleSaveEntryShape(value: unknown): value is ModuleSaveEntry {
  return isModuleSaveEntry(value);
}

export function isValidModuleSavePayloads(value: unknown): value is ModuleSavePayloads {
  if (value === undefined) return true;
  if (Array.isArray(value)) {
    return value.every(isModuleSaveEntry);
  }
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Find a module entry's runtime data in a compat save (array or legacy record). */
export function moduleSaveDataFromCompat(
  modules: ModuleSavePayloads | undefined,
  moduleId: string,
): ModuleSavePayload | undefined {
  return normalizeModuleSavePayloads(modules).get(moduleId)?.data;
}
