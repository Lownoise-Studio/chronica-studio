import { syncFragmentTextFromDialogue } from '@/engine/dialogue';
import { PROJECT_SCHEMA_VERSION } from '@/engine/project-migration';
import type { DialogueLine, Fragment, Project, StageActor } from '@/engine/types';
import { DEMO_PNG_BYTES } from './showcase-project';
import { PASTURE_ART_SIZES } from './pasture-art-bytes';

export { DEMO_PNG_BYTES };

export const PASTURE_GAME_ID = 'e3000003-0000-4000-8000-000000000003';

const EXPORTED_AT = '2026-06-22T12:00:00.000Z';

function demoAsset(id: string, name: string, type: 'image' | 'audio' = 'image') {
  const size = type === 'audio'
    ? DEMO_PNG_BYTES.length
    : (PASTURE_ART_SIZES[name] ?? DEMO_PNG_BYTES.length);
  return {
    id,
    name,
    type,
    uri: `file:///demo/${name}`,
    mimeType: type === 'audio' ? 'audio/mpeg' : (name.endsWith('.png') ? 'image/png' : 'image/jpeg'),
    size,
    importedAt: EXPORTED_AT,
  };
}

function withDialogue(
  fragment: Omit<Fragment, 'text'> & { dialogue: DialogueLine[] },
): Fragment {
  return { ...fragment, text: syncFragmentTextFromDialogue(fragment.dialogue) };
}

const cowActor: StageActor = {
  uid: 'pasture-cow',
  label: 'Cow',
  asset: 'cow-idle.png',
  x: 0.54,
  y: 0.9,
  width: 0.4,
  expressionFromVariable: 'variables.cow_state',
  expressions: [
    { id: 'idle', asset: 'cow-idle.png' },
    { id: 'grazing', asset: 'cow-graze.png' },
    { id: 'walking', asset: 'cow-walk.png' },
    { id: 'drinking', asset: 'cow-drink.png' },
  ],
};

const nightStar: StageActor = {
  uid: 'pasture-star',
  label: 'Evening star',
  asset: 'star.png',
  x: 0.78,
  y: 0.22,
  width: 0.08,
};

function pastureHotspots(nextTime: string | null) {
  const hotspots = [
    {
      uid: 'h-grass',
      label: 'Grass patch',
      x: 0.18,
      y: 0.62,
      width: 0.28,
      height: 0.22,
      action: 'variables.cow_state = "grazing"',
      conditions: ['variables.cow_state != "grazing"'],
    },
    {
      uid: 'h-creek',
      label: 'Creek',
      x: 0.68,
      y: 0.58,
      width: 0.24,
      height: 0.24,
      action: 'variables.cow_state = "drinking"',
      conditions: ['variables.cow_state != "drinking"'],
    },
  ];

  if (nextTime) {
    hotspots.push({
      uid: `h-time-${nextTime}`,
      label: nextTime === 'afternoon' ? 'Watch the morning pass' : nextTime === 'sunset' ? 'Wait for sunset' : 'Let night fall',
      x: 0.42,
      y: 0.08,
      width: 0.22,
      height: 0.14,
      action: `variables.time = "${nextTime}"; variables.cow_state = "idle"`,
      conditions: [],
    });
  }

  return hotspots;
}

function timeFragment(
  uid: string,
  title: string,
  time: string,
  priority: number,
  backgroundImage: string,
  dialogue: DialogueLine[],
  nextTime: string | null,
): Fragment {
  return withDialogue({
    uid,
    title,
    locationId: 'pasture',
    priority,
    conditions: [`variables.time == "${time}"`],
    effects: [],
    dialogue,
    choices: [],
    hotspots: pastureHotspots(nextTime),
    backgroundImage,
    stageActors: time === 'night' ? [cowActor, nightStar] : [cowActor],
  });
}

/** Quiet visual demo — pasture, cow sprites, hotspots, and time-of-day without branching narrative. */
export function getPastureProject(): Project {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    gameId: PASTURE_GAME_ID,
    id: 'pasture-demo',
    title: 'Pasture',
    description: 'A quiet morning in the field. Tap the grass, the creek, and watch the day pass.',
    startLocation: 'pasture',
    initialVariables: {
      time: 'morning',
      cow_state: 'idle',
    },
    initialMemory: {},
    createdAt: EXPORTED_AT,
    updatedAt: EXPORTED_AT,
    assets: [
      demoAsset('asset-morning', 'pasture-morning.jpg'),
      demoAsset('asset-afternoon', 'pasture-afternoon.jpg'),
      demoAsset('asset-sunset', 'pasture-sunset.jpg'),
      demoAsset('asset-night', 'pasture-night.jpg'),
      demoAsset('asset-cow-idle', 'cow-idle.png'),
      demoAsset('asset-cow-graze', 'cow-graze.png'),
      demoAsset('asset-cow-walk', 'cow-walk.png'),
      demoAsset('asset-cow-drink', 'cow-drink.png'),
      demoAsset('asset-star', 'star.png'),
    ],
    characters: [],
    fragments: [
      timeFragment(
        'pasture-morning',
        'Morning Pasture',
        'morning',
        0,
        'pasture-morning.jpg',
        [
          {
            uid: 'pasture-d-m1',
            speakerId: null,
            text: 'Morning light settles on the pasture. A cow stands in the quiet, tail switching once in a while.',
          },
          {
            uid: 'pasture-d-m2',
            speakerId: null,
            text: 'Tap the grass or the creek. When you are ready, watch the day move on.',
          },
        ],
        'afternoon',
      ),
      timeFragment(
        'pasture-afternoon',
        'Afternoon Pasture',
        'afternoon',
        1,
        'pasture-afternoon.jpg',
        [
          {
            uid: 'pasture-d-a1',
            speakerId: null,
            text: 'The heat of afternoon hums in the grass. Shadows grow longer at the fence line.',
          },
        ],
        'sunset',
      ),
      timeFragment(
        'pasture-sunset',
        'Sunset Pasture',
        'sunset',
        2,
        'pasture-sunset.jpg',
        [
          {
            uid: 'pasture-d-s1',
            speakerId: null,
            text: 'The sky turns gold. The cow lifts her head, then lowers it again, unhurried.',
          },
        ],
        'night',
      ),
      timeFragment(
        'pasture-night',
        'Night Pasture',
        'night',
        3,
        'pasture-night.jpg',
        [
          {
            uid: 'pasture-d-n1',
            speakerId: null,
            text: 'Night folds over the field. A single light hangs in the dark — and the pasture keeps breathing.',
          },
        ],
        null,
      ),
    ],
  };
}
