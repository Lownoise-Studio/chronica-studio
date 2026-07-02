import type { ParsedChronicaPackage } from '@/engine/compat/ingest';
import { ECHO_MODULE_ID, INSTABILITY_MODULE_ID } from '@/engine/compat/modules';
import {
  MOBILE_PLAYER_CAPABILITIES,
  MOBILE_PLAYER_TARGET_ID,
  type ChronicaPackageManifest,
  type ChronicaRuntimeTarget,
} from '@/engine/compat/package';

/**
 * Test / dev fixture representing a main-engine (Godot) export that ships
 * BOTH a full 3D runtime target and a mobile-player fallback target. The
 * mobile compat pipeline should pick the mobile-player target, drop the
 * 3D-only fragment fields to unsupported-content warnings, and produce a
 * runnable ChronicaSession without any special-case handling.
 *
 * This is not a shipping package. Do not import from product code — only
 * developer entry points and tests should reach for it.
 */

export const HYBRID_FIXTURE_PACKAGE_ID = 'a0000001-0000-4000-8000-0000000000ff';

const mobilePlayerTarget: ChronicaRuntimeTarget = {
  id: MOBILE_PLAYER_TARGET_ID,
  label: 'Chronica Mobile Player',
  capabilities: ['narrative', 'dialogue', 'variables', 'choices', 'save-load', 'stage2d', 'modules'],
  entryFragmentId: 'f-intro',
  assetProfile: 'mobile',
  presentation: 'stage2d',
};

const godot3dTarget: ChronicaRuntimeTarget = {
  id: 'godot-3d',
  label: 'Godot 3D Runtime',
  capabilities: ['narrative', 'dialogue', 'stage3d', 'terrain', 'placeable-objects'],
  assetProfile: 'godot',
  presentation: 'stage3d',
};

const manifest: ChronicaPackageManifest = {
  schemaVersion: 2,
  engineVersion: 'chronica-main (fixture)',
  packageId: HYBRID_FIXTURE_PACKAGE_ID,
  title: 'Godot Hybrid Fixture',
  entryFragmentId: 'f-intro',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  optionalModules: [INSTABILITY_MODULE_ID, ECHO_MODULE_ID],
  capabilities: [...MOBILE_PLAYER_CAPABILITIES],
  runtimeTargets: [godot3dTarget, mobilePlayerTarget],
  contentHash: 'godot-hybrid-fixture-v1',
};

export const godotHybridFixturePackage: ParsedChronicaPackage = {
  manifest,
  fragments: [
    {
      uid: 'f-intro',
      title: 'Camp at dawn',
      locationId: 'intro',
      priority: 0,
      conditions: [],
      effects: ['variables.trust = 0'],
      text: 'You wake beside the campfire, ash still warm.',
      choices: [
        {
          uid: 'c-forest',
          label: 'Walk into the forest',
          action: 'goto:forest',
          conditions: [],
        },
      ],
      // 3D-authoring field the main engine emits — mobile drops it with a warning.
      terrain: 'grass-hills',
    },
    {
      uid: 'f-forest',
      title: 'Ancient forest',
      locationId: 'forest',
      priority: 0,
      conditions: [],
      effects: [],
      text: 'Trees stretch far into the mist. You cannot see the road you came from.',
      choices: [],
      // Another 3D-only field the mobile runtime cannot use.
      camera: { fov: 60, position: [0, 1.6, 0] },
    },
  ],
  modules: {
    [INSTABILITY_MODULE_ID]: {
      turnIncrement: 0.5,
    },
    [ECHO_MODULE_ID]: {
      echoes: [
        {
          id: 'echo-forest',
          attachedFragmentId: 'f-forest',
          activationThreshold: 5,
          manifestationThreshold: 20,
        },
      ],
    },
  },
};
