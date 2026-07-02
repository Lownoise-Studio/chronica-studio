export { ChronicaSession } from './chronica-session';
export type {
  HistoryEntry,
  SessionAdvanceDialogueResult,
  SessionChooseResult,
  SessionResumeInput,
  SessionResumeResult,
  SessionSnapshot,
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

export type { ChronicaModule } from './module';

export { COMPAT_SAVE_VERSION } from './types';
export type {
  CompatSave,
  ModuleErrorEvent,
  ModuleHookName,
  ModuleSavePayload,
  RuntimeEventListener,
  RuntimeEventName,
  RuntimeEventPayloads,
  RuntimeEventUnsubscribe,
  SessionSavedEvent,
  TurnResult,
  TurnSource,
} from './types';

export {
  fromRuntimeSave,
  isCompatSaveShape,
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
