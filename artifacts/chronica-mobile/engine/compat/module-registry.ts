import type { CompiledGame } from '../compiler/types';
import type { ChronicaState } from '../types';
import type {
  ChoiceResolvedEvent,
  HotspotResolvedEvent,
  ModuleContext,
  RuntimeModule,
  SessionResumeEvent,
  SessionStartEvent,
  TurnResolvedEvent,
} from './module';
import type { ModuleSavePayload } from './types';

/**
 * Attaches optional {@link RuntimeModule}s to a session and dispatches their
 * lifecycle hooks. The registry has no gameplay logic of its own — it only
 * routes calls so `TurnResolver` and `ChronicaSession` stay free of module
 * concerns.
 */
export class ModuleRegistry {
  private modules: RuntimeModule[] = [];
  private ctx: ModuleContext;

  constructor(game: CompiledGame, state: ChronicaState) {
    this.ctx = { game, state };
  }

  /** Refresh the shared context. Called by ChronicaSession when state or game changes. */
  setContext(game: CompiledGame, state: ChronicaState): void {
    this.ctx = { game, state };
  }

  /** Attach a module. Duplicate ids replace the earlier registration. */
  attach(module: RuntimeModule): void {
    const existing = this.modules.findIndex(m => m.id === module.id);
    if (existing >= 0) {
      const prev = this.modules[existing];
      prev.onDetach?.(this.ctx);
      this.modules[existing] = module;
    } else {
      this.modules.push(module);
    }
    module.onAttach?.(this.ctx);
  }

  detach(moduleId: string): boolean {
    const idx = this.modules.findIndex(m => m.id === moduleId);
    if (idx < 0) return false;
    const [removed] = this.modules.splice(idx, 1);
    removed.onDetach?.(this.ctx);
    return true;
  }

  clear(): void {
    for (const m of this.modules) m.onDetach?.(this.ctx);
    this.modules = [];
  }

  list(): readonly RuntimeModule[] {
    return this.modules;
  }

  has(moduleId: string): boolean {
    return this.modules.some(m => m.id === moduleId);
  }

  dispatchSessionStart(event: SessionStartEvent): void {
    for (const m of this.modules) m.onSessionStart?.(this.ctx, event);
  }

  dispatchSessionResume(event: SessionResumeEvent): void {
    for (const m of this.modules) m.onSessionResume?.(this.ctx, event);
  }

  dispatchChoiceResolved(event: ChoiceResolvedEvent): void {
    for (const m of this.modules) m.onChoiceResolved?.(this.ctx, event);
  }

  dispatchHotspotResolved(event: HotspotResolvedEvent): void {
    for (const m of this.modules) m.onHotspotResolved?.(this.ctx, event);
  }

  dispatchTurnResolved(event: TurnResolvedEvent): void {
    for (const m of this.modules) m.onTurnResolved?.(this.ctx, event);
  }

  serialize(): Record<string, ModuleSavePayload> | undefined {
    const out: Record<string, ModuleSavePayload> = {};
    let any = false;
    for (const m of this.modules) {
      if (!m.onSerialize) continue;
      const payload = m.onSerialize(this.ctx);
      if (payload === undefined) continue;
      out[m.id] = payload;
      any = true;
    }
    return any ? out : undefined;
  }

  deserialize(payloads: Record<string, ModuleSavePayload> | undefined): void {
    for (const m of this.modules) {
      if (!m.onDeserialize) continue;
      m.onDeserialize(this.ctx, payloads?.[m.id]);
    }
  }
}
