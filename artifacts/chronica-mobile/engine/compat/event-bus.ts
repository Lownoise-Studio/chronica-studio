import type {
  ModuleErrorEvent,
  RuntimeEventListener,
  RuntimeEventName,
  RuntimeEventPayloads,
  RuntimeEventUnsubscribe,
} from './types';

type ListenerSet<E extends RuntimeEventName> = Set<RuntimeEventListener<E>>;

/**
 * Typed pub/sub used by {@link ChronicaSession} to broadcast runtime activity.
 *
 * Listeners are invoked in registration order. A throwing listener does not
 * stop the emit loop — errors are captured and forwarded to
 * {@link ChronicaEventBus.onListenerError} so a buggy consumer can't take the
 * session down mid-turn.
 *
 * Both `on(event, handler)` (returning an unsubscribe closure) and the
 * explicit `off(event, handler)` form are supported to match the API shape
 * used by the main Chronica engine.
 */
export class ChronicaEventBus {
  private listeners: Map<RuntimeEventName, Set<(payload: unknown) => void>> = new Map();

  onListenerError: (event: RuntimeEventName, error: unknown) => void = () => {};

  on<E extends RuntimeEventName>(
    event: E,
    listener: RuntimeEventListener<E>,
  ): RuntimeEventUnsubscribe {
    let set = this.listeners.get(event) as ListenerSet<E> | undefined;
    if (!set) {
      set = new Set();
      this.listeners.set(event, set as Set<(payload: unknown) => void>);
    }
    set.add(listener);
    return () => this.off(event, listener);
  }

  off<E extends RuntimeEventName>(event: E, listener: RuntimeEventListener<E>): void {
    const set = this.listeners.get(event) as ListenerSet<E> | undefined;
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) this.listeners.delete(event);
  }

  once<E extends RuntimeEventName>(
    event: E,
    listener: RuntimeEventListener<E>,
  ): RuntimeEventUnsubscribe {
    const off = this.on(event, payload => {
      off();
      listener(payload);
    });
    return off;
  }

  emit<E extends RuntimeEventName>(event: E, payload: RuntimeEventPayloads[E]): void {
    const set = this.listeners.get(event) as ListenerSet<E> | undefined;
    if (!set || set.size === 0) return;
    // Snapshot so a listener that unsubscribes during dispatch doesn't skip peers.
    const snapshot = Array.from(set);
    for (const listener of snapshot) {
      try {
        listener(payload);
      } catch (err) {
        this.onListenerError(event, err);
      }
    }
  }

  /**
   * Convenience helper — always emits with the correct payload shape so
   * callers don't have to build the `ModuleErrorEvent` at every call site.
   */
  emitModuleError(payload: ModuleErrorEvent): void {
    this.emit('module_error', payload);
  }

  clear(): void {
    this.listeners.clear();
  }

  listenerCount<E extends RuntimeEventName>(event: E): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
