import { resolveValidationSeverity } from './validation-severity';
import { aggregateProjectValidation, type ProjectValidationOptions } from './project-validation';
import type { ContractDiagnostic } from './contract-types';
import type { EditorTransactionResult } from './editor-transactions';
import {
  FOUNDATION_FEATURE_FALLBACKS,
  type FoundationFeature,
  type PackageCompatibilityResult,
} from './package-compatibility';
import type { RuntimeFallbackCode, RuntimeFallbackWarning } from './runtime-fallbacks';
import type { CompiledGame } from './compiler/types';
import type { Fragment, Project, ValidationError } from './types';

/** Canonical typed engine error codes — no uncategorized failures at boundaries. */
export const ENGINE_ERROR_CODES = [
  'ASSET_NOT_FOUND',
  'SCENE_NOT_FOUND',
  'TRANSITION_TARGET_INVALID',
  'PACKAGE_INCOMPATIBLE',
  'INVALID_PROJECT_STATE',
  'INVALID_RUNTIME_STATE',
  'FAILED_TRANSACTION',
  'VALIDATION_FAILED',
  'IMPORT_FAILED',
  'EXPORT_FAILED',
  'SAVE_CORRUPT',
  'SAVE_STALE',
  'RUNTIME_ACTION_FAILED',
  'RUNTIME_INVARIANT_VIOLATION',
  'INTERACTION_FAILED',
  'MISSING_MEDIA',
] as const;

export type EngineErrorCode = typeof ENGINE_ERROR_CODES[number];

export type DiagnosticSeverity = 'info' | 'warning' | 'error' | 'fatal';

export type DiagnosticSubsystem =
  | 'asset'
  | 'scene'
  | 'runtime'
  | 'package'
  | 'editor'
  | 'compiler'
  | 'import'
  | 'export'
  | 'transaction'
  | 'save';

export type RecoveryCategory =
  | 'auto-recovered'
  | 'safe-retry'
  | 'manual-fix'
  | 'project-repair-recommended'
  | 'cannot-continue';

export interface EngineRelatedIds {
  assetIds?: string[];
  assetNames?: string[];
  fragmentUids?: string[];
  locationIds?: string[];
  projectId?: string;
  transactionId?: string;
  gameId?: string;
  choiceUid?: string;
  interactableUid?: string;
}

export interface EngineDiagnostic {
  code: EngineErrorCode;
  severity: DiagnosticSeverity;
  subsystem: DiagnosticSubsystem;
  message: string;
  developerDetails?: string;
  recoveryHint: string;
  recoveryCategory: RecoveryCategory;
  relatedIds?: EngineRelatedIds;
  path?: string;
}

export interface DiagnosticReport {
  summary: string;
  errors: EngineDiagnostic[];
  warnings: EngineDiagnostic[];
  recoverySuggestions: string[];
  affectedAssets: string[];
  affectedScenes: string[];
  affectedPackageData: string[];
  ok: boolean;
}

const FEATURE_LABELS: Record<FoundationFeature, string> = {
  narrative_fragments: 'Narrative Scenes',
  assets: 'Asset Library',
  stage_preview: 'Stage Preview',
  adventure_runtime: 'Adventure Runtime',
  asset_recipes: 'Asset Recipes',
  playable_room_generation: 'Playable Room Generation',
};

const RUNTIME_RECOVERY_PLAYER_HINT =
  'Open with Chronica Player that supports adventure runtime and schema v3 content.';

export class EngineError extends Error {
  readonly diagnostic: EngineDiagnostic;

  constructor(diagnostic: EngineDiagnostic) {
    super(diagnostic.message);
    this.name = 'EngineError';
    this.diagnostic = diagnostic;
  }
}

export function createEngineDiagnostic(
  input: Pick<EngineDiagnostic, 'code' | 'subsystem' | 'message'> &
    Partial<Omit<EngineDiagnostic, 'code' | 'subsystem' | 'message'>>,
): EngineDiagnostic {
  return {
    severity: input.severity ?? defaultSeverityForCode(input.code),
    recoveryHint: input.recoveryHint ?? defaultRecoveryHint(input.code),
    recoveryCategory: input.recoveryCategory ?? defaultRecoveryCategory(input.code),
    developerDetails: input.developerDetails,
    relatedIds: input.relatedIds,
    path: input.path,
    ...input,
  };
}

