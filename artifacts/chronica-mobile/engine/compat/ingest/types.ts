import type { CompiledGame } from '../../compiler/types';
import type { Project, VariableValue } from '../../types';
import type { ChronicaSession } from '../chronica-session';
import type { EchoModuleConfig, InstabilityModuleConfig } from '../modules';
import type {
  ChronicaPackageManifest,
  ChronicaRuntimeTarget,
  CompatibilityOptions,
  CompatibilityResult,
} from '../package';

/**
 * Cross-runtime `.chronica` package as it enters the mobile ingestion pipeline.
 *
 * The fields are intentionally loose (`unknown[]`) so callers can hand in
 * parsed JSON straight from a package archive without having to conform to
 * mobile's exact `Fragment` / `Character` / `ProjectAsset` shapes first.
 * Normalization happens inside {@link ingestChronicaPackageForMobilePlayer}.
 */
export interface ParsedChronicaPackage {
  manifest: ChronicaPackageManifest;
  fragments: unknown[];
  characters?: unknown[];
  assets?: unknown[];
  /** Initial variable bootstrap (maps to `Project.initialVariables`). */
  variables?: Record<string, VariableValue>;
  /** Initial memory flags (maps to `Project.initialMemory`). */
  memory?: Record<string, VariableValue>;
  /**
   * Optional per-module data blob keyed by module id. First-party modules
   * (chronica.instability, chronica.echoes) may consume their entry as
   * initial config when the session factory attaches them.
   */
  modules?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface IngestionOptions {
  /** Override compat validation options. Defaults to mobile-player. */
  compatibility?: CompatibilityOptions;
  /** Local install id — becomes `Project.id`. Defaults to `manifest.packageId`. */
  installId?: string;
  /** Optional description recorded on the constructed Project. */
  description?: string;
}

export type IngestionFailureReason =
  | 'incompatible'
  | 'missing-entry-fragment'
  | 'no-fragments'
  | 'compile-failed';

export interface UnsupportedContentReport {
  kind: 'fragment' | 'choice' | 'hotspot' | 'character' | 'asset' | 'field';
  path: string;
  reason: string;
}

interface IngestionCommon {
  warnings: string[];
  unsupportedContent: UnsupportedContentReport[];
  compatibility?: CompatibilityResult;
}

export interface IngestionSuccess extends IngestionCommon {
  ok: true;
  manifest: ChronicaPackageManifest;
  compatibility: CompatibilityResult;
  selectedRuntimeTarget?: ChronicaRuntimeTarget;
  entryFragmentId: string;
  game: CompiledGame;
  project: Project;
}

export interface IngestionFailure extends IngestionCommon {
  ok: false;
  reason: IngestionFailureReason;
  errors: string[];
}

export type IngestionResult = IngestionSuccess | IngestionFailure;

// ------------------------------------------------------------------
// Session factory result shape
// ------------------------------------------------------------------

export interface CreateMobileSessionOptions extends IngestionOptions {
  /**
   * Attach first-party modules to the constructed session. Boolean
   * shortcuts use built-in defaults; passing a config object attaches with
   * that config. Package `modules[<id>]` payloads are consulted for
   * defaults when the boolean form is used.
   */
  modules?: {
    instability?: boolean | InstabilityModuleConfig;
    echo?: boolean | EchoModuleConfig;
  };
  /** Automatically call `session.start()` after registration. Default: false. */
  autoStart?: boolean;
}

export interface MobileSessionSuccess extends IngestionSuccess {
  session: ChronicaSession;
}

export type MobileSessionResult =
  | MobileSessionSuccess
  | (IngestionFailure & { session?: undefined });
