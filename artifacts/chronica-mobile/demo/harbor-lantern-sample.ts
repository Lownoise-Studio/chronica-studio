import type { ParsedChronicaPackage } from '@/engine/compat/ingest';
import { ECHO_MODULE_ID, INSTABILITY_MODULE_ID } from '@/engine/compat/modules';
import {
  MOBILE_PLAYER_CAPABILITIES,
  MOBILE_PLAYER_TARGET_ID,
  type ChronicaPackageManifest,
  type ChronicaRuntimeTarget,
} from '@/engine/compat/package';
import type { ChronicaSession } from '@/engine/compat/chronica-session';

/**
 * First spec-compliance sample game package for Chronica mobile.
 *
 * Derived from the v3 compatibility fixture (`engine/compat/fixtures/`) and
 * expanded into a short playable demo. Consumed through the compat ingest
 * pipeline — not the shipping ZIP importer (yet).
 */

export const HARBOR_LANTERN_SAMPLE_GAME_ID = 'a0000001-0000-4000-8000-000000000302';
export const HARBOR_LANTERN_SAMPLE_CONTENT_HASH = 'harbor-lantern-sample-v1';
export const HARBOR_LANTERN_SAMPLE_INSTALL_ID = 'install-harbor-lantern-sample';

export const HARBOR_LANTERN_SAMPLE_TITLE = 'Harbor Lantern';
export const HARBOR_LANTERN_SAMPLE_DESCRIPTION =
  'A short harbor mystery: gather supplies, earn the keeper\'s trust, and light the lantern before the tide turns.';

/** Placeholder cover art referenced in package metadata and the asset library. */
export const HARBOR_LANTERN_SAMPLE_COVER_ASSET = 'harbor-cover-placeholder.png';

export const HARBOR_LANTERN_ENDING_FRAGMENT_UID = 'f-ending';
export const HARBOR_LANTERN_ENDING_LOCATION_ID = 'ending';

export const HARBOR_CHOICE_TO_DOCK = 'c-to-dock';
export const HARBOR_CHOICE_TO_WAREHOUSE = 'c-to-warehouse';
export const HARBOR_CHOICE_TO_PIER = 'c-to-pier';
export const HARBOR_CHOICE_TO_ENDING = 'c-to-ending';
export const HARBOR_HOTSPOT_SUPPLY_CRATE = 'h-supply-crate';

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

export const harborLanternSampleManifest: ChronicaPackageManifest = {
  schemaVersion: 3,
  engineVersion: 'chronica-mobile 0.5.0 (sample)',
  packageId: HARBOR_LANTERN_SAMPLE_GAME_ID,
  title: HARBOR_LANTERN_SAMPLE_TITLE,
  entryFragmentId: 'f-lighthouse',
  createdAt: '2026-06-01T10:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z',
  optionalModules: [INSTABILITY_MODULE_ID, ECHO_MODULE_ID],
  capabilities: [...MOBILE_PLAYER_CAPABILITIES],
  runtimeTargets: [studioTarget, mobilePlayerTarget],
  contentHash: HARBOR_LANTERN_SAMPLE_CONTENT_HASH,
};

function portableAsset(
  id: string,
  name: string,
  type: 'image' | 'audio',
  mimeType: string,
  size = 1024,
) {
  return {
    id,
    name,
    type,
    uri: `assets/${name}`,
    mimeType,
    size,
    importedAt: '2026-06-01T10:00:00.000Z',
  };
}

/**
 * Parsed schema-v3 sample package — five fragments, dialogue, a hotspot,
 * conditional choices, module hints, and portable asset references.
 */
