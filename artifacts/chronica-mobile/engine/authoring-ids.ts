/**
 * Deterministic, readable, collision-safe ids for recipe and room generation.
 * Same inputs always yield the same base id; duplicates receive numeric suffixes.
 */

export function slugifyAuthoringLabel(value: string): string {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return slug || 'entry';
}

export function uniqueAuthoringSlug(base: string, existing: Set<string>): string {
  const root = slugifyAuthoringLabel(base);
  let candidate = root;
  let suffix = 2;
  while (existing.has(candidate)) {
    candidate = `${root}_${suffix}`;
    suffix += 1;
  }
  existing.add(candidate);
  return candidate;
}

export function uniqueHotspotUid(base: string, existing: Set<string>): string {
  const root = `hs_${slugifyAuthoringLabel(base)}`;
  let candidate = root;
  let suffix = 2;
  while (existing.has(candidate)) {
    candidate = `${root}_${suffix}`;
    suffix += 1;
  }
  existing.add(candidate);
  return candidate;
}

export function uniqueInteractableUid(base: string, existing: Set<string>): string {
  const root = `int_${slugifyAuthoringLabel(base)}`;
  let candidate = root;
  let suffix = 2;
  while (existing.has(candidate)) {
    candidate = `${root}_${suffix}`;
    suffix += 1;
  }
  existing.add(candidate);
  return candidate;
}

/** Stable interactable uid for a generated room role (npc, pickup, locked-gate, etc.). */
export function deterministicRoomInteractableUid(roomSlug: string, role: string): string {
  return `int_${slugifyAuthoringLabel(roomSlug)}_${slugifyAuthoringLabel(role)}`;
}

/** Reserve a deterministic uid, adding a suffix when the slot is already taken. */
export function reserveDeterministicUid(base: string, existing: Set<string>): string {
  if (!existing.has(base)) {
    existing.add(base);
    return base;
  }
  let candidate = `${base}_2`;
  let suffix = 3;
  while (existing.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  existing.add(candidate);
  return candidate;
}

export function collectInteractableUids(
  fragments: readonly { adventure?: { interactables?: readonly { uid: string }[] } }[],
): Set<string> {
  const ids = new Set<string>();
  for (const fragment of fragments) {
    for (const interactable of fragment.adventure?.interactables ?? []) {
      if (interactable.uid?.trim()) ids.add(interactable.uid.trim());
    }
  }
  return ids;
}

export function collectHotspotUids(
  fragments: readonly { hotspots?: readonly { uid: string }[] }[],
): Set<string> {
  const ids = new Set<string>();
  for (const fragment of fragments) {
    for (const hotspot of fragment.hotspots ?? []) {
      if (hotspot.uid?.trim()) ids.add(hotspot.uid.trim());
    }
  }
  return ids;
}
