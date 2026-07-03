import type { RuntimeSave } from '@/runtime/chronica-runtime';
import { normalizeModuleSavePayloads } from './module-save';
import {
  CANONICAL_SAVE_FORMAT_VERSION,
  COMPAT_SAVE_VERSION,
  type CompatSave,
  type LegacyModuleSaveRecord,
  type ModuleSaveEntry,
  type NormalizeSaveContext,
  type NormalizedSaveEnvelope,
  type NormalizeSaveResult,
} from './types';

export type {
  NormalizeSaveContext,
  NormalizedSaveEnvelope,
  NormalizeSaveResult,
} from './types';
export { CANONICAL_SAVE_FORMAT_VERSION } from './types';

type RawSave = Record<string, unknown>;

/**
 * Structural check for a compat save envelope. Depth checks (gameId /
 * contentHash match, module payload usability) happen at
 * {@link ChronicaSession.tryResume} time via {@link normalizeSaveEnvelope}.
 */
export function isCompatSaveShape(value: unknown): value is CompatSave {
  if (!value || typeof value !== 'object') return false;
  const v = value as RawSave;
  return (
    v.compatVersion === COMPAT_SAVE_VERSION &&
    typeof v.projectId === 'string' &&
    typeof v.gameId === 'string' &&
    typeof v.contentHash === 'string' &&
    !!v.state &&
    typeof v.state === 'object' &&
    Array.isArray(v.history) &&
    isLegacyOrArrayModules(v.modules)
  );
}

function isLegacyOrArrayModules(modules: unknown): boolean {
  if (modules === undefined) return true;
  if (Array.isArray(modules)) return true;
  return typeof modules === 'object' && modules !== null && !Array.isArray(modules);
}

function isRuntimeSaveShape(value: unknown): value is RuntimeSave {
  if (!value || typeof value !== 'object') return false;
  const v = value as RawSave;
  return (
    !('formatVersion' in v) &&
    !('format_version' in v) &&
    !('compatVersion' in v) &&
    typeof v.projectId === 'string' &&
    typeof v.gameId === 'string' &&
    typeof v.contentHash === 'string' &&
    !!v.state &&
    typeof v.state === 'object' &&
    Array.isArray(v.history) &&
    typeof v.savedAt === 'string'
  );
}

function normalizeModulesField(modules: unknown): ModuleSaveEntry[] | undefined {
  if (modules === undefined) return undefined;

  if (Array.isArray(modules)) {
    const entries: ModuleSaveEntry[] = [];
    for (const raw of modules) {
      if (!raw || typeof raw !== 'object') continue;
      const entry = raw as RawSave;
      const id =
        typeof entry.id === 'string'
          ? entry.id
          : typeof entry.name === 'string'
            ? entry.name
            : null;
      if (!id) continue;
      const normalized: ModuleSaveEntry = {
        id,
        data: 'data' in entry ? entry.data : {},
      };
      if (entry.config !== undefined) normalized.config = entry.config;
      entries.push(normalized);
    }
    return entries.length > 0 ? entries : undefined;
  }

  if (typeof modules === 'object' && modules !== null) {
    const map = normalizeModuleSavePayloads(modules as LegacyModuleSaveRecord);
    if (map.size === 0) return undefined;
    return [...map.entries()].map(([id, { config, data }]) => {
      const entry: ModuleSaveEntry = { id, data: data ?? {} };
      if (config !== undefined) entry.config = config;
      return entry;
    });
  }

  return undefined;
}

function normalizeSavedAt(v: RawSave): string | null {
  if (typeof v.savedAt === 'string' && v.savedAt.trim()) return v.savedAt;
  const unix = v.saved_at_unix;
  if (typeof unix === 'number' && Number.isFinite(unix)) {
    return new Date(unix * 1000).toISOString();
  }
  return null;
}

function normalizeHistory(v: RawSave): { locationId: string; title: string }[] {
  if (!Array.isArray(v.history)) return [];
  return v.history.filter(
    (entry): entry is { locationId: string; title: string } =>
      !!entry &&
      typeof entry === 'object' &&
      typeof (entry as RawSave).locationId === 'string' &&
      typeof (entry as RawSave).title === 'string',
  );
}

