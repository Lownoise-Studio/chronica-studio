import { syncFragmentTextFromDialogue } from '@/engine/dialogue';
import { PROJECT_SCHEMA_VERSION } from '@/engine/project-migration';
import type { DialogueLine, Fragment, Project } from '@/engine/types';

/** Minimal valid 1x1 PNG (reused for every bundled demo asset). */
export const DEMO_PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

export const SHOWCASE_GAME_ID = 'd2000002-0000-4000-8000-000000000002';

const EXPORTED_AT = '2026-01-01T00:00:00.000Z';

function demoAsset(id: string, name: string) {
  return {
    id,
    name,
    type: 'image' as const,
    uri: `file:///demo/${name}`,
    mimeType: name.endsWith('.png') ? 'image/png' : 'image/jpeg',
    size: DEMO_PNG_BYTES.length,
    importedAt: EXPORTED_AT,
  };
}

function withDialogue(
  fragment: Omit<Fragment, 'text'> & { dialogue: DialogueLine[] },
): Fragment {
  const text = syncFragmentTextFromDialogue(fragment.dialogue);
  return { ...fragment, text };
}

export function getShowcaseProject(): Project {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    gameId: SHOWCASE_GAME_ID,
    id: 'showcase-engine-demo',
    title: 'Engine Showcase',
    description: 'A guided engine tour — dialogue, portraits, hotspots, branching choices, and state-driven paths.',
    startLocation: 'briefing',
    initialVariables: {
      console_inspected: false,
      power_routed: false,
    },
    initialMemory: {},
    createdAt: EXPORTED_AT,
    updatedAt: EXPORTED_AT,
    assets: [
      demoAsset('asset-briefing', 'briefing.jpg'),
      demoAsset('asset-corridor', 'corridor.jpg'),
      demoAsset('asset-engine', 'engine.jpg'),
      demoAsset('asset-bridge', 'bridge.jpg'),
      demoAsset('asset-conduit', 'conduit.jpg'),
      demoAsset('asset-vault', 'vault.jpg'),
      demoAsset('asset-epilogue', 'epilogue.jpg'),
      demoAsset('asset-elena-neutral', 'elena-neutral.png'),
      demoAsset('asset-elena-focused', 'elena-focused.png'),
    ],
    characters: [
      {
        uid: 'show-char-elena',
        characterId: 'elena',
        displayName: 'Elena',
        defaultPortrait: 'elena-neutral.png',
        expressions: [
          { id: 'focused', label: 'Focused', portrait: 'elena-focused.png' },
        ],
      },
    ],
    fragments: [
      withDialogue({
        uid: 'show-f-briefing',
        title: 'Mission Briefing',
        locationId: 'briefing',
        priority: 0,
        conditions: [],
        effects: [],
        dialogue: [
          {
            uid: 'show-d-b1',
            speakerId: null,
            text: 'Chronica Station spins up around you. This guided tour shows what the mobile engine can do in one playable package.',
          },
          {
            uid: 'show-d-b2',
            speakerId: 'elena',
            expressionId: 'focused',
            text: 'I am Elena, your guide. We will walk the station, change game state, and unlock a hidden vault together.',
          },
          {
            uid: 'show-d-b3',
            speakerId: 'elena',
            text: 'Tap through dialogue, inspect hotspots on scene art, and watch choices appear as variables change.',
          },
        ],
        choices: [
          {
            uid: 'show-c-corridor',
            label: 'Enter the main corridor',
            action: 'goto:corridor',
            conditions: [],
          },
        ],
        backgroundImage: 'briefing.jpg',
      }),
      withDialogue({
        uid: 'show-f-corridor',
        title: 'Main Corridor',
        locationId: 'corridor',
        priority: 0,
        conditions: [],
        effects: [],
        dialogue: [
          {
            uid: 'show-d-c1',
            speakerId: null,
            text: 'Bulkheads slide aside. Distant turbines hum behind reinforced glass.',
          },
          {
            uid: 'show-d-c2',
            speakerId: 'elena',
            expressionId: 'focused',
            text: 'The engine room feeds auxiliary power to the bridge. You can visit it first, or head straight to navigation.',
          },
        ],
        choices: [
          {
            uid: 'show-c-engine',
            label: 'Visit the engine room',
            action: 'goto:engine',
            conditions: [],
          },
          {
            uid: 'show-c-bridge',
            label: 'Continue to the bridge',
            action: 'goto:bridge',
            conditions: [],
          },
        ],
        backgroundImage: 'corridor.jpg',
      }),
      withDialogue({
        uid: 'show-f-engine',
        title: 'Engine Room',
        locationId: 'engine',
        priority: 0,
        conditions: [],
        effects: [],
        dialogue: [
          {
            uid: 'show-d-e1',
            speakerId: null,
            text: 'Cables pulse with amber light. A routing panel waits beside the primary coupling.',
          },
          {
            uid: 'show-d-e2',
            speakerId: 'elena',
            expressionId: 'focused',
            text: 'Tap Route Power on the panel. That sets power_routed — the vault needs it later.',
          },
        ],
        choices: [
          {
            uid: 'show-c-engine-bridge',
            label: 'Return to the corridor, then the bridge',
            action: 'goto:bridge',
            conditions: [],
          },
        ],
        hotspots: [
          {
            uid: 'show-h-power',
            label: 'Route Power',
            x: 0.18,
            y: 0.45,
            width: 0.28,
            height: 0.22,
            action: 'variables.power_routed = true',
            conditions: ['variables.power_routed != true'],
          },
        ],
        backgroundImage: 'engine.jpg',
      }),
      withDialogue({
        uid: 'show-f-bridge',
        title: 'Station Bridge',
        locationId: 'bridge',
        priority: 0,
        conditions: [],
        effects: [],
        dialogue: [
          {
            uid: 'show-d-br1',
            speakerId: null,
            text: 'The bridge viewport fills with stars. A route console blinks beside the navigation chart.',
          },
          {
            uid: 'show-d-br2',
            speakerId: 'elena',
            expressionId: 'focused',
            text: 'Inspect the console hotspot on the scene. That flips console_inspected in game state.',
          },
          {
            uid: 'show-d-br3',
            speakerId: 'elena',
            text: 'Once the console is read, a sealed conduit choice will appear. Both flags unlock the vault.',
          },
        ],
        choices: [
          {
            uid: 'show-c-conduit',
            label: 'Enter the sealed conduit',
            action: 'goto:conduit',
            conditions: ['variables.console_inspected == true'],
          },
        ],
        hotspots: [
          {
            uid: 'show-h-console',
            label: 'Inspect Console',
            x: 0.54,
            y: 0.38,
            width: 0.3,
            height: 0.2,
            action: 'variables.console_inspected = true',
            conditions: ['variables.console_inspected != true'],
          },
        ],
        backgroundImage: 'bridge.jpg',
      }),
      withDialogue({
        uid: 'show-f-conduit',
        title: 'Sealed Conduit',
        locationId: 'conduit',
        priority: 0,
        conditions: [],
        effects: [],
        dialogue: [
          {
            uid: 'show-d-co1',
            speakerId: null,
            text: 'The conduit hums. Security glyphs scan your credentials against live variables.',
          },
          {
            uid: 'show-d-co2',
            speakerId: 'elena',
            expressionId: 'focused',
            text: 'Vault access needs console_inspected and power_routed. If you skipped the engine room, go back and route power.',
          },
        ],
        choices: [
          {
            uid: 'show-c-vault',
            label: 'Open the hidden vault',
            action: 'goto:vault',
            conditions: [
              'variables.console_inspected == true',
              'variables.power_routed == true',
            ],
          },
          {
            uid: 'show-c-back-bridge',
            label: 'Return to the bridge',
            action: 'goto:bridge',
            conditions: [],
          },
        ],
        backgroundImage: 'conduit.jpg',
      }),
      withDialogue({
        uid: 'show-f-vault',
        title: 'Hidden Vault',
        locationId: 'vault',
        priority: 0,
        conditions: [],
        effects: [],
        dialogue: [
          {
            uid: 'show-d-v1',
            speakerId: null,
            text: 'Hidden bulkheads iris open. Only players who inspected the console and routed power reach this chamber.',
          },
          {
            uid: 'show-d-v2',
            speakerId: 'elena',
            text: 'State-driven design in action: hotspots wrote variables, choices read them, and the compiler validated every link.',
          },
          {
            uid: 'show-d-v3',
            speakerId: 'elena',
            expressionId: 'focused',
            text: 'This package round-trips through .chronica with portraits, backgrounds, and dialogue intact.',
          },
        ],
        choices: [
          {
            uid: 'show-c-epilogue',
            label: 'Continue to debrief',
            action: 'goto:epilogue',
            conditions: [],
          },
        ],
        backgroundImage: 'vault.jpg',
      }),
      withDialogue({
        uid: 'show-f-epilogue',
        title: 'Tour Complete',
        locationId: 'epilogue',
        priority: 0,
        conditions: [],
        effects: [],
        dialogue: [
          {
            uid: 'show-d-ep1',
            speakerId: 'elena',
            text: 'You just played a full micro-game built with Chronica Studio on a phone.',
          },
          {
            uid: 'show-d-ep2',
            speakerId: null,
            text: 'Duplicate this project, swap the art, and ship your own .chronica package to Chronica Player.',
          },
        ],
        choices: [],
        backgroundImage: 'epilogue.jpg',
      }),
    ],
  };
}