function defaultSeverityForCode(code: EngineErrorCode): DiagnosticSeverity {
  switch (code) {
    case 'MISSING_MEDIA':
      return 'warning';
    case 'SAVE_STALE':
      return 'warning';
    default:
      return 'error';
  }
}

function defaultRecoveryCategory(code: EngineErrorCode): RecoveryCategory {
  switch (code) {
    case 'MISSING_MEDIA':
      return 'auto-recovered';
    case 'SAVE_STALE':
    case 'SAVE_CORRUPT':
      return 'safe-retry';
    case 'FAILED_TRANSACTION':
      return 'manual-fix';
    case 'PACKAGE_INCOMPATIBLE':
    case 'IMPORT_FAILED':
      return 'cannot-continue';
    case 'VALIDATION_FAILED':
    case 'INVALID_PROJECT_STATE':
      return 'project-repair-recommended';
    case 'RUNTIME_INVARIANT_VIOLATION':
    case 'INTERACTION_FAILED':
      return 'auto-recovered';
    default:
      return 'manual-fix';
  }
}

function defaultRecoveryHint(code: EngineErrorCode): string {
  switch (code) {
    case 'ASSET_NOT_FOUND':
      return 'Re-import the missing asset or update scene references in the editor.';
    case 'SCENE_NOT_FOUND':
      return 'Fix broken goto targets or restore the missing scene fragment.';
    case 'TRANSITION_TARGET_INVALID':
      return 'Update the interaction or choice to point at an existing locationId.';
    case 'PACKAGE_INCOMPATIBLE':
      return RUNTIME_RECOVERY_PLAYER_HINT;
    case 'FAILED_TRANSACTION':
      return 'Fix the reported validation issues and retry the editor action.';
    case 'IMPORT_FAILED':
      return 'Verify the package file is a valid Chronica export and retry import.';
    case 'EXPORT_FAILED':
      return 'Resolve validation or missing asset issues before exporting again.';
    case 'SAVE_CORRUPT':
      return 'Start a new play session — the save file cannot be restored.';
    case 'SAVE_STALE':
      return 'Start fresh or re-save after editing the project.';
    case 'MISSING_MEDIA':
      return 'Gameplay continues with placeholders — re-import media to restore presentation.';
    case 'RUNTIME_INVARIANT_VIOLATION':
    case 'INTERACTION_FAILED':
      return 'The action was skipped safely — refresh playtest after fixing project content.';
    default:
      return 'Review the diagnostic details and fix the underlying project content.';
  }
}

function collectAffectedIds(diagnostics: EngineDiagnostic[]): {
  affectedAssets: string[];
  affectedScenes: string[];
  affectedPackageData: string[];
} {
  const assets = new Set<string>();
  const scenes = new Set<string>();
  const packageData = new Set<string>();

  for (const item of diagnostics) {
    for (const id of item.relatedIds?.assetIds ?? []) assets.add(id);
    for (const name of item.relatedIds?.assetNames ?? []) assets.add(name);
    for (const uid of item.relatedIds?.fragmentUids ?? []) scenes.add(uid);
    for (const locationId of item.relatedIds?.locationIds ?? []) scenes.add(locationId);
    if (item.subsystem === 'package' || item.subsystem === 'import' || item.subsystem === 'export') {
      packageData.add(item.code);
    }
  }

  return {
    affectedAssets: [...assets],
    affectedScenes: [...scenes],
    affectedPackageData: [...packageData],
  };
}

function buildSummary(errors: EngineDiagnostic[], warnings: EngineDiagnostic[]): string {
  if (errors.length === 0 && warnings.length === 0) return 'No issues reported.';
  if (errors.length === 1 && warnings.length === 0) return errors[0]!.message;
  if (errors.length === 0) return `${warnings.length} warning(s) — gameplay may continue with fallbacks.`;
  const lead = errors[0]!.message;
  const extra = errors.length + warnings.length - 1;
  return extra > 0 ? `${lead} (+${extra} more issue${extra === 1 ? '' : 's'})` : lead;
}

