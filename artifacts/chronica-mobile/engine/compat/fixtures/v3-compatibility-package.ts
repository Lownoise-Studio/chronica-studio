import type { ParsedChronicaPackage } from '../ingest';
import { ECHO_MODULE_ID, INSTABILITY_MODULE_ID } from '../modules';
import {
  MOBILE_PLAYER_CAPABILITIES,
  MOBILE_PLAYER_TARGET_ID,
  type ChronicaPackageManifest,
  type ChronicaRuntimeTarget,
} from '../package';

/**
 * Stable identity for the v3 compatibility fixture package.
 * Used as `manifest.packageId` / ingested `gameId`.
 */
export const V3_COMPAT_FIXTURE_GAME_ID = 'a0000001-0000-4000-8000-000000000301';

/** Content fingerprint declared on the compat manifest (integrity hint). */
export const V3_COMPAT_FIXTURE_CONTENT_HASH = 'v3-compat-fixture-content-hash-v1';

/** Local install id used when persisting saves from this fixture in tests. */
export const V3_COMPAT_FIXTURE_INSTALL_ID = 'install-v3-compat-fixture';

const mobilePlayerTarget: ChronicaRuntimeTarget = {
  id: MOBILE_PLAYER_TARGET_ID,
  label: 'Chronica Mobile Player',
  capabilities: [...MOBILE_PLAYER_CAPABILITIES],
  entryFragmentId: 'f-lighthouse',
  assetProfile: 'mobile',
  presentation: 'stage2d',
};

const studioTarget: ChronicaRuntimeTarget = {
  id: 'chronica-studio',
  label: 'Chronica Studio Authoring',
  capabilities: ['narrative', 'dialogue', 'variables', 'choices', 'hotspots', 'stage2d', 'editor'],
  assetProfile: 'desktop',
  presentation: 'stage2d',
};

export const v3CompatFixtureManifest: ChronicaPackageManifest = {
  schemaVersion: 3,
  engineVersion: 'chronica-mobile 0.5.0 (fixture)',
  packageId: V3_COMPAT_FIXTURE_GAME_ID,
  title: 'Harbor Lantern (v3 compat fixture)',
  entryFragmentId: 'f-lighthouse',
  createdAt: '2026-06-01T10:00:00.000Z',
  updatedAt: '2026-06-22T12:00:00.000Z',
  optionalModules: [INSTABILITY_MODULE_ID, ECHO_MODULE_ID],
  capabilities: [...MOBILE_PLAYER_CAPABILITIES],
  runtimeTargets: [studioTarget, mobilePlayerTarget],
  contentHash: V3_COMPAT_FIXTURE_CONTENT_HASH,
};

/**
 * Realistic schema-v3 parsed package for compat ingest / session tests.
 * Includes dialogue, hotspots, stage actors, asset references, variables,
 * runtime targets, and first-party module hints. Not a ZIP archive — the
 * shipping importer is unchanged; tests feed this through the ingest pipeline.
 */
export const v3CompatibilityFixturePackage: ParsedChronicaPackage = {
  manifest: v3CompatFixtureManifest,
  variables: {
    trust: 0,
    supplies_found: false,
  },
  memory: {
    met_keeper: false,
  },
  characters: [
    {
      uid: 'char-keeper',
      characterId: 'keeper',
      displayName: 'Harbor Keeper',
      defaultPortrait: 'keeper-sprite.png',
      expressions: [{ id: 'neutral', portrait: 'keeper-sprite.png' }],
    },
  ],
  assets: [
    {
      id: 'asset-bg-lighthouse',
      name: 'lighthouse-interior.jpg',
      type: 'image',
      uri: 'assets/lighthouse-interior.jpg',
      mimeType: 'image/jpeg',
      size: 2048,
      importedAt: '2026-06-01T10:00:00.000Z',
    },
    {
      id: 'asset-bg-dock',
      name: 'harbor-dock.jpg',
      type: 'image',
      uri: 'assets/harbor-dock.jpg',
      mimeType: 'image/jpeg',
      size: 2048,
      importedAt: '2026-06-01T10:00:00.000Z',
    },
    {
      id: 'asset-keeper',
      name: 'keeper-sprite.png',
      type: 'image',
      uri: 'assets/keeper-sprite.png',
      mimeType: 'image/png',
      size: 512,
      importedAt: '2026-06-01T10:00:00.000Z',
    },
    {
      id: 'asset-crate',
      name: 'supply-crate.png',
      type: 'image',
      uri: 'assets/supply-crate.png',
      mimeType: 'image/png',
      size: 256,
      importedAt: '2026-06-01T10:00:00.000Z',
    },
    {
      id: 'asset-harbor-wind',
      name: 'harbor-wind.ogg',
      type: 'audio',
      uri: 'assets/harbor-wind.ogg',
      mimeType: 'audio/ogg',
      size: 1024,
      importedAt: '2026-06-01T10:00:00.000Z',
    },
  ],
  fragments: [
    {
      uid: 'f-lighthouse',
      title: 'Lighthouse interior',
      locationId: 'lighthouse',
      priority: 0,
      conditions: [],
      effects: ['variables.trust = 1', 'memory.met_keeper = true'],
      text: '',
      dialogue: [
        {
          uid: 'd-lighthouse-1',
          speakerId: 'keeper',
          expressionId: 'neutral',
          text: 'The lantern is cold. The harbor waits below.',
        },
        {
          uid: 'd-lighthouse-2',
          speakerId: null,
          text: 'Salt air drifts through the cracked window.',
        },
      ],
      choices: [
        {
          uid: 'c-to-dock',
          label: 'Descend to the dock',
          action: 'goto:dock',
          conditions: [],
        },
      ],
      hotspots: [],
      stageActors: [
        {
          uid: 'actor-keeper',
          label: 'Keeper',
          asset: 'keeper-sprite.png',
          x: 0.28,
          y: 0.82,
          width: 0.3,
          zIndex: 1,
          expressions: [{ id: 'neutral', asset: 'keeper-sprite.png' }],
        },
      ],
      backgroundImage: 'lighthouse-interior.jpg',
    },
    {
      uid: 'f-dock',
      title: 'Harbor dock',
      locationId: 'dock',
      priority: 0,
      conditions: [],
      effects: [],
      text: 'Crates line the pier. Gulls argue overhead.',
      dialogue: [],
      choices: [],
      hotspots: [
        {
          uid: 'h-supply-crate',
          label: 'Supply crate',
          x: 0.58,
          y: 0.62,
          width: 0.18,
          height: 0.22,
          action: 'variables.supplies_found = true; variables.trust += 1',
          conditions: [],
        },
      ],
      stageActors: [
        {
          uid: 'actor-crate',
          label: 'Crate',
          asset: 'supply-crate.png',
          x: 0.62,
          y: 0.78,
          width: 0.2,
          zIndex: 0,
        },
      ],
      backgroundImage: 'harbor-dock.jpg',
      backgroundAudio: 'harbor-wind.ogg',
    },
  ],
  modules: {
    [INSTABILITY_MODULE_ID]: {
      turnIncrement: 5,
      initialInstability: 0,
    },
    [ECHO_MODULE_ID]: {
      echoes: [
        {
          id: 'echo-harbor',
          attachedFragmentId: 'f-dock',
          activationThreshold: 5,
          manifestationThreshold: 15,
        },
      ],
    },
  },
};
