import { compileProject } from '../engine/compiler';
import { buildCompiledGame } from '../engine/compiler/build-compiled-game';
import { buildEditorIntegrityGroups } from '../engine/editor-integrity-panel';
import {
  collectSceneRuntimeFallbacks,
  resolvePlayerPositionSafe,
} from '../engine/runtime-fallbacks';
import {
  collectCompileValidation,
  filterCompileBlockers,
  isOptionalAssetIssue,
} from '../engine/validation-severity';
import { PlayerHost } from '../runtime/player-host';
import type { Fragment, Project } from '../engine/types';

function frag(partial: Partial<Fragment> & Pick<Fragment, 'uid' | 'locationId'>): Fragment {
  return {
    title: partial.locationId,
    priority: 0,
    conditions: [],
    effects: [],
    text: 'Scene',
    choices: [],
    ...partial,
  };
}

function baseProject(fragments: Fragment[], overrides: Partial<Project> = {}): Project {
  return {
    schemaVersion: 3,
    gameId: 'a0000001-0000-4000-8000-000000000099',
    id: 'p1',
    title: 'Phase 2 Tale',
    description: '',
    startLocation: fragments[0]?.locationId ?? 'room',
    initialVariables: {},
    initialMemory: {},
    createdAt: '',
    updatedAt: '',
    assets: [],
    characters: [],
    fragments,
    ...overrides,
  };
}

