import type { Choice } from '../types';
import type { ChronicaRuntimeContext } from './context';
import type { ChronicaModule } from './module';
import type { ModuleHookName, ModuleSavePayload, TurnResult } from './types';

/**
 * Argument shapes each hook receives (excluding the always-first
 * {@link ChronicaRuntimeContext}). Used to make `callHook` type-safe.
 */
export type ModuleHookArgs = {
  initialize: [];
  onSessionStart: [];
  onChoiceSelected: [choice: Choice];
  onTurnResolved: [result: TurnResult];
  onSessionSave: [];
  onSessionLoad: [payload: ModuleSavePayload | undefined];
};

/**
 * Attaches optional {@link ChronicaModule}s to a session and dispatches their
 * lifecycle hooks. Hook order is deterministic (registration order); failures
 * inside one module are isolated and routed through the `module_error` event
 * so the surrounding turn is never taken down by a buggy module.
 */
export class ModuleRegistry {
  private readonly modules: ChronicaModule[] = [];
  private initializedIds: Set<string> = new Set();

  /** Register a module. Duplicate ids replace the earlier registration. */
  register(module: ChronicaModule): void {
    const existingIdx = this.modules.findIndex(m => m.id === module.id);
    if (existingIdx >= 0) {
      this.modules[existingIdx] = module;
      this.initializedIds.delete(module.id);
    } else {
      this.modules.push(module);
    }
  }

  unregister(moduleId: string): boolean {
    const idx = this.modules.findIndex(m => m.id === moduleId);
    if (idx < 0) return false;
    this.modules.splice(idx, 1);
    this.initializedIds.delete(moduleId);
    return true;
  }

  has(moduleId: string): boolean {
    return this.modules.some(m => m.id === moduleId);
  }

  list(): readonly ChronicaModule[] {
    return this.modules;
  }

  clear(): void {
    this.modules.length = 0;
    this.initializedIds.clear();
  }

  /** Run `initialize` on every module that has not been initialized yet. */
  async initializeAll(ctx: ChronicaRuntimeContext): Promise<void> {
    for (const module of this.modules) {
      if (this.initializedIds.has(module.id)) continue;
      await this.safeInvoke(module, 'initialize', ctx, () => module.initialize(ctx));
      this.initializedIds.add(module.id);
    }
  }

  /**
   * Generic dispatch entry point matching the main engine's
   * `callHook(name, context, ...args)` shape.
   */
  async callHook<K extends ModuleHookName>(
    name: K,
    ctx: ChronicaRuntimeContext,
    ...args: ModuleHookArgs[K]
  ): Promise<void> {
    for (const module of this.modules) {
      const hook = module[name] as
        | ((ctx: ChronicaRuntimeContext, ...args: unknown[]) => unknown | Promise<unknown>)
        | undefined;
      if (!hook) continue;
      await this.safeInvoke(module, name, ctx, () => hook.call(module, ctx, ...args));
    }
  }

  /**
   * Serialize every module that provides {@link ChronicaModule.onSessionSave}.
   * Returns undefined when no module contributed a payload — keeps legacy
   * save envelopes clean.
   */
  saveAll(ctx: ChronicaRuntimeContext): Record<string, ModuleSavePayload> | undefined {
    const out: Record<string, ModuleSavePayload> = {};
    let any = false;
    for (const module of this.modules) {
      if (!module.onSessionSave) continue;
      try {
        const payload = module.onSessionSave(ctx);
        if (payload === undefined) continue;
        out[module.id] = payload;
        any = true;
      } catch (error) {
        ctx.bus.emitModuleError({ moduleId: module.id, hook: 'onSessionSave', error });
      }
    }
    return any ? out : undefined;
  }

  /**
   * Distribute save payloads to every module that opted into onSessionLoad.
   * Modules that supplied a payload get it; others get undefined so they can
   * reset state or fall back to defaults.
   */
  async loadAll(
    ctx: ChronicaRuntimeContext,
    payloads: Record<string, ModuleSavePayload> | undefined,
  ): Promise<void> {
    for (const module of this.modules) {
      if (!module.onSessionLoad) continue;
      await this.safeInvoke(module, 'onSessionLoad', ctx, () =>
        module.onSessionLoad!(ctx, payloads?.[module.id]),
      );
    }
  }

  /**
   * Invoke a module hook and translate any exception (sync or async) into a
   * `module_error` event. Never throws.
   */
  private async safeInvoke(
    module: ChronicaModule,
    hook: ModuleHookName,
    ctx: ChronicaRuntimeContext,
    call: () => unknown | Promise<unknown>,
  ): Promise<void> {
    try {
      const result = call();
      if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
        await (result as Promise<unknown>);
      }
    } catch (error) {
      ctx.bus.emitModuleError({ moduleId: module.id, hook, error });
    }
  }
}