export const harborLanternSamplePackage: ParsedChronicaPackage = {
  manifest: harborLanternSampleManifest,
  metadata: {
    kind: 'spec-compliance-sample',
    description: HARBOR_LANTERN_SAMPLE_DESCRIPTION,
    coverImage: HARBOR_LANTERN_SAMPLE_COVER_ASSET,
  },
  variables: {
    trust: 0,
    supplies_found: false,
  },
  memory: {
    met_keeper: false,
    lantern_lit: false,
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
    portableAsset('asset-cover', HARBOR_LANTERN_SAMPLE_COVER_ASSET, 'image', 'image/png', 512),
    portableAsset('asset-bg-lighthouse', 'lighthouse-interior.jpg', 'image', 'image/jpeg', 2048),
    portableAsset('asset-bg-dock', 'harbor-dock.jpg', 'image', 'image/jpeg', 2048),
    portableAsset('asset-bg-warehouse', 'harbor-warehouse.jpg', 'image', 'image/jpeg', 2048),
    portableAsset('asset-bg-pier', 'harbor-pier.jpg', 'image', 'image/jpeg', 2048),
    portableAsset('asset-bg-ending', 'harbor-dusk.jpg', 'image', 'image/jpeg', 2048),
    portableAsset('asset-keeper', 'keeper-sprite.png', 'image', 'image/png', 512),
    portableAsset('asset-crate', 'supply-crate.png', 'image', 'image/png', 256),
    portableAsset('asset-harbor-wind', 'harbor-wind.ogg', 'audio', 'audio/ogg', 1024),
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
          uid: HARBOR_CHOICE_TO_DOCK,
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
      choices: [
        {
          uid: HARBOR_CHOICE_TO_WAREHOUSE,
          label: 'Carry supplies to the warehouse',
          action: 'goto:warehouse',
          conditions: ['variables.supplies_found == true'],
        },
        {
          uid: 'c-back-lighthouse',
          label: 'Climb back to the lighthouse',
          action: 'goto:lighthouse',
          conditions: [],
        },
      ],
      hotspots: [
        {
          uid: HARBOR_HOTSPOT_SUPPLY_CRATE,
          label: 'Supply crate',
          x: 0.58,
          y: 0.62,
          width: 0.18,
          height: 0.22,
          action: 'variables.supplies_found = true; variables.trust += 1',
          conditions: ['variables.supplies_found != true'],
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
    {
      uid: 'f-warehouse',
      title: 'Harbor warehouse',
      locationId: 'warehouse',
      priority: 0,
      conditions: [],
      effects: ['variables.trust += 1'],
      text: '',
      dialogue: [
        {
          uid: 'd-warehouse-1',
          speakerId: 'keeper',
          expressionId: 'neutral',
          text: 'Good. Stack the crates by the lantern oil — we may need it tonight.',
        },
      ],
      choices: [
        {
          uid: HARBOR_CHOICE_TO_PIER,
          label: 'Walk out to the pier',
          action: 'goto:pier',
          conditions: [],
        },
      ],
      hotspots: [],
      stageActors: [],
      backgroundImage: 'harbor-warehouse.jpg',
    },
    {
      uid: 'f-pier',
      title: 'Outer pier',
      locationId: 'pier',
      priority: 0,
      conditions: [],
      effects: [],
      text: 'The tide pulls at the pilings. Something familiar hums beneath the boards.',
      dialogue: [],
      choices: [
        {
          uid: HARBOR_CHOICE_TO_ENDING,
          label: 'Light the harbor lantern',
          action: 'goto:ending; memory.lantern_lit = true',
          conditions: ['variables.trust >= 3'],
        },
      ],
      hotspots: [],
      stageActors: [],
      backgroundImage: 'harbor-pier.jpg',
      backgroundAudio: 'harbor-wind.ogg',
    },
    {
      uid: HARBOR_LANTERN_ENDING_FRAGMENT_UID,
      title: 'Lantern lit',
      locationId: HARBOR_LANTERN_ENDING_LOCATION_ID,
      priority: 0,
      conditions: [],
      effects: [],
      text: '',
      dialogue: [
        {
          uid: 'd-ending-1',
          speakerId: null,
          text: 'Warm light spills across the water. The harbor exhales, and the night keeps its secrets.',
        },
      ],
      choices: [],
      hotspots: [],
      stageActors: [],
      backgroundImage: 'harbor-dusk.jpg',
    },
  ],
  modules: {
    [INSTABILITY_MODULE_ID]: {
      turnIncrement: 3,
      initialInstability: 0,
    },
    [ECHO_MODULE_ID]: {
      echoes: [
        {
          id: 'echo-harbor',
          attachedFragmentId: 'f-pier',
          activationThreshold: 5,
          manifestationThreshold: 15,
        },
      ],
    },
  },
};

export async function exhaustDialogue(session: ChronicaSession): Promise<void> {
  while (!session.isDialogueExhausted()) {
    const result = await session.advanceDialogue();
    if (!result.ok || !result.advanced) break;
  }
}

function findChoice(session: ChronicaSession, uid: string) {
  const choice = session.visibleChoices.find(c => c.uid === uid);
  if (!choice) {
    throw new Error(`Choice "${uid}" is not visible`);
  }
  return choice;
}

/**
 * Walk the intended happy path from lighthouse entry through the ending.
 */
export async function playHarborLanternMainPath(session: ChronicaSession): Promise<void> {
  await exhaustDialogue(session);
  await session.choose(findChoice(session, HARBOR_CHOICE_TO_DOCK));

  const crate = session.visibleHotspots.find(h => h.uid === HARBOR_HOTSPOT_SUPPLY_CRATE);
  if (!crate) throw new Error('Supply crate hotspot is not visible');
  await session.activateHotspot(crate);

  await session.choose(findChoice(session, HARBOR_CHOICE_TO_WAREHOUSE));
  await exhaustDialogue(session);
  await session.choose(findChoice(session, HARBOR_CHOICE_TO_PIER));
  await session.choose(findChoice(session, HARBOR_CHOICE_TO_ENDING));
  await exhaustDialogue(session);
}