describe('foundation hardening phase 2', () => {
  describe('compile validation boundaries', () => {
    test('default compile behavior is unchanged for valid projects', () => {
      const project = baseProject([
        frag({ uid: 'f1', locationId: 'room', choices: [{ uid: 'c1', label: 'Next', action: 'goto:next', conditions: [] }] }),
        frag({ uid: 'f2', locationId: 'next' }),
      ]);
      expect(compileProject(project).ok).toBe(true);
      expect(compileProject(project, { strictValidation: true }).ok).toBe(true);
    });

    test('default compile still blocks legacy structural errors', () => {
      const project = baseProject([
        frag({
          uid: 'f1',
          locationId: 'room',
          choices: [{ uid: 'c1', label: 'Nowhere', action: 'goto:missing', conditions: [] }],
        }),
      ]);
      const result = compileProject(project);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.diagnostics.some(d => d.type === 'broken-link')).toBe(true);
    });

    test('strict validation blocks missing adventure spawn and broken transitions', () => {
      const project = baseProject([
        frag({
          uid: 'f1',
          locationId: 'room',
          adventure: {
            entry: { default: { x: 2, y: 2 } },
            interactables: [{
              uid: 'door1',
              kind: 'door',
              label: 'Door',
              x: 0.5,
              y: 0.5,
              action: 'goto:nowhere',
              conditions: [],
            }],
          },
        }),
      ]);

      expect(compileProject(project).ok).toBe(true);
      const strict = compileProject(project, { strictValidation: true });
      expect(strict.ok).toBe(false);
      if (strict.ok) return;
      expect(strict.diagnostics.some(d => d.message.includes('player spawn'))).toBe(true);
      expect(strict.diagnostics.some(d => d.message.includes('unknown scene'))).toBe(true);
    });

    test('strict validation blocks duplicate interactable ids across scenes', () => {
      const shared = {
        uid: 'shared_npc',
        kind: 'npc' as const,
        label: 'NPC',
        x: 0.5,
        y: 0.5,
        action: '',
        conditions: [],
      };
      const project = baseProject([
        frag({
          uid: 'f1',
          locationId: 'room-a',
          choices: [{ uid: 'c1', label: 'Go', action: 'goto:room-b', conditions: [] }],
          adventure: { entry: { default: { x: 0.2, y: 0.8 } }, interactables: [shared] },
        }),
        frag({
          uid: 'f2',
          locationId: 'room-b',
          adventure: { entry: { default: { x: 0.2, y: 0.8 } }, interactables: [{ ...shared }] },
        }),
      ]);

      expect(compileProject(project).ok).toBe(true);
      const strict = compileProject(project, { strictValidation: true });
      expect(strict.ok).toBe(false);
      if (strict.ok) return;
      expect(strict.diagnostics.some(d => d.message.includes('Duplicate adventure interactable uid'))).toBe(true);
    });

    test('missing optional assets do not block strict validation', () => {
      const project = baseProject([
        frag({
          uid: 'f1',
          locationId: 'room',
          adventure: {
            entry: { default: { x: 0.2, y: 0.8 } },
            playerSprite: 'missing_player.png',
            sfx: { interact: 'missing_sfx.wav' },
            interactables: [{
              uid: 'pickup1',
              kind: 'pickup',
              label: 'Item',
              x: 0.5,
              y: 0.5,
              action: 'variables.has_item = true',
              conditions: [],
              sprite: 'missing_pickup.png',
            }],
          },
        }),
      ], {
        assets: [],
      });

      const diagnostics = collectCompileValidation(project, { strictValidation: true });
      const optional = diagnostics.filter(isOptionalAssetIssue);
      expect(optional.length).toBeGreaterThan(0);
      expect(filterCompileBlockers(optional, { strictValidation: true })).toHaveLength(0);

      const strict = compileProject(project, { strictValidation: true });
      expect(strict.ok).toBe(true);
    });
  });

  describe('runtime fallbacks', () => {
    test('missing media references produce warnings without throwing', () => {
      const fragment = frag({
        uid: 'f1',
        locationId: 'room',
        backgroundImage: 'missing_bg.png',
        backgroundAudio: 'missing_loop.mp3',
        adventure: {
          entry: { default: { x: 0.2, y: 0.8 } },
          playerSprite: 'missing_player.png',
          sfx: { pickup: 'missing_pickup.wav' },
          interactables: [{
            uid: 'npc1',
            kind: 'npc',
            label: 'Guide',
            x: 0.5,
            y: 0.5,
            action: '',
            conditions: [],
            sprite: 'missing_npc.png',
          }],
        },
      });
      const game = buildCompiledGame(baseProject([fragment], { assets: [] }));

      const host = PlayerHost.create(game);
      expect(() => host.startNew()).not.toThrow();

      const snapshot = host.snapshot();
      expect(snapshot.backgroundUri).toBeUndefined();
      expect(snapshot.mediaFallbacks.some(w => w.code === 'missing-background')).toBe(true);
      expect(snapshot.mediaFallbacks.some(w => w.code === 'missing-player-sprite')).toBe(true);
      expect(snapshot.mediaFallbacks.some(w => w.code === 'missing-sfx')).toBe(true);

      expect(() => host.movePlayer(0.1, 0, 0.1)).not.toThrow();
      expect(() => host.choose({ uid: 'c1', label: 'x', action: '', conditions: [] })).not.toThrow();
    });

    test('resolvePlayerPositionSafe falls back to entry when save position is absent', () => {
      const position = resolvePlayerPositionSafe(
        {
          location: 'room',
          instability: 0,
          reality_layer: 0,
          memory: {},
          variables: {},
          dialogueLineIndex: 0,
        },
        { default: { x: 0.33, y: 0.66 } },
      );
      expect(position.usedDefault).toBe(true);
      expect(position.x).toBeCloseTo(0.33);
      expect(position.y).toBeCloseTo(0.66);
    });

    test('collectSceneRuntimeFallbacks reports missing player position', () => {
      const fragment = frag({
        uid: 'f1',
        locationId: 'room',
        adventure: { entry: { default: { x: 0.5, y: 0.75 } } },
      });
      const warnings = collectSceneRuntimeFallbacks(
        fragment,
        {
          location: 'room',
          instability: 0,
          reality_layer: 0,
          memory: {},
          variables: {},
          dialogueLineIndex: 0,
        },
        [],
      );
      expect(warnings.some(w => w.code === 'missing-player-position')).toBe(true);
    });
  });

  describe('editor integrity grouping', () => {
    test('groups issues into must-fix, should-review, and informational sections', () => {
      const project = baseProject([
        frag({
          uid: 'f1',
          locationId: 'room',
          choices: [{ uid: 'c1', label: 'Broken', action: 'goto:missing', conditions: [] }],
          adventure: {
            entry: { default: { x: 0.2, y: 0.8 } },
            interactables: [{
              uid: 'pickup1',
              kind: 'pickup',
              label: 'Item',
              x: 0.5,
              y: 0.5,
              action: 'variables.has_item = true',
              conditions: [],
              sprite: 'ghost.png',
            }],
          },
        }),
      ], {
        assets: [{ id: 'a1', name: 'bg.png', type: 'image', uri: 'file://bg.png', mimeType: 'image/png', size: 1, importedAt: '' }],
        inventory: [{ id: 'lantern', label: 'Lantern', assetName: 'lantern.png', stateKey: 'has_lantern_unused', stateKind: 'variable' }],
      });

      const groups = buildEditorIntegrityGroups(project);
      expect(groups.some(g => g.section === 'must-fix-before-export' && g.items.length > 0)).toBe(true);
      expect(groups.some(g => g.section === 'should-review' && g.items.length > 0)).toBe(true);
      expect(groups.find(g => g.section === 'must-fix-before-export')?.title).toBe('Must fix before export');
    });
  });
});
