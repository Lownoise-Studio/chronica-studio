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
  const briefingDialogue: DialogueLine[] = [
    {
      uid: 'show-d-b1',
      speakerId: null,
      text: 'Chronica Station wakes online. This pocket demo shows what the engine can do on your phone.',
    },
    {
      uid: 'show-d-b2',
      speakerId: 'elena',
      expressionId: 'focused',
      text: 'I am Elena, your guide. Head to the bridge — there is a console worth inspecting.',
    },
  ];

  const bridgeDialogue: DialogueLine[] = [
    {
      uid: 'show-d-br1',
      speakerId: null,
      text: 'The bridge viewport glows. A route console blinks beside the navigation chart.',
    },
    {
      uid: 'show-d-br2',
      speakerId: 'elena',
      expressionId: 'focused',
      text: 'Tap Inspect Console on the scene. State changes here unlock the hidden route.',
    },
  ];

  const vaultDialogue: DialogueLine[] = [
    {
      uid: 'show-d-v1',
      speakerId: null,
      text: 'Hidden bulkheads iris open. The vault only appears when console_inspected is true.',
    },
    {
      uid: 'show-d-v2',
      speakerId: 'elena',
      text: 'You made it. Dialogue, portraits, hotspots, variables, and packaging — all working.',
    },
  ];

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    gameId: SHOWCASE_GAME_ID,
    id: 'showcase-engine-demo',
    title: 'Engine Showcase',
    description: 'A short engine demo — dialogue, portraits, hotspots, and branching state.',
    startLocation: 'briefing',
    initialVariables: { console_inspected: false },
    initialMemory: {},
    createdAt: EXPORTED_AT,
    updatedAt: EXPORTED_AT,
    assets: [
      demoAsset('asset-briefing', 'briefing.jpg'),
      demoAsset('asset-bridge', 'bridge.jpg'),
      demoAsset('asset-vault', 'vault.jpg'),
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
        dialogue: briefingDialogue,
        choices: [
          {
            uid: 'show-c-bridge',
            label: 'Enter the bridge',
            action: 'goto:bridge',
            conditions: [],
          },
        ],
        backgroundImage: 'briefing.jpg',
      }),
      withDialogue({
        uid: 'show-f-bridge',
        title: 'Station Bridge',
        locationId: 'bridge',
        priority: 0,
        conditions: [],
        effects: [],
        dialogue: bridgeDialogue,
        choices: [
          {
            uid: 'show-c-route',
            label: 'Open the hidden route',
            action: 'goto:vault',
            conditions: ['variables.console_inspected == true'],
          },
        ],
        hotspots: [
          {
            uid: 'show-h-console',
            label: 'Inspect Console',
            x: 0.54,
            y: 0.4,
            width: 0.3,
            height: 0.2,
            action: 'variables.console_inspected = true',
            conditions: ['variables.console_inspected != true'],
          },
        ],
        backgroundImage: 'bridge.jpg',
      }),
      withDialogue({
        uid: 'show-f-vault',
        title: 'Hidden Vault',
        locationId: 'vault',
        priority: 0,
        conditions: [],
        effects: [],
        dialogue: vaultDialogue,
        choices: [],
        backgroundImage: 'vault.jpg',
      }),
    ],
  };
}