/** Aggregate typed diagnostics into an editor-ready report. */
export function buildDiagnosticReport(diagnostics: EngineDiagnostic[]): DiagnosticReport {
  const errors = diagnostics.filter(item => item.severity === 'error' || item.severity === 'fatal');
  const warnings = diagnostics.filter(item => item.severity === 'warning' || item.severity === 'info');
  const affected = collectAffectedIds(diagnostics);
  const recoverySuggestions = [...new Set(diagnostics.map(item => item.recoveryHint))];

  return {
    summary: buildSummary(errors, warnings),
    errors,
    warnings,
    recoverySuggestions,
    ...affected,
    ok: errors.length === 0,
  };
}

/** Flatten a diagnostic report into user-facing alert text. */
export function formatDiagnosticReportMessage(report: DiagnosticReport | null | undefined): string {
  if (!report) return 'An unknown error occurred.';
  const lines = [report.summary];
  for (const item of report.errors.slice(0, 3)) {
    if (!lines.includes(item.message)) lines.push(item.message);
  }
  if (report.recoverySuggestions[0] && !lines.includes(report.recoverySuggestions[0]!)) {
    lines.push(report.recoverySuggestions[0]!);
  }
  return lines.join('\n\n');
}

function contractCodeToEngineCode(code: string): EngineErrorCode {
  switch (code) {
    case 'missing-asset':
    case 'missing-reference':
    case 'dangling-reference':
    case 'referenced-asset':
    case 'preview-dependent':
      return 'ASSET_NOT_FOUND';
    case 'missing-fragment':
    case 'missing-stage-object':
      return 'SCENE_NOT_FOUND';
    case 'duplicate-id':
    case 'duplicate-name':
    case 'rename-failed':
      return 'VALIDATION_FAILED';
    case 'apply-failed':
    case 'apply-blocked':
    case 'no-inverse':
      return 'FAILED_TRANSACTION';
    case 'generate-blocked':
      return 'VALIDATION_FAILED';
    default:
      return 'VALIDATION_FAILED';
  }
}

export function fromContractDiagnostic(
  diagnostic: ContractDiagnostic,
  overrides: Partial<EngineDiagnostic> = {},
): EngineDiagnostic {
  const code = overrides.code ?? contractCodeToEngineCode(diagnostic.code);
  return createEngineDiagnostic({
    code,
    subsystem: (diagnostic.domain as DiagnosticSubsystem) || 'editor',
    message: diagnostic.message,
    severity: diagnostic.severity === 'error' ? 'error' : diagnostic.severity === 'warning' ? 'warning' : 'info',
    path: diagnostic.path,
    developerDetails: `contract:${diagnostic.domain}/${diagnostic.code}`,
    recoveryCategory: diagnostic.severity === 'error' ? 'manual-fix' : 'auto-recovered',
    ...overrides,
  });
}

export function fromValidationError(
  error: ValidationError,
  options: { strictValidation?: boolean } = {},
): EngineDiagnostic {
  const code: EngineErrorCode =
    error.type === 'broken-link' || error.type === 'orphan-scene'
      ? 'TRANSITION_TARGET_INVALID'
      : error.type === 'missing-asset'
        ? 'ASSET_NOT_FOUND'
        : 'VALIDATION_FAILED';

  const resolved = resolveValidationSeverity(error, options);
  const severity: DiagnosticSeverity =
    resolved === 'info'
      ? 'info'
      : resolved === 'warning'
        ? 'warning'
        : 'error';

  return createEngineDiagnostic({
    code,
    subsystem: 'compiler',
    message: error.message,
    severity,
    path: error.fragmentUid,
    developerDetails: `validation:${error.type}`,
    recoveryCategory: severity === 'warning' || severity === 'info'
      ? 'auto-recovered'
      : 'project-repair-recommended',
    relatedIds: {
      fragmentUids: error.fragmentUid ? [error.fragmentUid] : undefined,
    },
  });
}

const FALLBACK_CODE_MAP: Record<RuntimeFallbackCode, EngineErrorCode> = {
  'missing-background': 'MISSING_MEDIA',
  'missing-audio': 'MISSING_MEDIA',
  'missing-player-sprite': 'MISSING_MEDIA',
  'missing-interactable-sprite': 'MISSING_MEDIA',
  'missing-sfx': 'MISSING_MEDIA',
  'missing-player-position': 'INVALID_RUNTIME_STATE',
};

