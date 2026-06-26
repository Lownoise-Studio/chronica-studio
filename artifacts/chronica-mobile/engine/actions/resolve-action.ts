import { ChronicaState } from '../types';
import { applyEffect } from '../expression-evaluator';
import { ActionStep } from './types';

function applyIncrement(path: string, amount: number, state: ChronicaState): void {
  applyEffect(`${path} += ${amount}`, state);
}

function applyAssign(path: string, rawValue: string, state: ChronicaState): void {
  applyEffect(`${path} = ${rawValue}`, state);
}

function applyStep(step: ActionStep, state: ChronicaState): void {
  switch (step.kind) {
    case 'goto':
      state.location = step.locationId;
      break;
    case 'set':
      state.memory[step.flag] = true;
      break;
    case 'clear':
      state.memory[step.flag] = false;
      break;
    case 'assign':
      applyAssign(step.path, step.rawValue, state);
      break;
    case 'increment':
      applyIncrement(step.path, step.amount, state);
      break;
  }
}

/** Execute compiled action steps against the current state (mutates state). */
export function resolveActionSteps(steps: readonly ActionStep[], state: ChronicaState): void {
  for (const step of steps) {
    applyStep(step, state);
  }
}
