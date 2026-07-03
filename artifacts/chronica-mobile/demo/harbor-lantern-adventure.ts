import { syncFragmentTextFromDialogue } from '@/engine/dialogue';
import { PROJECT_SCHEMA_VERSION } from '@/engine/project-migration';
import type { Fragment, Project, ProjectAsset } from '@/engine/types';
import { DEMO_PNG_BYTES } from './showcase-project';

/**
 * Harbor Lantern — the first playable Chronica adventure.
 *
 * A pocket-sized top-down demo that proves the runtime can drive movement,
 * proximity interactions, room transitions, and state-driven gating on top of
 * the same Fragment / action grammar existing games already use.
 */

export const HARBOR_LANTERN_ADVENTURE_GAME_ID = 'a5000005-0000-4000-8000-000000000501';
export const HARBOR_LANTERN_ADVENTURE_INSTALL_ID = 'harbor-lantern-adventure';
export const HARBOR_LANTERN_ADVENTURE_TITLE = 'Harbor Lantern (Adventure)';
export const HARBOR_LANTERN_ADVENTURE_DESCRIPTION =
  'Walk the dock, meet the Lamplighter, pick up her lantern, and light the tower before the tide turns.';

const EXPORTED_AT = '2026-07-03T09:00:00.000Z';

const AUDIO_MIME = 'audio/mpeg';

function demoAsset(
  id: string,
  name: string,
  type: ProjectAsset['type'] = 'image',
): ProjectAsset {
  const mimeType =
    type === 'audio'
      ? AUDIO_MIME
      : name.endsWith('.png')
        ? 'image/png'
        : 'image/jpeg';
  return {
    id,
    name,
    type,
    uri: `file:///demo/harbor-lantern/${name}`,
    mimeType,
    size: DEMO_PNG_BYTES.length,
    importedAt: EXPORTED_AT,
  };
}

function withDialogueText<T extends { dialogue?: Fragment['dialogue'] }>(f: T): T & { text: string } {
  return { ...f, text: syncFragmentTextFromDialogue(f.dialogue ?? []) };
}

/**
 * Two rooms, five interactables, one gated transition. Save/load is provided
 * by the base runtime — memory flags and player position round-trip through
 * the standard ChronicaState envelope.
 */
