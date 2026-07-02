import type { ChronicaRuntimeContext } from '../context';
import type { ChronicaModule } from '../module';
import { INSTABILITY_MODULE_ID, type InstabilityData } from './instability-module';

export const ECHO_MODULE_ID = 'chronica.echoes';

export type EchoState = 'Dormant' | 'Active' | 'Manifested' | 'Resolved';

/**
 * Single echo — carries both its authored definition (thresholds, attachment
 * hints) and its runtime state so save/load round-trips are a straight copy.
 */
export interface EchoInstance {
  id: string;
  attachedFragmentId?: string;
  attachedRoomId?: string;
  state: EchoState;
  activationThreshold: number;
  manifestationThreshold: number;
  resolved: boolean;
}

export interface EchoModuleConfig {
  /**
   * Initial echo definitions. Missing fields (`state`, `resolved`) are
   * defaulted to `Dormant` / `false`; missing thresholds default to 0 so an
   * echo without a threshold never activates on its own.
   */
  echoes?: readonly Partial<EchoInstance>[];
}

export interface EchoSavePayload {
  version: 1;
  echoes: EchoInstance[];
}

const VALID_STATES: readonly EchoState[] = ['Dormant', 'Active', 'Manifested', 'Resolved'];

function isValidState(value: unknown): value is EchoState {
  return typeof value === 'string' && (VALID_STATES as readonly string[]).includes(value);
}

/**
 * Normalize a partial echo definition into a full {@link EchoInstance}.
 * Missing fields fall back to safe defaults. If `resolved` is true, the
 * runtime state snaps to `Resolved` — the resolved flag always wins over a
 * conflicting saved state.
 */
export function normalizeEcho(seed: Partial<EchoInstance>): EchoInstance {
  const id = typeof seed.id === 'string' && seed.id.length ? seed.id : '';
  const resolved = seed.resolved === true;
  const state: EchoState = resolved
    ? 'Resolved'
    : isValidState(seed.state)
      ? seed.state
      : 'Dormant';
  const activationThreshold = Number.isFinite(seed.activationThreshold as number)
    ? (seed.activationThreshold as number)
    : 0;
  const manifestationThreshold = Number.isFinite(seed.manifestationThreshold as number)
    ? (seed.manifestationThreshold as number)
    : 0;
  return {
    id,
    attachedFragmentId: typeof seed.attachedFragmentId === 'string' ? seed.attachedFragmentId : undefined,
    attachedRoomId: typeof seed.attachedRoomId === 'string' ? seed.attachedRoomId : undefined,
    state,
    activationThreshold,
    manifestationThreshold,
    resolved,
  };
}

function readInstability(ctx: ChronicaRuntimeContext): number {
  const data = ctx.getModuleData<InstabilityData>(INSTABILITY_MODULE_ID);
  if (data && Number.isFinite(data.instability)) return data.instability;
  // Fallback: game may drive instability through fragment effects even without
  // the InstabilityModule attached.
  return Number.isFinite(ctx.state.instability) ? ctx.state.instability : 0;
}

function validatePayload(payload: unknown): EchoSavePayload | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const p = payload as Record<string, unknown>;
  if (p.version !== 1) return undefined;
  if (!Array.isArray(p.echoes)) return undefined;
  const echoes: EchoInstance[] = [];
  for (const raw of p.echoes) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== 'string' || !r.id.length) continue;
    echoes.push(normalizeEcho(r as Partial<EchoInstance>));
  }
  return { version: 1, echoes };
}

/**
 * First-party gameplay module that tracks Echo lifecycle. Reads the current
 * instability (from {@link InstabilityData} if the InstabilityModule is
 * attached; otherwise falls back to `state.instability`) and advances echoes
 * through Dormant → Active → Manifested transitions when their thresholds
 * are met. Resolved echoes are locked and never reactivate.
 *
 * All runtime data lives in {@link ChronicaRuntimeContext.moduleData} under
 * the module id so save/load is a straight snapshot of the same array.
 */
export function createEchoModule(config: EchoModuleConfig = {}): ChronicaModule<EchoSavePayload> {
  const seeds: readonly Partial<EchoInstance>[] = config.echoes ?? [];

  function seedEchoes(): EchoInstance[] {
    return seeds.map(seed => normalizeEcho(seed));
  }

  return {
    id: ECHO_MODULE_ID,

    initialize(ctx) {
      ctx.setModuleData<EchoInstance[]>(ECHO_MODULE_ID, seedEchoes());
    },

    onTurnResolved(ctx) {
      const echoes = ctx.getModuleData<EchoInstance[]>(ECHO_MODULE_ID);
      if (!echoes || !echoes.length) return;

      const instability = readInstability(ctx);

      for (const echo of echoes) {
        if (echo.resolved) continue;
        const previousState = echo.state;

        // Cascade through thresholds so a single big instability jump can
        // move Dormant → Active → Manifested in one pass.
        if (echo.state === 'Dormant' && instability >= echo.activationThreshold) {
          echo.state = 'Active';
        }
        if (echo.state === 'Active' && instability >= echo.manifestationThreshold) {
          echo.state = 'Manifested';
        }

        if (echo.state !== previousState) {
          ctx.bus.emit('echo_state_changed', {
            echoId: echo.id,
            previousState,
            currentState: echo.state,
          });
        }
      }
    },

    onSessionSave(ctx) {
      const echoes = ctx.getModuleData<EchoInstance[]>(ECHO_MODULE_ID);
      if (!echoes) return undefined;
      return {
        version: 1,
        echoes: echoes.map(echo => ({ ...echo })),
      };
    },

    onSessionLoad(ctx, payload) {
      const validated = validatePayload(payload);
      const echoes = validated ? validated.echoes : seedEchoes();
      ctx.setModuleData<EchoInstance[]>(ECHO_MODULE_ID, echoes);
    },
  };
}
