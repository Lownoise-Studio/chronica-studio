import { compileProject } from '../engine/compiler';
import { ChronicaRuntime } from '../runtime/chronica-runtime';
import { getHarborLanternAdventureProject } from '../demo/harbor-lantern-adventure';
import {
  findInteractableInRange,
  getPlayerPosition,
  getVisibleInteractables,
  resolveEntryPoint,
} from '../engine/adventure';

function makeRuntime() {
  const project = getHarborLanternAdventureProject();
  const compiled = compileProject(project);
  if (!compiled.ok) throw new Error('compile failed: ' + JSON.stringify(compiled.diagnostics));
  return { runtime: new ChronicaRuntime(compiled.game), project };
}

describe('adventure runtime', () => {
  test('start seeds the player at the room entry point', () => {
    const { runtime } = makeRuntime();
    runtime.start();
    const pos = runtime.getPlayerPosition();
    // Harbor dock default entry
    expect(pos.x).toBeCloseTo(0.18, 3);
    expect(pos.y).toBeCloseTo(0.78, 3);
    expect(runtime.currentFragment?.locationId).toBe('harbor-dock');
    expect(runtime.visibleInteractables.length).toBeGreaterThan(0);
  });

  test('locked gate hides once lantern is picked up', () => {
    const { runtime } = makeRuntime();
    runtime.start();
    const dockInteractables = runtime.visibleInteractables;
    // Initial state: locked gate visible; open gate hidden; lantern hidden (needs met_lamplighter).
    expect(dockInteractables.find(i => i.uid === 'hl-dock-locked-gate')).toBeTruthy();
    expect(dockInteractables.find(i => i.uid === 'hl-dock-open-gate')).toBeFalsy();
    expect(dockInteractables.find(i => i.uid === 'hl-dock-lantern-pickup')).toBeFalsy();
  });

  test('talking to Lamplighter reveals the Lantern', () => {
    const { runtime } = makeRuntime();
    runtime.start();
    const lamplighter = runtime.visibleInteractables.find(i => i.uid === 'hl-dock-lamplighter');
    expect(lamplighter).toBeTruthy();
    const result = runtime.activateInteractable(lamplighter!);
    expect(result.ok).toBe(true);
    const state = runtime.runtimeState;
    expect(state?.variables.met_lamplighter).toBe(true);
    expect(state?.variables.trust).toBe(1);
    const lantern = runtime.visibleInteractables.find(i => i.uid === 'hl-dock-lantern-pickup');
    expect(lantern).toBeTruthy();
  });

  test('picking up the Lantern unlocks the gate transition', () => {
    const { runtime } = makeRuntime();
    runtime.start();
    // Meet lamplighter -> reveal lantern.
    runtime.activateInteractable(
      runtime.visibleInteractables.find(i => i.uid === 'hl-dock-lamplighter')!,
    );
    const lantern = runtime.visibleInteractables.find(i => i.uid === 'hl-dock-lantern-pickup')!;
    const pickupResult = runtime.activateInteractable(lantern);
    expect(pickupResult.ok).toBe(true);
    if (!pickupResult.ok) throw new Error('pickup rejected');
    // Pickup event should be recorded.
    expect(pickupResult.events.some(e => e.kind === 'pickup')).toBe(true);
    expect(runtime.runtimeState?.variables.has_lantern).toBe(true);

    // Locked gate is now hidden; open gate is visible.
    const dockInteractables = runtime.visibleInteractables;
    expect(dockInteractables.find(i => i.uid === 'hl-dock-locked-gate')).toBeFalsy();
    const openGate = dockInteractables.find(i => i.uid === 'hl-dock-open-gate');
    expect(openGate).toBeTruthy();

    // Walking through the gate transitions us to the lighthouse room.
    const transitionResult = runtime.activateInteractable(openGate!);
    expect(transitionResult.ok).toBe(true);
    if (!transitionResult.ok) throw new Error('transition rejected');
    expect(runtime.currentFragment?.locationId).toBe('lighthouse-interior');
    expect(transitionResult.events.some(e => e.kind === 'transition')).toBe(true);

    // Player is spawned at the from-harbor-dock entry point of the lighthouse.
    const lighthousePos = runtime.getPlayerPosition();
    expect(lighthousePos.x).toBeCloseTo(0.14, 3);
    expect(lighthousePos.y).toBeCloseTo(0.7, 3);
    expect(runtime.runtimeState?.lastLocationId).toBe('harbor-dock');
  });

  test('movement is clamped and blocked by colliders', () => {
    const { runtime } = makeRuntime();
    runtime.start();
    const before = runtime.getPlayerPosition();
    // Try to walk far up into the harbor wall collider (y=0..0.18).
    for (let i = 0; i < 200; i++) {
      runtime.movePlayer(0, -0.01);
    }
    const after = runtime.getPlayerPosition();
    // Clamped by the top collider — player cannot enter the wall region.
    expect(after.y).toBeGreaterThanOrEqual(0.18);
    // Horizontal position preserved.
    expect(after.x).toBeCloseTo(before.x, 3);
  });

  test('interactable proximity detection', () => {
    const project = getHarborLanternAdventureProject();
    const dock = project.fragments.find(f => f.locationId === 'harbor-dock')!;
    const interactables = dock.adventure!.interactables!;
    const near = findInteractableInRange(interactables, 0.36, 0.42);
    expect(near?.uid).toBe('hl-dock-lamplighter');
    const nothing = findInteractableInRange(interactables, 0.05, 0.95);
    expect(nothing).toBeNull();
  });

  test('entry point resolves from-source or falls back to default', () => {
    const project = getHarborLanternAdventureProject();
    const dock = project.fragments.find(f => f.locationId === 'harbor-dock')!;
    const fromLighthouse = resolveEntryPoint(dock.adventure!.entry, 'lighthouse-interior');
    expect(fromLighthouse).toEqual({ x: 0.86, y: 0.62 });
    const fromElsewhere = resolveEntryPoint(dock.adventure!.entry, 'nowhere');
    expect(fromElsewhere).toEqual({ x: 0.18, y: 0.78 });
  });

  test('visible interactable filter honors conditions', () => {
    const { runtime } = makeRuntime();
    runtime.start();
    const state = runtime.runtimeState!;
    const dock = runtime.currentFragment!;
    const list = getVisibleInteractables(dock, state);
    expect(list.find(i => i.uid === 'hl-dock-lantern-pickup')).toBeFalsy();
  });

  test('save/load round-trips player position and adventure flags', () => {
    const { runtime } = makeRuntime();
    runtime.start();
    // Advance state: meet lamplighter, walk right a bit, then save.
    runtime.activateInteractable(
      runtime.visibleInteractables.find(i => i.uid === 'hl-dock-lamplighter')!,
    );
    for (let i = 0; i < 40; i++) runtime.movePlayer(0.005, 0);
    const posBefore = runtime.getPlayerPosition();
    const save = runtime.toSave('harbor-lantern-adventure');
    expect(save).toBeTruthy();

    const { runtime: restored } = makeRuntime();
    const ok = restored.resume(save!);
    expect(ok).toBe(true);
    const posAfter = restored.getPlayerPosition();
    expect(posAfter.x).toBeCloseTo(posBefore.x, 4);
    expect(posAfter.y).toBeCloseTo(posBefore.y, 4);
    expect(restored.runtimeState?.variables.met_lamplighter).toBe(true);
  });
});

describe('getPlayerPosition fallback', () => {
  test('defaults to entry point defaults when state has no player position', () => {
    const pos = getPlayerPosition({
      location: 'harbor-dock',
      instability: 0,
      reality_layer: 0,
      memory: {},
      variables: {},
      dialogueLineIndex: 0,
    });
    expect(pos.x).toBeCloseTo(0.5, 3);
    expect(pos.y).toBeCloseTo(0.75, 3);
  });
});