export function fromRuntimeFallbackWarning(warning: RuntimeFallbackWarning): EngineDiagnostic {
  return createEngineDiagnostic({
    code: FALLBACK_CODE_MAP[warning.code],
    subsystem: 'runtime',
    message: warning.message,
    severity: 'warning',
    recoveryCategory: 'auto-recovered',
    relatedIds: warning.reference ? { assetNames: [warning.reference] } : undefined,
    developerDetails: `runtime-fallback:${warning.code}`,
  });
}

export function fromPlayerActionFailure(
  reason: string,
  message: string,
  context: EngineRelatedIds = {},
): EngineDiagnostic {
  const code: EngineErrorCode =
    reason === 'runtime-invariant'
      ? 'RUNTIME_INVARIANT_VIOLATION'
      : reason === 'dead-end'
        ? 'TRANSITION_TARGET_INVALID'
        : reason === 'not-started'
          ? 'INVALID_RUNTIME_STATE'
          : 'INTERACTION_FAILED';

  return createEngineDiagnostic({
    code,
    subsystem: 'runtime',
    message,
    severity: code === 'TRANSITION_TARGET_INVALID' ? 'warning' : 'error',
    recoveryCategory: code === 'RUNTIME_INVARIANT_VIOLATION' || code === 'INTERACTION_FAILED'
      ? 'auto-recovered'
      : 'manual-fix',
    relatedIds: context,
    developerDetails: `player-action:${reason}`,
  });
}

export function diagnoseRuntimeActionFailure(
  error: unknown,
  context: EngineRelatedIds = {},
): EngineDiagnostic {
  const message = error instanceof Error ? error.message : 'Unknown runtime error.';
  const isInvariant = error instanceof Error && error.name === 'RuntimeInvariantError';

  if (/transition|goto|destination|dead-end/i.test(message)) {
    return createEngineDiagnostic({
      code: 'TRANSITION_TARGET_INVALID',
      subsystem: 'runtime',
      message,
      recoveryCategory: 'auto-recovered',
      relatedIds: context,
      developerDetails: isInvariant ? 'RuntimeInvariantError:transition' : undefined,
    });
  }

  if (/fragment|scene/i.test(message)) {
    return createEngineDiagnostic({
      code: 'SCENE_NOT_FOUND',
      subsystem: 'runtime',
      message,
      recoveryCategory: 'auto-recovered',
      relatedIds: context,
    });
  }

  if (/interactable|hotspot|choice/i.test(message)) {
    return createEngineDiagnostic({
      code: 'INTERACTION_FAILED',
      subsystem: 'runtime',
      message,
      recoveryCategory: 'auto-recovered',
      relatedIds: context,
      developerDetails: isInvariant ? 'RuntimeInvariantError:interaction' : undefined,
    });
  }

  return fromPlayerActionFailure(
    isInvariant ? 'runtime-invariant' : 'action-failed',
    message,
    context,
  );
}

export function fromResumeRejection(
  reason: 'wrong-game' | 'stale-content' | 'corrupt-state',
  gameId?: string,
): EngineDiagnostic {
  const code: EngineErrorCode =
    reason === 'stale-content'
      ? 'SAVE_STALE'
      : reason === 'corrupt-state'
        ? 'SAVE_CORRUPT'
        : 'INVALID_RUNTIME_STATE';

  const messages: Record<typeof reason, string> = {
    'wrong-game': 'This save belongs to a different game.',
    'stale-content': 'This project was edited after your save was created.',
    'corrupt-state': 'The save data could not be read.',
  };

  return createEngineDiagnostic({
    code,
    subsystem: 'save',
    message: messages[reason],
    severity: reason === 'stale-content' ? 'warning' : 'error',
    recoveryCategory: reason === 'stale-content' ? 'safe-retry' : 'cannot-continue',
    relatedIds: gameId ? { gameId } : undefined,
    developerDetails: `resume:${reason}`,
  });
}

export function fromLoadSaveReason(
  reason: 'absent' | 'corrupt-save' | 'invalid-save' | 'storage-error',
): EngineDiagnostic | null {
  if (reason === 'absent') return null;

  const code: EngineErrorCode =
    reason === 'storage-error' ? 'INVALID_RUNTIME_STATE' : 'SAVE_CORRUPT';

  const messages: Record<Exclude<typeof reason, 'absent'>, string> = {
    'corrupt-save': 'The saved progress file is damaged and cannot be loaded.',
    'invalid-save': 'The saved progress file is not valid for this project.',
    'storage-error': 'Could not read saved progress from device storage.',
  };

  return createEngineDiagnostic({
    code,
    subsystem: 'save',
    message: messages[reason],
    recoveryCategory: reason === 'storage-error' ? 'safe-retry' : 'cannot-continue',
    developerDetails: `load-save:${reason}`,
  });
}

