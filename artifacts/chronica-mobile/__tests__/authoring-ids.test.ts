import {
  deterministicRoomInteractableUid,
  reserveDeterministicUid,
  slugifyAuthoringLabel,
  uniqueAuthoringSlug,
  uniqueHotspotUid,
  uniqueInteractableUid,
} from '../engine/authoring-ids';

describe('authoring ids', () => {
  test('slugifyAuthoringLabel produces readable stable slugs', () => {
    expect(slugifyAuthoringLabel('Door Wood.glb')).toBe('door_wood_glb');
    expect(slugifyAuthoringLabel('  Lantern Pickup ')).toBe('lantern_pickup');
  });

  test('deterministic room interactable ids are stable for repeated generation', () => {
    expect(deterministicRoomInteractableUid('demo_dock', 'npc')).toBe('int_demo_dock_npc');
    expect(deterministicRoomInteractableUid('demo_dock', 'npc')).toBe('int_demo_dock_npc');
    expect(deterministicRoomInteractableUid('demo_dock', 'locked_gate')).toBe('int_demo_dock_locked_gate');
  });

  test('duplicate names receive collision-safe suffixes', () => {
    const existing = new Set<string>(['lantern']);
    expect(uniqueAuthoringSlug('Lantern', existing)).toBe('lantern_2');
    expect(uniqueHotspotUid('door', existing)).toBe('hs_door');
    expect(uniqueHotspotUid('door', existing)).toBe('hs_door_2');
    expect(uniqueInteractableUid('pickup', existing)).toBe('int_pickup');
    expect(uniqueInteractableUid('pickup', existing)).toBe('int_pickup_2');
  });

  test('reserveDeterministicUid keeps first use stable and suffixes collisions', () => {
    const existing = new Set<string>();
    const base = deterministicRoomInteractableUid('generated_room', 'npc');
    expect(reserveDeterministicUid(base, existing)).toBe(base);
    expect(reserveDeterministicUid(base, existing)).toBe('int_generated_room_npc_2');
  });
});
