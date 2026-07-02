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
export { ModuleRegistry } from './module-registry';

export type {
  ChoiceResolvedEvent,
  HotspotResolvedEvent,
  ModuleContext,
  RuntimeModule,
  SessionResumeEvent,
  SessionStartEvent,
  TurnResolvedEvent,
} from './module';

export {
  COMPAT_SAVE_VERSION,
} from './types';
export type {
  CompatSave,
  ModuleSavePayload,
  RuntimeEventListener,
  RuntimeEventName,
  RuntimeEventPayloads,
  RuntimeEventUnsubscribe,
  TurnSource,
} from './types';

export {
  fromRuntimeSave,
  isCompatSaveShape,
  toRuntimeSave,
} from './save-load';
