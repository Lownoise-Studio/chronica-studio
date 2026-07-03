export { ChronicaSession } from './chronica-session';
export type {
  HistoryEntry,
  SessionAdvanceDialogueResult,
  SessionChooseResult,
  SessionResumeInput,
  SessionResumeResult,
  SessionSnapshot,
  SessionToSaveInput,
} from './chronica-session';

export { ChronicaState } from './chronica-state';
export { FragmentStore } from './fragment-store';
export { TurnResolver } from './turn-resolver';
export { ExpressionEvaluator } from './expression-evaluator';
export { ActionResolver } from './action-resolver';
export { ChronicaEventBus } from './event-bus';
export { ChronicaRuntimeContext } from './context';
export { ModuleRegistry } from './module-registry';
export type { ModuleHookArgs } from './module-registry';
export {
  isModuleSaveEntryShape,
  isValidModuleSavePayloads,
  moduleSaveDataFromCompat,
  normalizeModuleSavePayloads,
} from './module-save';
export type { NormalizedModuleSave } from './module-save';

export type { ChronicaModule } from './module';

export { COMPAT_SAVE_VERSION, CANONICAL_SAVE_FORMAT_VERSION } from './types';
export type {
  CanonicalSaveV2,
  ChoiceSelectedEvent,
  CompatSave,
  LegacyModuleSaveRecord,
  ModuleErrorEvent,
  ModuleHookName,
  ModuleSaveEntry,
  ModuleSavePayload,
  ModuleSavePayloads,
  NormalizeSaveContext,
  NormalizeSaveFailureReason,
  NormalizedSaveEnvelope,
  NormalizeSaveResult,
  RuntimeEventListener,
  RuntimeEventName,
  RuntimeEventPayloads,
  RuntimeEventUnsubscribe,
  SessionSaveEnvelope,
  SessionSaveFormat,
  SessionSavedEvent,
  SessionToSaveOptions,
  TurnResult,
  TurnSource,
} from './types';

export {
  V3_COMPAT_FIXTURE_CONTENT_HASH,
  V3_COMPAT_FIXTURE_GAME_ID,
  V3_COMPAT_FIXTURE_INSTALL_ID,
  v3CompatFixtureManifest,
  v3CompatibilityFixturePackage,
} from './fixtures';

export {
  fromRuntimeSave,
  isCanonicalSaveV2Shape,
  isCompatSaveShape,
  isCompatSaveV1Shape,
  isMainFormatSaveShape,
  isRuntimeSaveV0Shape,
  normalizeSaveEnvelope,
  toRuntimeSave,
} from './save-load';

// First-party gameplay modules. Optional — attach only for games that use
// these mechanics. They compose over ChronicaSession via the standard
// ChronicaModule contract; the core TurnResolver is not modified.
export {
  DEFAULT_INSTABILITY_LAYER_THRESHOLDS,
  ECHO_MODULE_ID,
  INSTABILITY_MODULE_ID,
  clampInstability,
  computeRealityLayer,
  createEchoModule,
  createInstabilityModule,
  normalizeEcho,
} from './modules';
export type {
  EchoInstance,
  EchoModuleConfig,
  EchoSavePayload,
  EchoState,
  InstabilityData,
  InstabilityModuleConfig,
  InstabilitySavePayload,
} from './modules';

// Cross-engine package compatibility: manifest, runtime target model, and the
// validator that decides playable / limited / editor_only / unsupported.
// Kept separate from `engine/chronica-package.ts` (the ZIP/story format), and
// used by hosts that want to reason about packages before importing them.
export {
  MOBILE_PLAYER_CAPABILITIES,
  MOBILE_PLAYER_COMPATIBILITY_OPTIONS,
  MOBILE_PLAYER_TARGET,
  MOBILE_PLAYER_TARGET_ID,
  createCompatManifestFromMobileProject,
  findEntryFragmentId,
  inferMobilePlayerRuntimeTarget,
  inferProjectCapabilities,
  validateChronicaPackageCompatibility,
} from './package';
export type {
  ChronicaAssetProfile,
  ChronicaPackageManifest,
  ChronicaPresentation,
  ChronicaRuntimeTarget,
  CompatibilityLevel,
  CompatibilityOptions,
  CompatibilityResult,
  CreateCompatManifestOptions,
} from './package';

// Non-UI ingestion pipeline: takes a parsed .chronica package, validates
// mobile-player compatibility, normalizes content, compiles to CompiledGame,
// and optionally hands back a ChronicaSession with first-party modules
// attached. The real archive reader and any import UI remain out of scope.
export {
  createMobileSessionFromChronicaPackage,
  ingestChronicaPackageForMobilePlayer,
  normalizeAsset,
  normalizeCharacter,
  normalizeFragment,
} from './ingest';
export type {
  CreateMobileSessionOptions,
  IngestionFailure,
  IngestionFailureReason,
  IngestionOptions,
  IngestionResult,
  IngestionSuccess,
  MobileSessionResult,
  MobileSessionSuccess,
  ParsedChronicaPackage,
  UnsupportedContentReport,
} from './ingest';
