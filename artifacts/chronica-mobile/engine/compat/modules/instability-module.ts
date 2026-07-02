import type { ChronicaRuntimeContext } from '../context';
import type { ChronicaModule } from '../module';
import type { TurnSource } from '../types';

export const INSTABILITY_MODULE_ID = 'chronica.instability';

/**
 * Cascading reality-layer thresholds (ascending). The active layer is the
 * highest index whose threshold has been reached.
 *
 * - layer 0: `instability < 60`
 * - layer 1: `instability >= 60`
 * - layer 2: `instability >= 100`
 * - layer 3: `instability >= 150`
 */
export const DEFAULT_INSTABILITY_LAYER_THRESHOLDS: readonly number[] = [60, 100, 150];

const DEFAULT_TURN_INCREMENT = 0.5;
const DEFAULT_TURN_SOURCES: readonly TurnSource[] = ['choice', 'hotspot'];

export interface InstabilityModuleConfig {
  /** Per-turn increment applied on player-driven turns. Defaults to 0.5. */
  turnIncrement?: number;
  /**
   * Ascending reality-layer thresholds. Layer index is the count of
   * thresholds an instability value has met or exceeded.
   */
  layerThresholds?: readonly number[];
  /**
   * Which {@link TurnSource}s add the increment. Defaults to
   * `['choice', 'hotspot']` — player-driven turns only, so entry / resume /
   * dialogue advance never mutate instability on their own.
   */
  turnSources?: readonly TurnSource[];
  /** Starting instability when neither the save nor the state provides one. */
  initialInstability?: number;
}

/** Data slot the module writes into `context.moduleData`. */
export interface InstabilityData {
  instability: number;
  realityLayer: number;
}

export interface InstabilitySavePayload {
  version: 1;
  instability: number;
  realityLayer: number;
}

/** Clamp instability to its minimum (0). Exported for testing / analysis. */
export function clampInstability(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value;
}

/**
 * Reality layer for a given instability value against ascending thresholds.
 * Exported so gameplay/UI code can preview transitions without running a turn.
 */
export function computeRealityLayer(
  instability: number,
  thresholds: readonly number[] = DEFAULT_INSTABILITY_LAYER_THRESHOLDS,
): number {
  let layer = 0;
  for (const threshold of thresholds) {
    if (instability >= threshold) layer += 1;
    else break;
  }
  return layer;
}

function validatePayload(payload: unknown): InstabilitySavePayload | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const p = payload as Record<string, unknown>;
  if (p.version !== 1) return undefined;
  if (typeof p.instability !== 'number' || !Number.isFinite(p.instability)) return undefined;
  if (typeof p.realityLayer !== 'number' || !Number.isFinite(p.realityLayer)) return undefined;
  return {
    version: 1,
    instability: p.instability,
    realityLayer: p.realityLayer,
  };
}

function writeInstabilityAndLayer(
  ctx: ChronicaRuntimeContext,
  instability: number,
  realityLayer: number,
): void {
  ctx.updateState(state => {
    state.raw.instability = instability;
    state.raw.variables.instability = instability;
    state.raw.reality_layer = realityLayer;
  });
}

/**
 * First-party gameplay module that owns the instability + reality-layer
 * mechanic. Reads ChronicaState's built-in fields on initialize, applies a
 * per-turn baseline increment on player-driven turns, keeps state and module
 * data in sync, and emits `instability_changed` / `reality_layer_changed`
 * whenever the tracked values move.
 *
 * The module is fully optional. If it is not registered, ChronicaState's
 * `instability` / `reality_layer` fields still exist and can be manipulated
 * directly by fragment effects — the module just stops layering its own
 * behavior on top.
 */
export function createInstabilityModule(
  config: InstabilityModuleConfig = {},
): ChronicaModule<InstabilitySavePayload> {
  const turnIncrement = Number.isFinite(config.turnIncrement) ? config.turnIncrement! : DEFAULT_TURN_INCREMENT;
  const thresholds = config.layerThresholds ?? DEFAULT_INSTABILITY_LAYER_THRESHOLDS;
  const sources = config.turnSources ?? DEFAULT_TURN_SOURCES;
  const seedInstability = clampInstability(config.initialInstability ?? 0);

  return {
    id: INSTABILITY_MODULE_ID,

    initialize(ctx) {
      const engineInstability = clampInstability(ctx.state.instability);
      // Prefer the engine state's value (game may bootstrap non-zero); fall back
      // to the seed for tests and for games with no initial instability set.
      const instability = engineInstability > 0 ? engineInstability : seedInstability;
      const realityLayer = computeRealityLayer(instability, thresholds);
      const data: InstabilityData = { instability, realityLayer };
      ctx.setModuleData<InstabilityData>(INSTABILITY_MODULE_ID, data);
      if (instability !== ctx.state.instability || realityLayer !== ctx.state.realityLayer) {
        writeInstabilityAndLayer(ctx, instability, realityLayer);
      }
    },

    onTurnResolved(ctx, result) {
      if (!sources.includes(result.source)) return;
      const data = ctx.getModuleData<InstabilityData>(INSTABILITY_MODULE_ID);
      if (!data) return;

      const previousInstability = data.instability;
      const previousLayer = data.realityLayer;
      const nextInstability = clampInstability(previousInstability + turnIncrement);
      const nextLayer = computeRealityLayer(nextInstability, thresholds);

      data.instability = nextInstability;
      data.realityLayer = nextLayer;

      if (nextInstability !== previousInstability || nextLayer !== previousLayer) {
        writeInstabilityAndLayer(ctx, nextInstability, nextLayer);
      }
      if (nextInstability !== previousInstability) {
        ctx.bus.emit('instability_changed', {
          previous: previousInstability,
          current: nextInstability,
        });
      }
      if (nextLayer !== previousLayer) {
        ctx.bus.emit('reality_layer_changed', {
          previous: previousLayer,
          current: nextLayer,
        });
      }
    },

    onSessionSave(ctx) {
      const data = ctx.getModuleData<InstabilityData>(INSTABILITY_MODULE_ID);
      if (!data) return undefined;
      return {
        version: 1,
        instability: data.instability,
        realityLayer: data.realityLayer,
      };
    },

    onSessionLoad(ctx, payload) {
      const validated = validatePayload(payload);
      const instability = clampInstability(validated?.instability ?? seedInstability);
      const realityLayer = computeRealityLayer(instability, thresholds);
      const data: InstabilityData = { instability, realityLayer };
      ctx.setModuleData<InstabilityData>(INSTABILITY_MODULE_ID, data);
      writeInstabilityAndLayer(ctx, instability, realityLayer);
    },
  };
}
