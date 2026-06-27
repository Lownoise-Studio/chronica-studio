import { resolveSceneBackgroundUri } from './asset-resolver';
import { findAssetByName } from './chronica-package';
import { evaluateCondition, resolveStatePath } from './expression-evaluator';
import type { ChronicaState, Fragment, ProjectAsset, StageActor, ValidationError } from './types';

export const DEFAULT_STAGE_ACTOR_WIDTH = 0.3;
const BOUNDS_EPSILON = 1e-6;

export type StageActorPresentation = {
  uid: string;
  label?: string;
  spriteUri?: string;
  assetName: string;
  expressionId?: string;
  x: number;
  y: number;
  width: number;
  scale: number;
  zIndex: number;
};

function fragmentMeta(fragment: Fragment) {
  return { fragmentUid: fragment.uid, fragmentTitle: fragment.title || fragment.locationId };
}

export function isValidStageActorBounds(actor: StageActor): boolean {
  const width = actor.width ?? DEFAULT_STAGE_ACTOR_WIDTH;
  const scale = actor.scale ?? 1;
  const halfW = (width * scale) / 2;
  if (![actor.x, actor.y, width, scale].every(n => typeof n === 'number' && Number.isFinite(n))) {
    return false;
  }
  if (width <= 0 || scale <= 0) return false;
  if (actor.x < 0 || actor.x > 1 || actor.y < 0 || actor.y > 1) return false;
  return actor.x - halfW >= -BOUNDS_EPSILON && actor.x + halfW <= 1 + BOUNDS_EPSILON;
}

export function resolveStageActorAssetName(actor: StageActor, state: ChronicaState): {
  assetName: string;
  expressionId?: string;
} {
  const path = actor.expressionFromVariable?.trim();
  if (path) {
    const raw = resolveStatePath(path, state);
    const expressionId = raw === undefined || raw === null ? '' : String(raw).trim();
    if (expressionId) {
      const match = actor.expressions?.find(expression => expression.id === expressionId);
      if (match?.asset?.trim()) {
        return { assetName: match.asset.trim(), expressionId };
      }
    }
  }
  return { assetName: actor.asset.trim(), expressionId: undefined };
}

export function getVisibleStageActors(fragment: Fragment, state: ChronicaState): StageActor[] {
  const actors = fragment.stageActors ?? [];
  return actors.filter(
    actor =>
      !actor.visibleWhen?.length ||
      actor.visibleWhen.every(condition => evaluateCondition(condition, state)),
  );
}

export function resolveStageActorPresentations(
  fragment: Fragment | null,
  state: ChronicaState | null,
  assets: readonly ProjectAsset[],
): StageActorPresentation[] {
  if (!fragment || !state) return [];

  return getVisibleStageActors(fragment, state)
    .map(actor => {
      const { assetName, expressionId } = resolveStageActorAssetName(actor, state);
      return {
        uid: actor.uid,
        label: actor.label,
        spriteUri: resolveSceneBackgroundUri(assets, assetName),
        assetName,
        expressionId,
        x: actor.x,
        y: actor.y,
        width: actor.width ?? DEFAULT_STAGE_ACTOR_WIDTH,
        scale: actor.scale ?? 1,
        zIndex: actor.zIndex ?? 0,
      };
    })
    .sort((a, b) => a.zIndex - b.zIndex);
}

export function validateFragmentStageActors(
  fragment: Fragment,
  assets: readonly ProjectAsset[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  const meta = fragmentMeta(fragment);

  for (const actor of fragment.stageActors ?? []) {
    const label = actor.label?.trim() || actor.uid;

    if (!actor.asset?.trim()) {
      errors.push({
        ...meta,
        type: 'invalid-stage-actor',
        message: `Stage actor "${label}" is missing a default asset`,
      });
    }
    if (!isValidStageActorBounds(actor)) {
      errors.push({
        ...meta,
        type: 'invalid-stage-actor',
        message: `Stage actor "${label}" has invalid placement (use 0–1 coordinates)`,
      });
    }
    for (const condition of actor.visibleWhen ?? []) {
      if (!condition.trim()) continue;
      // Syntax validated via isValidCondition in validateFragment
    }
    if (actor.asset?.trim() && !findAssetByName([...assets], actor.asset.trim())?.uri?.trim()) {
      errors.push({
        ...meta,
        type: 'missing-asset',
        message: `Stage actor "${label}" sprite "${actor.asset}" is not in the asset library`,
      });
    }
    for (const expression of actor.expressions ?? []) {
      if (!expression.id?.trim() || !expression.asset?.trim()) {
        errors.push({
          ...meta,
          type: 'invalid-stage-actor',
          message: `Stage actor "${label}" has an expression missing id or asset`,
        });
        continue;
      }
      if (!findAssetByName([...assets], expression.asset.trim())?.uri?.trim()) {
        errors.push({
          ...meta,
          type: 'missing-asset',
          message: `Stage actor "${label}" expression "${expression.id}" asset "${expression.asset}" is not in the asset library`,
        });
      }
    }
  }

  return errors;
}
