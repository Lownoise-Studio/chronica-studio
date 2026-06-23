/**
 * Three-scene fixture for player readability verification.
 *
 * Manual playtest path:
 * 1. Start at "Long Scroll Scene" (scroll-bg.jpg) — scroll long body text.
 * 2. Choose "Continue to short scene" → short-bg.jpg, compact panel.
 * 3. Choose "Go to plain scene" → no image, original dark layout.
 * 4. Choose "Return to long scene" → scroll-bg.jpg restored.
 */
import { Project } from '../../engine/types';

const longBody = Array.from(
  { length: 12 },
  (_, i) =>
    `Paragraph ${i + 1}: The lantern light wavered against the stone walls as you read the next passage of your journey. Each step forward reveals more of the path ahead.`,
).join('\n\n');

export const playerReadabilityStory: Project = {
  schemaVersion: 1,
  id: 'player-readability-test',
  title: 'Player Readability Test',
  description: 'Manual QA story for background overlays and reading panels.',
  startLocation: 'long-scene',
  initialVariables: {},
  initialMemory: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  assets: [
    {
      id: 'asset-scroll',
      name: 'scroll-bg.jpg',
      type: 'image',
      uri: 'file:///data/user/0/app/files/pse_assets/player-readability-test/scroll-bg.jpg',
      mimeType: 'image/jpeg',
      size: 120000,
      importedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'asset-short',
      name: 'short-bg.jpg',
      type: 'image',
      uri: 'file:///data/user/0/app/files/pse_assets/player-readability-test/short-bg.jpg',
      mimeType: 'image/jpeg',
      size: 80000,
      importedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  fragments: [
    {
      uid: 'frag-long',
      title: 'Long Scroll Scene',
      locationId: 'long-scene',
      priority: 0,
      conditions: [],
      effects: [],
      text: longBody,
      backgroundImage: 'scroll-bg.jpg',
      choices: [
        {
          uid: 'c-long-to-short',
          label: 'Continue to short scene',
          action: 'goto:short-scene',
          conditions: [],
        },
      ],
    },
    {
      uid: 'frag-short',
      title: 'Short Scene',
      locationId: 'short-scene',
      priority: 0,
      conditions: [],
      effects: [],
      text: 'A quiet clearing. Only a breath of wind.\n\nTwo paths remain.',
      backgroundImage: 'short-bg.jpg',
      choices: [
        {
          uid: 'c-short-to-plain',
          label: 'Go to plain scene',
          action: 'goto:plain-scene',
          conditions: [],
        },
        {
          uid: 'c-short-to-long',
          label: 'Return to long scene',
          action: 'goto:long-scene',
          conditions: [],
        },
      ],
    },
    {
      uid: 'frag-plain',
      title: 'Plain Scene',
      locationId: 'plain-scene',
      priority: 0,
      conditions: [],
      effects: [],
      text: 'No background image on this scene. Text should sit on the standard dark player background.',
      choices: [
        {
          uid: 'c-plain-to-short',
          label: 'Back to short scene',
          action: 'goto:short-scene',
          conditions: [],
        },
      ],
    },
  ],
};

export const readabilitySceneIds = {
  long: 'long-scene',
  short: 'short-scene',
  plain: 'plain-scene',
} as const;
