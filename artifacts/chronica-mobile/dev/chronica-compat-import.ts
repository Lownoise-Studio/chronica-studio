import type { ChronicaSession } from '@/engine/compat/chronica-session';
import {
  createMobileSessionFromChronicaPackage,
  type CreateMobileSessionOptions,
  type ParsedChronicaPackage,
  type UnsupportedContentReport,
} from '@/engine/compat/ingest';
import type {
  CompatibilityLevel,
  CompatibilityResult,
} from '@/engine/compat/package';

/**
 * Small, display-friendly summary of what the compat pipeline decided about
 * a package. Backed by the raw {@link DevImportResult} data — the summary is
 * what a developer/debug screen renders.
 */
export interface DevImportSummary {
  title: string;
  compatibilityLevel: CompatibilityLevel;
  selectedRuntimeTarget: string;
  currentFragmentText: string;
  availableChoices: { uid: string; label: string }[];
  warningsCount: number;
}

export interface DevImportResult {
  ok: boolean;
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
  options: CreateMobileSessionOptions = DEFAULT_OPTIONS,
): Promise<DevImportResult> {
  const outcome = await createMobileSessionFromChronicaPackage(pkg, options);

  if (!outcome.ok) {
    return {
      ok: false,
      errors: outcome.errors,
      warnings: outcome.warnings,
      unsupportedContent: outcome.unsupportedContent,
      compatibility: outcome.compatibility,
      session: undefined,
      started: false,
      summary: {
        title: pkg.manifest.title,
        compatibilityLevel: outcome.compatibility?.compatibilityLevel ?? 'unsupported',
        selectedRuntimeTarget: NO_RUNTIME_TARGET,
        currentFragmentText: '',
        availableChoices: [],
        warningsCount: outcome.warnings.length,
      },
    };
  }

  return {
    ok: true,
    errors: [],
    warnings: outcome.warnings,
    unsupportedContent: outcome.unsupportedContent,
    compatibility: outcome.compatibility,
    session: outcome.session,
    started: outcome.session.isStarted,
    summary: {
      title: outcome.manifest.title,
      compatibilityLevel: outcome.compatibility.compatibilityLevel,
      selectedRuntimeTarget: outcome.selectedRuntimeTarget?.id ?? NO_RUNTIME_TARGET,
      currentFragmentText: outcome.session.fragment?.text ?? '',
      availableChoices: outcome.session.visibleChoices.map(c => ({ uid: c.uid, label: c.label })),
      warningsCount: outcome.warnings.length,
    },
  };
}

/**
 * After a choice runs on the session, rebuild the display summary so the
 * debug UI can re-render without re-ingesting. Pure — no session mutation.
 */
export function summarizeSession(
  session: ChronicaSession,
  compatibility: CompatibilityResult | undefined,
  manifestTitle: string,
  warningsCount: number,
): DevImportSummary {
  return {
    title: manifestTitle,
    compatibilityLevel: compatibility?.compatibilityLevel ?? 'unsupported',
    selectedRuntimeTarget: compatibility?.selectedRuntimeTarget?.id ?? NO_RUNTIME_TARGET,
    currentFragmentText: session.fragment?.text ?? '',
    availableChoices: session.visibleChoices.map(c => ({ uid: c.uid, label: c.label })),
    warningsCount,
  };
}
