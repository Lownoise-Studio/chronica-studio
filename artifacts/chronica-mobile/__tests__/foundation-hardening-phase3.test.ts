import {
  checkPackageCompatibility,
  checkProjectPlayCompatibility,
  deriveProjectCapabilities,
  MOBILE_PLAYER_RUNTIME_CAPABILITIES,
  NARRATIVE_ONLY_RUNTIME_CAPABILITIES,
  type FoundationFeature,
} from '../engine/package-compatibility';
import { ingestChronicaPackageForMobilePlayer } from '../engine/compat/ingest';
import { getHarborLanternAdventureProject } from '../demo/harbor-lantern-adventure';
import { buildCompiledGame } from '../engine/compiler/build-compiled-game';
import { PlayerHost } from '../runtime/player-host';
import type { Fragment, Project } from '../engine/types';

function frag(partial: Partial<Fragment> & Pick<Fragment, 'uid' | 'locationId'>): Fragment {
  return {
    title: partial.locationId,
    priority: 0,
    conditions: [],
    effects: [],
    text: 'Scene text',
    choices: [],
    ...partial,
  };
}

function baseProject(fragments: Fragment[], overrides: Partial<Project> = {}): Project {
  return {
    schemaVersion: 2,
    gameId: 'a0000001-0000-4000-8000-000000000099',
    id: 'p1',
    title: 'Compat Tale',
    description: '',
    startLocation: fragments[0]?.locationId ?? 'intro',
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

function parsedPackageFromProject(project: Project) {
  const entry = project.fragments.find(f => f.locationId === project.startLocation) ?? project.fragments[0];
  return {
    manifest: {
      schemaVersion: project.schemaVersion,
      packageId: project.gameId,
      title: project.title,
      entryFragmentId: entry?.uid ?? '',
      capabilities: ['narrative', 'choices'],
    },
    fragments: project.fragments,
    assets: project.assets,
    characters: project.characters,
  };
}

describe('foundation hardening phase 3 — package/runtime compatibility', () => {
  describe('capability derivation', () => {
    test('narrative-only project requires only narrative_fragments', () => {
      const project = baseProject([
        frag({
          uid: 'f1',
          locationId: 'intro',
          choices: [{ uid: 'c1', label: 'Next', action: 'goto:next', conditions: [] }],
        }),
        frag({ uid: 'f2', locationId: 'next' }),
      ]);
      const caps = deriveProjectCapabilities(project);
      expect(caps.required).toEqual(['narrative_fragments']);
      expect(caps.optional).toEqual([]);
    });

    test('project with assets but no adventure treats assets as optional', () => {
      const project = baseProject([
        frag({
          uid: 'f1',
          locationId: 'intro',
          backgroundImage: 'forest.png',
        }),
      ], {
        assets: [{
          id: 'a1',
          name: 'forest.png',
          type: 'image',
          uri: 'file://forest.png',
          mimeType: 'image/png',
          size: 1,
          importedAt: '',
        }],
      });
      const caps = deriveProjectCapabilities(project);
      expect(caps.required).toEqual(['narrative_fragments']);
      expect(caps.optional).toContain('assets');
    });

    test('adventure scenes require adventure_runtime', () => {
      const project = baseProject([
        frag({
          uid: 'f1',
          locationId: 'dock',
          adventure: {
            entry: { default: { x: 0.2, y: 0.8 } },
            interactables: [{
              uid: 'npc1',
              kind: 'npc',
              label: 'Guide',
              x: 0.5,
              y: 0.5,
              action: '',
              conditions: [],
            }],
          },
        }),
      ]);
      expect(deriveProjectCapabilities(project).required).toContain('adventure_runtime');
    });
  });

  describe('checkPackageCompatibility', () => {
    test('old narrative-only package is compatible with mobile runtime', () => {
      const project = baseProject([frag({ uid: 'f1', locationId: 'intro' })]);
      const result = checkProjectPlayCompatibility(project);
      expect(result.compatible).toBe(true);
      expect(result.blockers).toHaveLength(0);
    });

    test('package with assets but no adventure loads on mobile runtime', () => {
      const project = baseProject([
        frag({ uid: 'f1', locationId: 'intro', backgroundImage: 'bg.png' }),
      ], {
        assets: [{
          id: 'a1',
          name: 'bg.png',
          type: 'image',
          uri: 'file://bg.png',
          mimeType: 'image/png',
          size: 1,
          importedAt: '',
        }],
      });
      const result = checkProjectPlayCompatibility(project);
      expect(result.compatible).toBe(true);
      expect(result.requiredFeatures).toEqual(['narrative_fragments']);
      expect(result.optionalFeatures).toContain('assets');
    });

    test('adventure package blocks on narrative-only runtime', () => {
      const project = getHarborLanternAdventureProject();
      const result = checkProjectPlayCompatibility(project, NARRATIVE_ONLY_RUNTIME_CAPABILITIES);
      expect(result.compatible).toBe(false);
      expect(result.blockers.some(message => message.includes('adventure_runtime'))).toBe(true);
      expect(result.unsupportedFeatures).toContain('adventure_runtime');
      expect(result.safeFallbacks.adventure_runtime).toBeTruthy();
    });

    test('optional unsupported features warn and describe safe fallbacks', () => {
      const project = baseProject([
        frag({
          uid: 'f1',
          locationId: 'intro',
          stageAuthoring: {
            objects: [{ uid: 'o1', asset: 'prop.png', x: 0.5, y: 0.5, layer: 'props' }],
          },
        }),
      ]);
      const limitedRuntime = {
        schemaVersionMin: 1,
        schemaVersionMax: 3,
        supportedFeatures: ['narrative_fragments'] as FoundationFeature[],
      };
      const result = checkPackageCompatibility(
        { schemaVersion: 2, project },
        limitedRuntime,
      );
      expect(result.compatible).toBe(true);
      expect(result.warnings.some(message => message.includes('stage_preview'))).toBe(true);
      expect(result.safeFallbacks.stage_preview).toContain('ignored');
    });

    test('newer schema version produces warning on mobile runtime', () => {
      const project = baseProject([frag({ uid: 'f1', locationId: 'intro' })], { schemaVersion: 3 });
      const result = checkProjectPlayCompatibility(project);
      expect(result.compatible).toBe(true);
      expect(result.warnings.some(message => message.includes('schemaVersion 3'))).toBe(true);
    });
  });

  describe('runtime loading safeguards', () => {
    test('ingest rejects adventure package when runtime lacks adventure support', () => {
      const project = getHarborLanternAdventureProject();
      const result = ingestChronicaPackageForMobilePlayer(parsedPackageFromProject(project), {
        runtimeCapabilities: NARRATIVE_ONLY_RUNTIME_CAPABILITIES,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe('feature-incompatible');
      expect(result.errors.some(message => message.includes('adventure_runtime'))).toBe(true);
    });

    test('ingest accepts narrative-only package on mobile runtime', () => {
      const project = baseProject([
        frag({
          uid: 'f1',
          locationId: 'intro',
          choices: [{ uid: 'c1', label: 'Next', action: 'goto:next', conditions: [] }],
        }),
        frag({ uid: 'f2', locationId: 'next' }),
      ]);
      const result = ingestChronicaPackageForMobilePlayer(parsedPackageFromProject(project));
      expect(result.ok).toBe(true);
    });

    test('runtime fallbacks continue when optional assets are missing', () => {
      const project = baseProject([
        frag({
          uid: 'f1',
          locationId: 'intro',
          backgroundImage: 'missing.png',
          adventure: {
            entry: { default: { x: 0.5, y: 0.75 } },
            playerSprite: 'missing_player.png',
          },
        }),
      ]);
      const game = buildCompiledGame(project);
      const host = PlayerHost.create(game);
      expect(() => host.startNew()).not.toThrow();
      const snapshot = host.snapshot();
      expect(snapshot.mediaFallbacks.some(item => item.code === 'missing-background')).toBe(true);
      expect(snapshot.mediaFallbacks.some(item => item.code === 'missing-player-sprite')).toBe(true);
    });
  });

  describe('mobile runtime profile', () => {
    test('mobile runtime advertises all foundation features', () => {
      expect(MOBILE_PLAYER_RUNTIME_CAPABILITIES.supportedFeatures).toEqual(
        expect.arrayContaining([
          'narrative_fragments',
          'assets',
          'stage_preview',
          'adventure_runtime',
          'asset_recipes',
          'playable_room_generation',
        ]),
      );
    });
  });
});
