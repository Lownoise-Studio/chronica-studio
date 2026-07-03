import { ChronicaSession } from '@/engine/compat/chronica-session';
import {
  createMobileSessionFromChronicaPackage,
  type CreateMobileSessionOptions,
  type ParsedChronicaPackage,
  type UnsupportedContentReport,
} from '@/engine/compat/ingest';
import { isCanonicalSaveV2Shape } from '@/engine/compat/save-load';
import type { CanonicalSaveV2 } from '@/engine/compat/types';
import type {
  CompatibilityLevel,
  CompatibilityResult,
} from '@/engine/compat/package';

export type DevFixtureId = 'hybrid' | 'v3-compat';

export type SchemaVersionSupportLabel = 'fully-enabled' | 'known-limited' | 'unknown';

export type DevAdvanceKind = 'dialogue' | 'choice' | 'hotspot' | 'none';

export type DevSaveResumeSmokeResult =
  | { ok: true; formatVersion: number; fragmentLocationId: string | undefined }
  | { ok: false; reason: string };

/**
 * Small, display-friendly summary of what the compat pipeline decided about
 * a package. Backed by the raw {@link DevImportResult} data — the summary is
 * what a developer/debug screen renders.
 */
export interface DevImportSummary {
  title: string;
  compatibilityLevel: CompatibilityLevel;
  schemaVersionSupport: SchemaVersionSupportLabel;
  selectedRuntimeTarget: string;
  currentFragmentText: string;
  availableChoices: { uid: string; label: string }[];
  availableHotspots: { uid: string; label: string }[];
  warningsCount: number;
  saveResumeSmoke?: DevSaveResumeSmokeResult;
}

export interface DevImportResult {
  ok: boolean;
  fixtureId: DevFixtureId;
  errors: string[];
  warnings: string[];
  unsupportedContent: UnsupportedContentReport[];
  compatibility?: CompatibilityResult;
  session?: ChronicaSession;
  started: boolean;
  summary: DevImportSummary;
}

export const NO_RUNTIME_TARGET = 'none';

const DEFAULT_OPTIONS: CreateMobileSessionOptions = {
  autoStart: true,
  modules: { instability: true, echo: true },
};

export function schemaSupportLabel(
  compatibility: CompatibilityResult | undefined,
): SchemaVersionSupportLabel {
  const support = compatibility?.schemaVersionSupport;
  if (support === 'fully-enabled' || support === 'known-limited') return support;
  return 'unknown';
}

export function devInstallIdForFixture(fixtureId: DevFixtureId): string {
  return `dev-compat-${fixtureId}`;
}

/**
 * Advance dialogue, then the first visible choice, then the first hotspot.
 * Returns which interaction ran, or `none` when nothing is available.
 */
export async function advanceDevSession(session: ChronicaSession): Promise<DevAdvanceKind> {
  if (!session.isDialogueExhausted()) {
    await session.advanceDialogue();
    return 'dialogue';
  }
  const choice = session.visibleChoices[0];
  if (choice) {
    await session.choose(choice);
    return 'choice';
  }
  const hotspot = session.visibleHotspots[0];
  if (hotspot) {
    await session.activateHotspot(hotspot);
    return 'hotspot';
  }
  return 'none';
}

export function sessionHasAdvanceAction(session: ChronicaSession): boolean {
  if (!session.isDialogueExhausted()) return true;
  if (session.visibleChoices.length > 0) return true;
  if (session.visibleHotspots.length > 0) return true;
  return false;
}

/**
 * Save the live session as canonical v2, resume into a fresh session with the
 * same modules, and report whether the round-trip succeeded.
 */
export async function runCanonicalSaveResumeSmoke(
  source: ChronicaSession,
  installId: string,
): Promise<DevSaveResumeSmokeResult> {
  const save = source.toSave(installId, { format: 'canonical-v2' });
  if (!save) {
    return { ok: false, reason: 'toSave returned null' };
  }
  if (!isCanonicalSaveV2Shape(save)) {
    return { ok: false, reason: 'save is not canonical v2 shape' };
  }
  const canonical = save as CanonicalSaveV2;

  const target = new ChronicaSession(source.game);
  for (const mod of source.modules.list()) {
    target.register(mod);
  }

  const resume = await target.tryResume({ save });
  if (!resume.ok) {
    return { ok: false, reason: resume.reason };
  }

  return {
    ok: true,
    formatVersion: canonical.formatVersion,
    fragmentLocationId: target.fragment?.locationId,
  };
}