function resolveIdentity(
  v: RawSave,
  context: NormalizeSaveContext | undefined,
  warnings: string[],
):
  | { ok: true; gameId: string; contentHash: string }
  | Extract<NormalizeSaveResult, { ok: false }> {
  const embeddedGameId = typeof v.gameId === 'string' ? v.gameId.trim() : '';
  const embeddedContentHash = typeof v.contentHash === 'string' ? v.contentHash.trim() : '';

  if (!embeddedGameId || !embeddedContentHash) {
    if (!context?.gameId?.trim() || !context?.contentHash?.trim()) {
      return {
        ok: false,
        reason: 'missing-identity',
        message: 'Save lacks gameId/contentHash and no caller context was supplied',
      };
    }
    warnings.push('Save identity filled from caller context (main-format or incomplete envelope)');
    return { ok: true, gameId: context.gameId, contentHash: context.contentHash };
  }

  if (context) {
    if (embeddedGameId !== context.gameId) {
      return { ok: false, reason: 'wrong-game' };
    }
    if (embeddedContentHash !== context.contentHash) {
      return { ok: false, reason: 'stale-content' };
    }
  }

  return { ok: true, gameId: embeddedGameId, contentHash: embeddedContentHash };
}

/**
 * Normalize any recognized save envelope into the canonical internal shape.
 * Validates identity against optional {@link NormalizeSaveContext} when present.
 */
export function normalizeSaveEnvelope(
  input: unknown,
  context?: NormalizeSaveContext,
): NormalizeSaveResult {
  if (!input || typeof input !== 'object') {
    return { ok: false, reason: 'corrupt-state', message: 'Save is not an object' };
  }

  const v = input as RawSave;
  const warnings: string[] = [];

  if (!v.state || typeof v.state !== 'object') {
    return { ok: false, reason: 'corrupt-state', message: 'Missing state payload' };
  }

  const savedAt = normalizeSavedAt(v);
  if (!savedAt) {
    return { ok: false, reason: 'corrupt-state', message: 'Missing savedAt or saved_at_unix' };
  }

  const identity = resolveIdentity(v, context, warnings);
  if (!identity.ok) return identity;
  const { gameId, contentHash } = identity;

  const projectId =
    typeof v.projectId === 'string' && v.projectId.trim()
      ? v.projectId
      : context?.projectId?.trim() ?? '';

  if (!projectId) {
    warnings.push('Save projectId missing; using empty string');
  }

  const envelope: NormalizedSaveEnvelope = {
    formatVersion: CANONICAL_SAVE_FORMAT_VERSION,
    projectId,
    gameId,
    contentHash,
    savedAt,
    state: v.state as Record<string, unknown>,
    history: normalizeHistory(v),
    modules: normalizeModulesField(v.modules),
  };

  const fragmentId =
    typeof v.fragmentId === 'string' && v.fragmentId.trim() ? v.fragmentId : undefined;
  if (fragmentId) envelope.fragmentId = fragmentId;

  return { ok: true, envelope, warnings };
}

/**
 * Adapt a legacy {@link RuntimeSave} (produced by ChronicaRuntime.toSave) into
 * the compat envelope. Legacy saves have no per-module payloads and no
 * `fragmentId`; both fields are simply omitted.
 */
export function fromRuntimeSave(save: RuntimeSave): CompatSave {
  return {
    compatVersion: COMPAT_SAVE_VERSION,
    projectId: save.projectId,
    gameId: save.gameId,
    contentHash: save.contentHash,
    state: save.state,
    history: [...save.history],
    savedAt: save.savedAt,
  };
}

/**
 * Reduce a compat save back to the shape ChronicaRuntime already understands.
 * Module payloads and fragmentId are dropped — legacy runtime does not know
 * about either.
 */
export function toRuntimeSave(save: CompatSave): RuntimeSave {
  return {
    projectId: save.projectId,
    gameId: save.gameId,
    contentHash: save.contentHash,
    state: save.state,
    history: [...save.history],
    savedAt: save.savedAt,
  };
}

/** @internal Exported for tests — detects RuntimeSave v0 without envelope version. */
export function isRuntimeSaveV0Shape(value: unknown): value is RuntimeSave {
  return isRuntimeSaveShape(value);
}

/** @internal Exported for tests — detects CompatSave v1. */
export function isCompatSaveV1Shape(value: unknown): value is CompatSave {
  return isCompatSaveShape(value);
}

/** @internal Exported for tests — detects main-engine format_version saves. */
export function isMainFormatSaveShape(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const v = value as RawSave;
  return v.format_version === CANONICAL_SAVE_FORMAT_VERSION || v.format_version === 2;
}

/** @internal Exported for tests — detects canonical formatVersion saves. */
export function isCanonicalSaveV2Shape(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const v = value as RawSave;
  return v.formatVersion === CANONICAL_SAVE_FORMAT_VERSION;
}
