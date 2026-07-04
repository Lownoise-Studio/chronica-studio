import { serializeState } from './chronica-session';
import { buildCompiledGame } from './compiler/build-compiled-game';
import type { CompiledGame } from './compiler/types';
import {
  buildContractResult,
  contractError,
  type ContractValidationResult,
} from './contract-types';
import type { ChronicaState, Project } from './types';
import { ChronicaRuntime, type RuntimeSave } from '../runtime/chronica-runtime';

export type RuntimeInput =
  | { type: 'choose'; choiceUid: string }
  | { type: 'activateHotspot'; hotspotUid: string }
  | { type: 'activateInteractable'; interactableUid: string }
  | { type: 'movePlayer'; dx: number; dy: number; seconds: number }
  | { type: 'advanceDialogue' };

/** Normalized runtime state snapshot for deterministic comparisons. */
export function snapshotRuntimeState(state: ChronicaState | null): Record<string, unknown> | null {
  if (!state) return null;
  return JSON.parse(serializeState(state));
}

function applyInput(runtime: ChronicaRuntime, input: RuntimeInput): void {
  switch (input.type) {
    case 'choose': {
      const choice = runtime.visibleChoices.find(entry => entry.uid === input.choiceUid);
      if (!choice) throw new Error(`Choice "${input.choiceUid}" is not visible`);
      runtime.choose(choice);
      return;
    }
    case 'activateHotspot': {
      const hotspot = runtime.visibleHotspots.find(entry => entry.uid === input.hotspotUid);
      if (!hotspot) throw new Error(`Hotspot "${input.hotspotUid}" is not visible`);
      runtime.activateHotspot(hotspot);
      return;
    }
    case 'activateInteractable': {
      const interactable = runtime.visibleInteractables.find(entry => entry.uid === input.interactableUid);
      if (!interactable) throw new Error(`Interactable "${input.interactableUid}" is not visible`);
      runtime.activateInteractable(interactable);
      return;
    }
    case 'movePlayer':
      runtime.movePlayerByDelta(input.dx, input.dy, input.seconds);
      return;
    case 'advanceDialogue':
      runtime.advanceDialogue();
      return;
    default: {
      const _exhaustive: never = input;
      throw new Error(`Unsupported runtime input: ${String(_exhaustive)}`);
    }
  }
}

/** Replay a deterministic input sequence against a compiled game. */
export function replayRuntimeInputs(
  game: CompiledGame,
  inputs: readonly RuntimeInput[],
  save?: RuntimeSave,
): ChronicaRuntime {
  const runtime = new ChronicaRuntime(game);
  if (save) {
    const resumed = runtime.tryResume(save);
    if (!resumed.ok) throw new Error(`Could not resume save: ${resumed.reason}`);
  } else {
    runtime.start();
  }

  for (const input of inputs) {
    applyInput(runtime, input);
  }
  return runtime;
}

export interface DeterministicReplayResult {
  equal: boolean;
  first: Record<string, unknown> | null;
  second: Record<string, unknown> | null;
  validation: ContractValidationResult;
}

/** Prove identical project + inputs (+ optional save) produce identical runtime state. */
export function assertDeterministicReplay(
  project: Project,
  inputs: readonly RuntimeInput[],
  save?: RuntimeSave,
): DeterministicReplayResult {
  const gameA = buildCompiledGame(project);
  const gameB = buildCompiledGame(project);
  const runtimeA = replayRuntimeInputs(gameA, inputs, save);
  const runtimeB = replayRuntimeInputs(gameB, inputs, save);

  const first = snapshotRuntimeState(runtimeA.runtimeState);
  const second = snapshotRuntimeState(runtimeB.runtimeState);
  const equal = JSON.stringify(first) === JSON.stringify(second);

  return {
    equal,
    first,
    second,
    validation: buildContractResult(
      equal
        ? []
        : [contractError('determinism', 'state-diverged', 'Repeated replay produced different runtime state.')],
    ),
  };
}
