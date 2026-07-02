import {
  MOBILE_PLAYER_CAPABILITIES,
  MOBILE_PLAYER_COMPATIBILITY_OPTIONS,
  MOBILE_PLAYER_TARGET_ID,
  createCompatManifestFromMobileProject,
  findEntryFragmentId,
  inferMobilePlayerRuntimeTarget,
  inferProjectCapabilities,
  validateChronicaPackageCompatibility,
} from '../engine/compat/package';
import type { Fragment, Project } from '../engine/types';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    schemaVersion: 2,
    gameId: 'a0000001-0000-4000-8000-0000000000f1',
    id: 'proj-1',
    title: 'A Chronicle',
    description: '',
    startLocation: 'intro',
    initialVariables: {},
    initialMemory: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    assets: [],
    characters: [],
    fragments: [
      {
        uid: 'f-intro', title: 'Intro', locationId: 'intro',
        priority: 0, conditions: [], effects: [], text: '.',
        choices: [{ uid: 'c1', label: 'Go', action: 'goto:intro', conditions: [] }],
      },
    ],
    ...overrides,
  };
}

describe('bridge helpers', () => {
  test('findEntryFragmentId prefers a fragment at the startLocation', () => {
    const project = makeProject({
      fragments: [
        makeFragment('f-other', 'other'),
        makeFragment('f-intro', 'intro'),
      ],
    });
    expect(findEntryFragmentId(project)).toBe('f-intro');
  });

  test('findEntryFragmentId falls back to the first fragment when none match startLocation', () => {
    const project = makeProject({
      startLocation: 'nowhere',
      fragments: [
        makeFragment('f-a', 'a'),
        makeFragment('f-b', 'b'),
      ],
    });
    expect(findEntryFragmentId(project)).toBe('f-a');
  });

  test('inferProjectCapabilities detects dialogue, hotspots, and stage2d only when used', () => {
    const plain = makeProject();
    expect(inferProjectCapabilities(plain)).toEqual(
      expect.arrayContaining(['narrative', 'choices', 'variables', 'save-load', 'modules', 'touch']),
    );
    expect(inferProjectCapabilities(plain)).not.toContain('dialogue');
    expect(inferProjectCapabilities(plain)).not.toContain('hotspots');
    expect(inferProjectCapabilities(plain)).not.toContain('stage2d');

    const rich = makeProject({
      fragments: [
        {
          uid: 'f1', title: 'Rich', locationId: 'intro',
          priority: 0, conditions: [], effects: [], text: '.',
          dialogue: [{ uid: 'l1', text: 'Hello' }],
          choices: [{ uid: 'c1', label: 'ok', action: 'goto:intro', conditions: [] }],
          hotspots: [{ uid: 'h1', label: 'Door', x: 0, y: 0, width: 0.1, height: 0.1, action: 'goto:intro', conditions: [] }],
          stageActors: [{ uid: 'a1', asset: 'sprite.png', x: 0.5, y: 0.9 }],
        },
      ],
    });
    const caps = inferProjectCapabilities(rich);
    expect(caps).toEqual(expect.arrayContaining(['dialogue', 'hotspots', 'stage2d']));
  });

  test('inferMobilePlayerRuntimeTarget produces a target the validator accepts as playable', () => {
    const project = makeProject();
    const target = inferMobilePlayerRuntimeTarget(project);
    expect(target.id).toBe(MOBILE_PLAYER_TARGET_ID);
    expect(target.assetProfile).toBe('mobile');
    expect(target.presentation).toBe('stage2d');
    expect(target.entryFragmentId).toBe('f-intro');
    expect(target.capabilities).toEqual(inferProjectCapabilities(project));
  });

  test('createCompatManifestFromMobileProject makes a playable manifest for the mobile host', () => {
    const project = makeProject();
    const manifest = createCompatManifestFromMobileProject(project, {
      engineVersion: 'chronica-mobile 0.5.0',
    });

    expect(manifest.packageId).toBe(project.gameId);
    expect(manifest.title).toBe('A Chronicle');
    expect(manifest.entryFragmentId).toBe('f-intro');
    expect(manifest.engineVersion).toBe('chronica-mobile 0.5.0');
    expect(manifest.runtimeTargets).toHaveLength(1);
    expect(manifest.runtimeTargets![0].id).toBe(MOBILE_PLAYER_TARGET_ID);
    expect(manifest.optionalModules).toEqual(
      expect.arrayContaining(['chronica.instability', 'chronica.echoes']),
    );
    // Root-level capabilities advertise the full mobile-player capability set.
    expect(manifest.capabilities).toEqual([...MOBILE_PLAYER_CAPABILITIES]);

    const result = validateChronicaPackageCompatibility(manifest, {
      ...MOBILE_PLAYER_COMPATIBILITY_OPTIONS,
      availableModules: ['chronica.instability', 'chronica.echoes'],
    });
    expect(result.ok).toBe(true);
    expect(result.compatibilityLevel).toBe('playable');
    expect(result.missingOptionalModules).toEqual([]);
  });

  test('createCompatManifestFromMobileProject accepts a format manifest for contentHash', () => {
    const project = makeProject();
    const manifest = createCompatManifestFromMobileProject(project, {
      formatManifest: {
        format: 'chronica-package',
        version: 1,
        app: 'Chronica Studio',
        exportedAt: '2026-01-03T00:00:00.000Z',
        title: 'A Chronicle',
        gameId: project.gameId,
        storyContentHash: 'abcd1234',
        assetsManifest: [],
        assetCount: 0,
        storySchemaVersion: 2,
      },
    });
    expect(manifest.contentHash).toBe('abcd1234');
  });

  test('defaults an empty title to Untitled Story', () => {
    const project = makeProject({ title: '' });
    const manifest = createCompatManifestFromMobileProject(project);
    expect(manifest.title).toBe('Untitled Story');
  });

  test('does not include a requiredModules field when none are requested', () => {
    const project = makeProject();
    const manifest = createCompatManifestFromMobileProject(project);
    expect(manifest.requiredModules).toBeUndefined();
  });
});

function makeFragment(uid: string, locationId: string): Fragment {
  return {
    uid, title: uid, locationId,
    priority: 0, conditions: [], effects: [], text: '.',
    choices: [],
  };
}
