import {
  AdventureCollider,
  AdventureEntry,
  AdventureInteractable,
  ChronicaState,
  Fragment,
  SceneAdventure,
} from './types';
import { evaluateCondition } from './expression-evaluator';

export const DEFAULT_INTERACTABLE_RADIUS = 0.08;
export const DEFAULT_INTERACTABLE_WIDTH = 0.08;
export const DEFAULT_PLAYER_WIDTH = 0.09;
export const DEFAULT_ADVENTURE_SPEED = 0.35;
export const DEFAULT_ADVENTURE_ASPECT = 16 / 9;
export const DEFAULT_ENTRY_POINT = { x: 0.5, y: 0.75 };

/** Fixed collision inflation around the player feet so sprites don't clip walls visually. */
const PLAYER_COLLIDER_HALF = 0.025;

function getAdventure(fragment: Fragment | null | undefined): SceneAdventure | undefined {
  return fragment?.adventure;
}

function hasAdventure(fragment: Fragment | null | undefined): boolean {
  return !!fragment?.adventure;
}

export function getVisibleInteractables(
  fragment: Fragment,
  state: ChronicaState,
): AdventureInteractable[] {
  const list = fragment.adventure?.interactables ?? [];
  return list.filter(
    interactable =>
      !interactable.conditions?.length ||
      interactable.conditions.every(c => evaluateCondition(c, state)),
  );
}

function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function collidesAt(
  x: number,
  y: number,
  adventure: SceneAdventure,
  solidInteractables: AdventureInteractable[],
): boolean {
  const px = x - PLAYER_COLLIDER_HALF;
  const py = y - PLAYER_COLLIDER_HALF;
  const pw = PLAYER_COLLIDER_HALF * 2;
  const ph = PLAYER_COLLIDER_HALF * 2;
  for (const c of adventure.colliders ?? []) {
    if (rectsOverlap(px, py, pw, ph, c.x, c.y, c.width, c.height)) return true;
  }
  for (const s of solidInteractables) {
    const w = s.width ?? DEFAULT_INTERACTABLE_WIDTH;
    const half = w / 2;
    if (rectsOverlap(px, py, pw, ph, s.x - half, s.y - half, w, w)) return true;
  }
  return false;
}

export interface MovePlayerResult {
  x: number;
  y: number;
  moved: boolean;
  blocked: boolean;
}

/** Attempt to move the player by (dx, dy), sliding on collisions. */
export function movePlayer(
  fragment: Fragment,
  state: ChronicaState,
  dx: number,
  dy: number,
): MovePlayerResult {
  const adventure = fragment.adventure;
  const start = getPlayerPosition(state);
  if (!adventure) {
    return { x: start.x, y: start.y, moved: false, blocked: true };
  }
  const solid = getVisibleInteractables(fragment, state).filter(i => i.solid);
  let x = start.x;
  let y = start.y;
  let blocked = false;

  const clampX = (v: number) => Math.max(PLAYER_COLLIDER_HALF, Math.min(1 - PLAYER_COLLIDER_HALF, v));
  const clampY = (v: number) => Math.max(PLAYER_COLLIDER_HALF, Math.min(1 - PLAYER_COLLIDER_HALF, v));

  if (dx !== 0) {
    const nextX = clampX(x + dx);
    if (!collidesAt(nextX, y, adventure, solid)) {
      x = nextX;
    } else {
      blocked = true;
    }
  }
  if (dy !== 0) {
    const nextY = clampY(y + dy);
    if (!collidesAt(x, nextY, adventure, solid)) {
      y = nextY;
    } else {
      blocked = true;
    }
  }
  const moved = x !== start.x || y !== start.y;
  return { x, y, moved, blocked };
}

/** Return the player position, defaulting to the entry point of the current adventure fragment. */
export function getPlayerPosition(state: ChronicaState): { x: number; y: number } {
  const x = typeof state.playerX === 'number' ? state.playerX : DEFAULT_ENTRY_POINT.x;
  const y = typeof state.playerY === 'number' ? state.playerY : DEFAULT_ENTRY_POINT.y;
  return { x, y };
}

/** Compute the spawn position for a fragment given the location the player is coming from. */
export function resolveEntryPoint(
  entry: AdventureEntry | undefined,
  fromLocationId: string | undefined,
): { x: number; y: number } {
  if (!entry) return DEFAULT_ENTRY_POINT;
  if (fromLocationId && entry.from) {
    const override = entry.from[fromLocationId];
    if (override && Number.isFinite(override.x) && Number.isFinite(override.y)) {
      return { x: override.x, y: override.y };
    }
  }
  return entry.default ?? DEFAULT_ENTRY_POINT;
}

/** Return the closest interactable within its own radius, if any. */
export function findInteractableInRange(
  interactables: AdventureInteractable[],
  x: number,
  y: number,
): AdventureInteractable | null {
  let best: AdventureInteractable | null = null;
  let bestDist = Infinity;
  for (const i of interactables) {
    const radius = i.radius ?? DEFAULT_INTERACTABLE_RADIUS;
    const dx = i.x - x;
    const dy = i.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 <= radius * radius && d2 < bestDist) {
      best = i;
      bestDist = d2;
    }
  }
  return best;
}

/** True if two 0-1 rectangles overlap; useful for future editor validation. */
export function colliderOverlapsBounds(collider: AdventureCollider): boolean {
  const { x, y, width, height } = collider;
  return x >= 0 && y >= 0 && width > 0 && height > 0 && x + width <= 1 + 1e-6 && y + height <= 1 + 1e-6;
}