function featureRecoveryHint(feature: FoundationFeature): string {
  if (feature === 'adventure_runtime') {
    return RUNTIME_RECOVERY_PLAYER_HINT;
  }
  return FOUNDATION_FEATURE_FALLBACKS[feature];
}

export function fromPackageCompatibility(
  result: PackageCompatibilityResult,
  packageTitle?: string,
): EngineDiagnostic[] {
  const diagnostics: EngineDiagnostic[] = [];

  for (const feature of result.unsupportedFeatures) {
    const label = FEATURE_LABELS[feature];
    const required = result.requiredFeatures.includes(feature);
    diagnostics.push(createEngineDiagnostic({
      code: 'PACKAGE_INCOMPATIBLE',
      subsystem: 'package',
      message: required
        ? `Unsupported feature: ${label}${packageTitle ? `\nRequired by: ${packageTitle}` : ''}`
        : `Optional feature unavailable: ${label}`,
      severity: required ? 'error' : 'warning',
      recoveryCategory: required ? 'cannot-continue' : 'auto-recovered',
      recoveryHint: `Suggested recovery: ${featureRecoveryHint(feature)}`,
      developerDetails: `unsupported-feature:${feature}`,
      relatedIds: packageTitle ? { projectId: packageTitle } : undefined,
    }));
  }

  for (const blocker of result.blockers) {
    if (result.unsupportedFeatures.length > 0 &&
      blocker.includes('Required feature')) {
      continue;
    }
    diagnostics.push(createEngineDiagnostic({
      code: 'PACKAGE_INCOMPATIBLE',
      subsystem: 'package',
      message: blocker,
      recoveryCategory: 'cannot-continue',
      recoveryHint: RUNTIME_RECOVERY_PLAYER_HINT,
      developerDetails: 'compatibility-blocker',
    }));
  }

  for (const warning of result.warnings) {
    diagnostics.push(createEngineDiagnostic({
      code: 'PACKAGE_INCOMPATIBLE',
      subsystem: 'package',
      message: warning,
      severity: 'warning',
      recoveryCategory: 'auto-recovered',
      recoveryHint: 'Verify behavior — optional features may be degraded.',
      developerDetails: 'compatibility-warning',
    }));
  }

  return diagnostics;
}

export function buildPackageCompatibilityReport(
  result: PackageCompatibilityResult,
  packageTitle?: string,
): DiagnosticReport {
  return buildDiagnosticReport(fromPackageCompatibility(result, packageTitle));
}

type ImportFailureLike = {
  ok: false;
  reason: string;
  error: string;
  diagnostics?: ValidationError[];
};

export function fromPackageImportFailure(
  result: ImportFailureLike,
  packageTitle?: string,
): EngineDiagnostic[] {
  const diagnostics: EngineDiagnostic[] = [];

  if (result.reason === 'incompatible-features') {
    for (const item of result.diagnostics ?? []) {
      diagnostics.push(createEngineDiagnostic({
        code: 'PACKAGE_INCOMPATIBLE',
        subsystem: 'import',
        message: item.message,
        recoveryCategory: 'cannot-continue',
        recoveryHint: RUNTIME_RECOVERY_PLAYER_HINT,
        developerDetails: `import:${result.reason}`,
      }));
    }
    if (diagnostics.length === 0) {
      diagnostics.push(createEngineDiagnostic({
        code: 'PACKAGE_INCOMPATIBLE',
        subsystem: 'import',
        message: result.error,
        recoveryCategory: 'cannot-continue',
        recoveryHint: RUNTIME_RECOVERY_PLAYER_HINT,
        developerDetails: `import:${result.reason}`,
      }));
    }
    return diagnostics;
  }

  const cannotContinueReasons = new Set([
    'invalid-zip',
    'invalid-json',
    'missing-manifest',
    'missing-story',
    'oversized-package',
    'gameid-mismatch',
    'hash-mismatch',
    'incompatible-features',
  ]);

  diagnostics.push(createEngineDiagnostic({
    code: 'IMPORT_FAILED',
    subsystem: 'import',
    message: packageTitle
      ? `Import failed for "${packageTitle}": ${result.error}`
      : result.error,
    recoveryCategory: cannotContinueReasons.has(result.reason)
      ? 'cannot-continue'
      : 'manual-fix',
    developerDetails: `import:${result.reason}`,
  }));

  for (const item of result.diagnostics ?? []) {
    diagnostics.push(fromValidationError(item));
  }

  return diagnostics;
}