export function getHarborLanternAdventureProject(): Project {
  const dockFragment: Fragment = withDialogueText({
    uid: 'hl-dock',
    title: 'Harbor Dock',
    locationId: 'harbor-dock',
    priority: 0,
    conditions: [],
    effects: [],
    dialogue: [
      {
        uid: 'hl-dock-intro-1',
        speakerId: null,
        text: 'Rain last night, and the boards still glisten. The lighthouse sleeps at the end of the pier.',
      },
      {
        uid: 'hl-dock-intro-2',
        speakerId: null,
        text: 'Move with WASD or the joystick. Walk close to something and tap to interact.',
      },
    ],
    text: '',
    choices: [],
    hotspots: [],
    stageActors: [],
    backgroundImage: 'harbor-dock-topdown.png',
    backgroundAudio: 'harbor-ambient.mp3',
    adventure: {
      entry: {
        default: { x: 0.18, y: 0.78 },
        from: {
          'lighthouse-interior': { x: 0.86, y: 0.62 },
        },
      },
      speed: 0.32,
      playerSprite: 'player-topdown.png',
      playerWidth: 0.08,
      aspectRatio: 16 / 9,
      sfx: {
        footstep: 'sfx-footstep.mp3',
        interact: 'sfx-interact.mp3',
        pickup: 'sfx-pickup.mp3',
        transition: 'sfx-transition.mp3',
      },
      colliders: [
        // top rocks / harbor wall
        { uid: 'hl-dock-wall-top', x: 0.0, y: 0.0, width: 1.0, height: 0.18 },
        // left crates
        { uid: 'hl-dock-crates', x: 0.0, y: 0.35, width: 0.12, height: 0.28 },
        // rope pile
        { uid: 'hl-dock-rope', x: 0.42, y: 0.86, width: 0.14, height: 0.1 },
        // right piling
        { uid: 'hl-dock-piling', x: 0.7, y: 0.34, width: 0.06, height: 0.16 },
      ],
      interactables: [
        {
          uid: 'hl-dock-lamplighter',
          kind: 'npc',
          label: 'Lamplighter',
          x: 0.36,
          y: 0.42,
          radius: 0.11,
          action:
            'variables.met_lamplighter = true; memory.lamplighter_greeting = true; variables.trust += 1',
          conditions: [],
          sprite: 'lamplighter-topdown.png',
          width: 0.09,
        },
        {
          uid: 'hl-dock-lantern-pickup',
          kind: 'pickup',
          label: 'Lantern',
          x: 0.52,
          y: 0.52,
          radius: 0.09,
          action:
            'variables.has_lantern = true; variables.trust += 1; memory.lantern_taken = true',
          conditions: ['variables.has_lantern != true', 'variables.met_lamplighter == true'],
          sprite: 'lantern-topdown.png',
          width: 0.07,
          sfx: 'sfx-pickup.mp3',
        },
        {
          uid: 'hl-dock-locked-gate',
          kind: 'door',
          label: 'Locked Gate',
          x: 0.84,
          y: 0.52,
          radius: 0.11,
          action: 'memory.gate_blocked = true',
          conditions: ['variables.has_lantern != true'],
          solid: true,
          sprite: 'gate-closed-topdown.png',
          width: 0.1,
        },
        {
          uid: 'hl-dock-open-gate',
          kind: 'door',
          label: 'Gate to Lighthouse',
          x: 0.84,
          y: 0.52,
          radius: 0.13,
          action: 'goto:lighthouse-interior; memory.gate_opened = true',
          conditions: ['variables.has_lantern == true'],
          sprite: 'gate-open-topdown.png',
          width: 0.1,
        },
      ],
    },
  });

  const lighthouseFragment: Fragment = withDialogueText({
    uid: 'hl-lighthouse',
    title: 'Lighthouse Interior',
    locationId: 'lighthouse-interior',
    priority: 0,
    conditions: [],
    effects: [],
    dialogue: [
      {
        uid: 'hl-lh-intro-1',
        speakerId: null,
        text: 'Inside, the tower waits — cold and salt-scoured. The wick is dry.',
      },
    ],
    text: '',
    choices: [
      {
        uid: 'hl-choice-return-dock',
        label: 'Back to the dock',
        action: 'goto:harbor-dock',
        conditions: [],
      },
    ],
    hotspots: [],
    stageActors: [],
    backgroundImage: 'lighthouse-topdown.png',
    backgroundAudio: 'lighthouse-ambient.mp3',
    adventure: {
      entry: {
        default: { x: 0.14, y: 0.7 },
        from: {
          'harbor-dock': { x: 0.14, y: 0.7 },
        },
      },
      speed: 0.3,
      playerSprite: 'player-topdown.png',
      playerWidth: 0.08,
      aspectRatio: 16 / 9,
      sfx: {
        footstep: 'sfx-footstep.mp3',
        interact: 'sfx-interact.mp3',
        transition: 'sfx-transition.mp3',
      },
      colliders: [
        { uid: 'hl-lh-wall-top', x: 0.0, y: 0.0, width: 1.0, height: 0.22 },
        { uid: 'hl-lh-shelf', x: 0.28, y: 0.32, width: 0.16, height: 0.12 },
        { uid: 'hl-lh-stove', x: 0.66, y: 0.42, width: 0.14, height: 0.16 },
      ],
      interactables: [
        {
          uid: 'hl-lh-back-door',
          kind: 'door',
          label: 'Return to dock',
          x: 0.1,
          y: 0.68,
          radius: 0.1,
          action: 'goto:harbor-dock',
          conditions: [],
          sprite: 'gate-open-topdown.png',
          width: 0.09,
        },
        {
          uid: 'hl-lh-wick-trigger',
          kind: 'trigger',
          label: 'Light the lantern',
          x: 0.7,
          y: 0.7,
          radius: 0.12,
          action: 'memory.lantern_lit = true; goto:lighthouse-ending',
          conditions: ['variables.has_lantern == true', 'memory.lantern_lit != true'],
          sprite: 'wick-topdown.png',
          width: 0.09,
        },
      ],
    },
  });

  const endingFragment: Fragment = withDialogueText({
    uid: 'hl-ending',
    title: 'The Harbor Breathes',
    locationId: 'lighthouse-ending',
    priority: 0,
    conditions: [],
    effects: [],
    dialogue: [
      {
        uid: 'hl-end-1',
        speakerId: null,
        text: 'Warm light spills down the pier. The Lamplighter salutes from the dock, and the harbor keeps its secrets.',
      },
      {
        uid: 'hl-end-2',
        speakerId: null,
        text: 'You lit the lantern. Return to the harbor whenever you wish.',
      },
    ],
    text: '',
    choices: [
      {
        uid: 'hl-choice-return',
        label: 'Wander back',
        action: 'goto:harbor-dock',
        conditions: [],
      },
    ],
    hotspots: [],
    stageActors: [],
    backgroundImage: 'harbor-dusk-topdown.png',
  });

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    gameId: HARBOR_LANTERN_ADVENTURE_GAME_ID,
    id: HARBOR_LANTERN_ADVENTURE_INSTALL_ID,
    title: HARBOR_LANTERN_ADVENTURE_TITLE,
    description: HARBOR_LANTERN_ADVENTURE_DESCRIPTION,
    startLocation: 'harbor-dock',
    initialVariables: {
      trust: 0,
      met_lamplighter: false,
      has_lantern: false,
    },
    initialMemory: {
      lamplighter_greeting: false,
      lantern_taken: false,
      gate_opened: false,
      lantern_lit: false,
    },
    createdAt: EXPORTED_AT,
    updatedAt: EXPORTED_AT,
    assets: [
      demoAsset('hl-asset-dock-bg', 'harbor-dock-topdown.png'),
      demoAsset('hl-asset-lighthouse-bg', 'lighthouse-topdown.png'),
      demoAsset('hl-asset-dusk-bg', 'harbor-dusk-topdown.png'),
      demoAsset('hl-asset-player', 'player-topdown.png'),
      demoAsset('hl-asset-lamplighter', 'lamplighter-topdown.png'),
      demoAsset('hl-asset-lantern', 'lantern-topdown.png'),
      demoAsset('hl-asset-gate-closed', 'gate-closed-topdown.png'),
      demoAsset('hl-asset-gate-open', 'gate-open-topdown.png'),
      demoAsset('hl-asset-wick', 'wick-topdown.png'),
      demoAsset('hl-asset-ambient-harbor', 'harbor-ambient.mp3', 'audio'),
      demoAsset('hl-asset-ambient-lighthouse', 'lighthouse-ambient.mp3', 'audio'),
      demoAsset('hl-asset-sfx-footstep', 'sfx-footstep.mp3', 'audio'),
      demoAsset('hl-asset-sfx-interact', 'sfx-interact.mp3', 'audio'),
      demoAsset('hl-asset-sfx-pickup', 'sfx-pickup.mp3', 'audio'),
      demoAsset('hl-asset-sfx-transition', 'sfx-transition.mp3', 'audio'),
    ],
    characters: [],
    fragments: [dockFragment, lighthouseFragment, endingFragment],
  };
}
