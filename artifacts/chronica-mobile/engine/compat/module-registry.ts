import type { Choice } from '../types';
import type { ChronicaRuntimeContext } from './context';
import type { ChronicaModule } from './module';
import { normalizeModuleSavePayloads } from './module-save';
import type {
  ModuleHookName,
  ModuleSaveEntry,
  ModuleSavePayload,
  ModuleSavePayloads,
  TurnResult,
} from './types';

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
  onSessionSaveConfig: [];
  onSessionLoad: [payload: ModuleSavePayload | undefined];
  onSessionLoadConfig: [config: unknown];
};

type RegisteredModule = {
  module: ChronicaModule;
  /** Stable slot used to break priority ties. */
  registrationIndex: number;
};

function modulePriority(module: ChronicaModule): number {
  return module.priority ?? 0;
}

/**
 * Attaches optional {@link ChronicaModule}s to a session and dispatches their
 * lifecycle hooks. Hook order is deterministic (priority ASC, then
 * registration order); failures inside one module are isolated and routed
 * through the `module_error` event so the surrounding turn is never taken
 * down by a buggy module.
 */
export class ModuleRegistry {
  private readonly modules: RegisteredModule[] = [];
  private nextRegistrationIndex = 0;
  private initializedIds: Set<string> = new Set();

  /** Register a module. Duplicate ids replace the earlier registration. */
  register(module: ChronicaModule): void {
    const existingIdx = this.modules.findIndex(entry => entry.module.id === module.id);
    if (existingIdx >= 0) {
      const registrationIndex = this.modules[existingIdx].registrationIndex;
      this.modules[existingIdx] = { module, registrationIndex };
      this.initializedIds.delete(module.id);
    } else {
      this.modules.push({ module, registrationIndex: this.nextRegistrationIndex++ });
    }
  }

  unregister(moduleId: string): boolean {
    const idx = this.modules.findIndex(entry => entry.module.id === moduleId);
    if (idx < 0) return false;
    this.modules.splice(idx, 1);
    this.initializedIds.delete(moduleId);
    return true;
  }

  has(moduleId: string): boolean {
    return this.modules.some(entry => entry.module.id === moduleId);
  }

  list(): readonly ChronicaModule[] {
    return this.modules.map(entry => entry.module);
  }

  clear(): void {
    this.modules.length = 0;
    this.nextRegistrationIndex = 0;
    this.initializedIds.clear();
  }

  /** Run `initialize` on every module that has not been initialized yet. */
  async initializeAll(ctx: ChronicaRuntimeContext): Promise<void> {
    for (const module of this.orderedModules()) {
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
    for (const module of this.orderedModules()) {
      const hook = module[name] as
        | ((ctx: ChronicaRuntimeContext, ...args: unknown[]) => unknown | Promise<unknown>)
        | undefined;
      if (!hook) continue;
      await this.safeInvoke(module, name, ctx, () => hook.call(module, ctx, ...args));
    }
  }

  /**
   * Serialize every module that provides save hooks. Returns canonical
   * {@link ModuleSaveEntry} rows (`id`, optional `config`, `data`). Returns
   * undefined when no module contributed a payload.
   */
  saveAll(ctx: ChronicaRuntimeContext): ModuleSaveEntry[] | undefined {
    const entries: ModuleSaveEntry[] = [];
    for (const module of this.orderedModules()) {
      if (!module.onSessionSave && !module.onSessionSaveConfig) continue;

      let config: unknown;
      let data: unknown;

      if (module.onSessionSaveConfig) {
        try {
          config = module.onSessionSaveConfig(ctx);
        } catch (error) {
          ctx.bus.emitModuleError({ moduleId: module.id, hook: 'onSessionSaveConfig', error });
        }
      }
      if (module.onSessionSave) {
        try {
          data = module.onSessionSave(ctx);
        } catch (error) {
          ctx.bus.emitModuleError({ moduleId: module.id, hook: 'onSessionSave', error });
        }
      }

      if (config === undefined && data === undefined) continue;

      const entry: ModuleSaveEntry = {
        id: module.id,
        data: data ?? {},
      };
      if (config !== undefined) entry.config = config;
      entries.push(entry);
    }
    return entries.length > 0 ? entries : undefined;
  }

  /**
   * Distribute save payloads to every module that opted into load hooks.
   * Accepts legacy record (`modules[id] = data`) or canonical entry arrays.
   * Applies `config` before `data` when present.
   */
  async loadAll(
    ctx: ChronicaRuntimeContext,
    payloads: ModuleSavePayloads | undefined,
  ): Promise<void> {
    const normalized = normalizeModuleSavePayloads(payloads);
    for (const module of this.orderedModules()) {
      const saved = normalized.get(module.id);

      if (module.onSessionLoadConfig && saved?.config !== undefined) {
        await this.safeInvoke(module, 'onSessionLoadConfig', ctx, () =>
          module.onSessionLoadConfig!(ctx, saved.config),
        );
      }

      if (module.onSessionLoad) {
        await this.safeInvoke(module, 'onSessionLoad', ctx, () =>
          module.onSessionLoad!(ctx, saved?.data),
        );
      }
    }
  }

  private orderedModules(): ChronicaModule[] {
    return [...this.modules]
      .sort((a, b) => {
        const priorityDelta = modulePriority(a.module) - modulePriority(b.module);
        if (priorityDelta !== 0) return priorityDelta;
        return a.registrationIndex - b.registrationIndex;
      })
      .map(entry => entry.module);
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
