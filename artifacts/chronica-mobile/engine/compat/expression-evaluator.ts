import {
  applyEffect,
  evaluateCondition,
  getConditionParts,
  getEffectTarget,
  isValidCondition,
  isValidEffect,
  parseLiteralValue,
  resolveStatePath,
} from '../expression-evaluator';
import type { ChronicaState, VariableValue } from '../types';

/**
 * Class facade mirroring the Godot engine's ExpressionEvaluator. Wraps the
 * existing pure functions — kept pure inside; the class is only a namespaced
 * surface so compat consumers can hold a single object.
 */
export class ExpressionEvaluator {
  evaluate(expression: string, state: ChronicaState): boolean {
    return evaluateCondition(expression, state);
  }

  applyEffect(expression: string, state: ChronicaState): void {
    applyEffect(expression, state);
  }

  resolvePath(path: string, state: ChronicaState): VariableValue {
    return resolveStatePath(path, state);
  }

  isValidCondition(expression: string): boolean {
    return isValidCondition(expression);
  }

  isValidEffect(expression: string): boolean {
    return isValidEffect(expression);
  }

  getConditionParts(expression: string): { path: string; op: string; rhs: string } | null {
    return getConditionParts(expression);
  }

  getEffectTarget(expression: string): string | null {
    return getEffectTarget(expression);
  }

  parseLiteral(raw: string): VariableValue {
    return parseLiteralValue(raw);
  }
}