/**
 * Developer-only entry point — accepts a parsed package (or fixture), runs
 * the compat ingest + session factory, and returns the raw session together
 * with a display summary for the debug UI.
 *
 * Provisional bridge. Do not call from product code. This does not replace
 * the shipping importer or PlayerHost; it exists so developers can exercise
 * the compat pipeline in-app before the real archive reader + import UI land.
 */
export async function importChronicaPackageForDeveloper(
  pkg: ParsedChronicaPackage,
  fixtureId: DevFixtureId,
  options: CreateMobileSessionOptions = DEFAULT_OPTIONS,
): Promise<DevImportResult> {
  const outcome = await createMobileSessionFromChronicaPackage(pkg, options);
  const installId = options.installId ?? devInstallIdForFixture(fixtureId);

  if (!outcome.ok) {
    return {
      ok: false,
      fixtureId,
      errors: outcome.errors,
      warnings: outcome.warnings,
      unsupportedContent: outcome.unsupportedContent,
      compatibility: outcome.compatibility,
      session: undefined,
      started: false,
      summary: {
        title: pkg.manifest.title,
        compatibilityLevel: outcome.compatibility?.compatibilityLevel ?? 'unsupported',
        schemaVersionSupport: schemaSupportLabel(outcome.compatibility),
        selectedRuntimeTarget: NO_RUNTIME_TARGET,
        currentFragmentText: '',
        availableChoices: [],
        availableHotspots: [],
        warningsCount: outcome.warnings.length,
      },
    };
  }

  const saveResumeSmoke = await runCanonicalSaveResumeSmoke(outcome.session, installId);

  return {
    ok: true,
    fixtureId,
    errors: [],
    warnings: outcome.warnings,
    unsupportedContent: outcome.unsupportedContent,
    compatibility: outcome.compatibility,
    session: outcome.session,
    started: outcome.session.isStarted,
    summary: summarizeSession(
      outcome.session,
      outcome.compatibility,
      outcome.manifest.title,
      outcome.warnings,
      saveResumeSmoke,
    ),
  };
}

/**
 * After interaction on the session, rebuild the display summary so the
 * debug UI can re-render without re-ingesting. Pure aside from optional
 * save/resume smoke when a session is supplied for re-check.
 */
export function summarizeSession(
  session: ChronicaSession,
  compatibility: CompatibilityResult | undefined,
  manifestTitle: string,
  warnings: readonly string[],
  saveResumeSmoke?: DevSaveResumeSmokeResult,
): DevImportSummary {
  return {
    title: manifestTitle,
    compatibilityLevel: compatibility?.compatibilityLevel ?? 'unsupported',
    schemaVersionSupport: schemaSupportLabel(compatibility),
    selectedRuntimeTarget: compatibility?.selectedRuntimeTarget?.id ?? NO_RUNTIME_TARGET,
    currentFragmentText: session.fragment?.text ?? '',
    availableChoices: session.visibleChoices.map(c => ({ uid: c.uid, label: c.label })),
    availableHotspots: session.visibleHotspots.map(h => ({
      uid: h.uid,
      label: h.label?.trim() || h.uid,
    })),
    warningsCount: warnings.length,
    saveResumeSmoke,
  };
}

export async function refreshDevSummary(
  result: DevImportResult,
  installId?: string,
): Promise<DevImportSummary> {
  if (!result.session) {
    return result.summary;
  }
  const smoke = await runCanonicalSaveResumeSmoke(
    result.session,
    installId ?? devInstallIdForFixture(result.fixtureId),
  );
  return summarizeSession(
    result.session,
    result.compatibility,
    result.summary.title,
    result.warnings,
    smoke,
  );
}