export function buildPackageImportReport(
  result: ImportFailureLike | { ok: true },
  packageTitle?: string,
): DiagnosticReport {
  if (result.ok) {
    return buildDiagnosticReport([]);
  }
  return buildDiagnosticReport(fromPackageImportFailure(result, packageTitle));
}

type ExportFailureLike = {
  ok: false;
  error: string;
  validationErrors?: ValidationError[];
};

export function fromExportFailure(result: ExportFailureLike): EngineDiagnostic[] {
  const diagnostics: EngineDiagnostic[] = [
    createEngineDiagnostic({
      code: 'EXPORT_FAILED',
      subsystem: 'export',
      message: result.error,
      recoveryCategory: 'manual-fix',
      developerDetails: 'export-blocked',
    }),
  ];

  for (const item of result.validationErrors ?? []) {
    diagnostics.push(fromValidationError(item));
  }

  return diagnostics;
}

export function buildExportFailureReport(result: ExportFailureLike): DiagnosticReport {
  return buildDiagnosticReport(fromExportFailure(result));
}

/** Diagnostic report for a rolled-back or failed editor transaction. */
export function buildEditorTransactionFailureReport(
  result: Pick<EditorTransactionResult, 'ok' | 'status' | 'label' | 'transactionId' | 'before' | 'diagnostics'>,
): DiagnosticReport {
  if (result.ok) {
    return buildDiagnosticReport([]);
  }

  const diagnostics = result.diagnostics.map(item =>
    fromContractDiagnostic(item, {
      code: 'FAILED_TRANSACTION',
      subsystem: 'transaction',
      recoveryCategory: result.status === 'failed' ? 'manual-fix' : 'safe-retry',
      recoveryHint: result.status === 'rolled_back'
        ? 'The editor rolled back your changes — fix the reported issues and try again.'
        : 'Validation blocked this action before any changes were applied.',
      relatedIds: {
        transactionId: result.transactionId,
        projectId: result.before.id,
      },
      developerDetails: `transaction:${result.status}:${item.code}`,
    }),
  );

  if (diagnostics.length === 0) {
    diagnostics.push(createEngineDiagnostic({
      code: 'FAILED_TRANSACTION',
      subsystem: 'transaction',
      message: `Editor transaction "${result.label}" failed (${result.status}).`,
      recoveryCategory: result.status === 'failed' ? 'manual-fix' : 'safe-retry',
      relatedIds: {
        transactionId: result.transactionId,
        projectId: result.before.id,
      },
    }));
  }

  return buildDiagnosticReport(diagnostics);
}

/** Diagnostic report for an integrity scan (editor asset screen / integrity panel). */
export function buildIntegrityScanReport(
  project: Project,
  options: ProjectValidationOptions = {},
): DiagnosticReport {
  const aggregate = aggregateProjectValidation(project, options);
  return buildDiagnosticReport(
    aggregate.diagnostics.map(error => fromValidationError(error, options)),
  );
}

/** Preview diagnostics that would block strict compile/export — mirrors package export gate. */
export function buildStrictCompilePreviewReport(project: Project): DiagnosticReport {
  const aggregate = aggregateProjectValidation(project, {
    strictValidation: true,
    includeEditorSupplemental: false,
  });
  return buildDiagnosticReport(
    aggregate.blockers.map(error => fromValidationError(error, { strictValidation: true })),
  );
}

/** Diagnostic report for a failed batch asset import transaction. */
export function buildBatchImportFailureReport(
  result: Pick<EditorTransactionResult, 'ok' | 'status' | 'label' | 'transactionId' | 'before' | 'diagnostics'>,
): DiagnosticReport {
  if (result.ok) {
    return buildDiagnosticReport([]);
  }

  const diagnostics = result.diagnostics.map(item =>
    fromContractDiagnostic(item, {
      code: item.severity === 'error' ? 'IMPORT_FAILED' : 'VALIDATION_FAILED',
      subsystem: 'import',
      recoveryCategory: result.status === 'failed' ? 'manual-fix' : 'safe-retry',
      recoveryHint: result.status === 'rolled_back'
        ? 'The import was rolled back — fix the reported issues and try again.'
        : 'Validation blocked the import before any assets were added.',
      relatedIds: {
        transactionId: result.transactionId,
        projectId: result.before.id,
      },
      developerDetails: `import:${result.status}:${item.code}`,
    }),
  );

  if (diagnostics.length === 0) {
    diagnostics.push(createEngineDiagnostic({
      code: 'IMPORT_FAILED',
      subsystem: 'import',
      message: `Asset import "${result.label}" failed (${result.status}).`,
      recoveryCategory: result.status === 'failed' ? 'manual-fix' : 'safe-retry',
      relatedIds: {
        transactionId: result.transactionId,
        projectId: result.before.id,
      },
    }));
  }

  return buildDiagnosticReport(diagnostics);
}

export interface EngineStateSnapshot {
  capturedAt: string;
  projectId?: string;
  gameId?: string;
  schemaVersion?: number;
  fragmentCount?: number;
  assetCount?: number;
  compileOk?: boolean;
  validationErrorCount?: number;
}

export function snapshotEngineState(input: {
  project?: Project;
  compileOk?: boolean;
  validationErrorCount?: number;
}): EngineStateSnapshot {
  return {
    capturedAt: new Date().toISOString(),
    projectId: input.project?.id,
    gameId: input.project?.gameId,
    schemaVersion: input.project?.schemaVersion,
    fragmentCount: input.project?.fragments.length,
    assetCount: input.project?.assets.length,
    compileOk: input.compileOk,
    validationErrorCount: input.validationErrorCount,
  };
}

export interface EditorTransactionSnapshot {
  capturedAt: string;
  transactionId: string;
  label: string;
  status: EditorTransactionResult['status'];
  ok: boolean;
  diagnosticSummary?: string;
  changeSummary?: string;
  projectId: string;
}

export function snapshotEditorTransaction(
  result: EditorTransactionResult,
): EditorTransactionSnapshot {
  const report = result.ok ? null : buildEditorTransactionFailureReport(result);
  return {
    capturedAt: new Date().toISOString(),
    transactionId: result.transactionId,
    label: result.label,
    status: result.status,
    ok: result.ok,
    diagnosticSummary: report?.summary,
    changeSummary: result.changeSet?.summary,
    projectId: result.before.id,
  };
}

export interface RuntimeStateSnapshot {
  capturedAt: string;
  gameId?: string;
  started: boolean;
  locationId?: string;
  fragmentUid?: string;
  fragmentTitle?: string;
  choiceCount: number;
  interactableCount: number;
  assetWarningCount: number;
  mediaFallbackCount: number;
  runtimeWarningCount: number;
}

export function snapshotRuntimeDiagnosticContext(input: {
  game?: CompiledGame;
  started: boolean;
  fragment?: Fragment | null;
  choiceCount?: number;
  interactableCount?: number;
  assetWarnings?: readonly unknown[];
  mediaFallbacks?: readonly unknown[];
  runtimeWarnings?: readonly unknown[];
}): RuntimeStateSnapshot {
  return {
    capturedAt: new Date().toISOString(),
    gameId: input.game?.gameId,
    started: input.started,
    locationId: input.fragment?.locationId,
    fragmentUid: input.fragment?.uid,
    fragmentTitle: input.fragment?.title,
    choiceCount: input.choiceCount ?? 0,
    interactableCount: input.interactableCount ?? 0,
    assetWarningCount: input.assetWarnings?.length ?? 0,
    mediaFallbackCount: input.mediaFallbacks?.length ?? 0,
    runtimeWarningCount: input.runtimeWarnings?.length ?? 0,
  };
}

/** @deprecated Use `snapshotRuntimeDiagnosticContext` — distinct from `deterministic-simulation.snapshotRuntimeState`. */
export const snapshotRuntimeState = snapshotRuntimeDiagnosticContext;

/** Classify compile result for diagnostic reporting. */
export function fromCompileFailure(
  diagnostics: ValidationError[],
  warnings: ValidationError[] = [],
): DiagnosticReport {
  return buildDiagnosticReport([
    ...diagnostics.map(error => fromValidationError(error)),
    ...warnings.map(item => fromValidationError(item)),
  ]);
}
