import {
  createMobileSessionFromChronicaPackage,
  ingestChronicaPackageForMobilePlayer,
  type ParsedChronicaPackage,
} from '../engine/compat/ingest';
import {
  ECHO_MODULE_ID,
  INSTABILITY_MODULE_ID,
} from '../engine/compat/modules';
import {
  MOBILE_PLAYER_CAPABILITIES,
  MOBILE_PLAYER_TARGET_ID,
  type ChronicaPackageManifest,
  type ChronicaRuntimeTarget,
} from '../engine/compat/package';

const mobilePlayerTarget: ChronicaRuntimeTarget = {
  id: MOBILE_PLAYER_TARGET_ID,
  capabilities: ['narrative', 'choices', 'variables', 'save-load'],
  entryFragmentId: 'f-intro',
  assetProfile: 'mobile',
  presentation: 'stage2d',
};

const godot3dTarget: ChronicaRuntimeTarget = {
  id: 'godot-3d',
  capabilities: ['narrative', 'stage3d', 'terrain'],
  assetProfile: 'godot',
  presentation: 'stage3d',
};

function makeManifest(overrides: Partial<ChronicaPackageManifest> = {}): ChronicaPackageManifest {
  return {
    schemaVersion: 2,
    packageId: 'a0000001-0000-4000-8000-000000000101',
    title: 'Package Under Test',
    entryFragmentId: 'f-intro',
    runtimeTargets: [mobilePlayerTarget],
    ...overrides,
  };
}

const goodFragments: unknown[] = [
  {
    uid: 'f-intro',
    title: 'Intro',
    locationId: 'intro',
    priority: 0,
    conditions: [],
    effects: [],
    text: 'Welcome.',
    choices: [{ uid: 'c-forest', label: 'Forest', action: 'goto:forest', conditions: [] }],
  },
  {
    uid: 'f-forest',
    title: 'Forest',
    locationId: 'forest',
    priority: 0,
    conditions: [],
    effects: [],
    text: 'Trees.',
    choices: [],
  },
];

function makePackage(overrides: Partial<ParsedChronicaPackage> = {}): ParsedChronicaPackage {
  return {
    manifest: makeManifest(),
    fragments: goodFragments,
    ...overrides,
  };
}

describe('ingestChronicaPackageForMobilePlayer', () => {
  test('ingests a valid mobile-player package', () => {
    const result = ingestChronicaPackageForMobilePlayer(makePackage());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.selectedRuntimeTarget?.id).toBe(MOBILE_PLAYER_TARGET_ID);
    expect(result.entryFragmentId).toBe('f-intro');
    expect(result.game.fragments).toHaveLength(2);
    expect(result.game.startLocation).toBe('intro');
    expect(result.warnings).toHaveLength(0);
  });

  test('godot-3d + mobile-player package selects mobile-player', () => {
    const pkg = makePackage({
      manifest: makeManifest({
        runtimeTargets: [godot3dTarget, mobilePlayerTarget],
      }),
    });
    const result = ingestChronicaPackageForMobilePlayer(pkg);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.selectedRuntimeTarget?.id).toBe(MOBILE_PLAYER_TARGET_ID);
  });

  test('rejects a required godot-3d-only package', () => {
    const pkg = makePackage({
      manifest: makeManifest({
        runtimeTargets: [{ ...godot3dTarget, required: true }],
      }),
    });
    const result = ingestChronicaPackageForMobilePlayer(pkg);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('incompatible');
    expect(result.compatibility?.compatibilityLevel).toBe('unsupported');
    expect(result.errors.some(e => e.includes('godot-3d'))).toBe(true);
  });

  test('rejects a package with a missing entry fragment id', () => {
    const pkg = makePackage({
      manifest: makeManifest({
        entryFragmentId: '',
        runtimeTargets: [{ ...mobilePlayerTarget, entryFragmentId: undefined }],
      }),
    });
    const result = ingestChronicaPackageForMobilePlayer(pkg);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Compat validator flags this before ingestion reaches the fragment
    // resolver, so the reason is 'incompatible' — mirroring failure semantics.
    expect(['incompatible', 'missing-entry-fragment']).toContain(result.reason);
  });

  test('rejects when entry fragment id does not exist in fragments', () => {
    const pkg = makePackage({
      manifest: makeManifest({ entryFragmentId: 'f-does-not-exist' }),
      fragments: goodFragments.map(f => ({ ...(f as Record<string, unknown>) })),
    });
    // Wipe target-level override so root-level id is used.
    pkg.manifest.runtimeTargets = [{ ...mobilePlayerTarget, entryFragmentId: undefined }];
    const result = ingestChronicaPackageForMobilePlayer(pkg);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('missing-entry-fragment');
  });

  test('rejects a package with no fragments the runtime can use', () => {
    const pkg = makePackage({
      fragments: [{ terrain: 'grass' }, { camera: 'perspective' }],
    });
    const result = ingestChronicaPackageForMobilePlayer(pkg);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('no-fragments');
    expect(result.unsupportedContent.length).toBeGreaterThan(0);
  });

  test('unsupported content becomes warnings, not a crash', () => {
    const pkg = makePackage({
      fragments: [
        {
          uid: 'f-intro',
          locationId: 'intro',
          title: 'Intro',
          choices: [{ uid: 'c1', label: 'Loop', action: 'goto:intro', conditions: [] }],
          terrain: 'grass',
          camera: { fov: 60 },
        },
      ],
    });
    const result = ingestChronicaPackageForMobilePlayer(pkg);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const paths = result.unsupportedContent.map(r => r.path);
    expect(paths).toEqual(expect.arrayContaining(['fragments[0].terrain', 'fragments[0].camera']));
    expect(result.game.fragments).toHaveLength(1);
  });

  test('drops malformed choices with a report and keeps the rest', () => {
    const pkg = makePackage({
      fragments: [
        {
          uid: 'f-intro',
          locationId: 'intro',
          choices: [
            { uid: 'c-good', label: 'Ok', action: 'goto:intro', conditions: [] },
            { label: 'no-uid', action: 'goto:intro' },
          ],
        },
      ],
    });
    const result = ingestChronicaPackageForMobilePlayer(pkg);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.game.fragments[0].choices).toHaveLength(1);
    expect(result.unsupportedContent.some(r => r.kind === 'choice')).toBe(true);
  });

  test('normalizes characters and assets when present', () => {
    const pkg = makePackage({
      characters: [
        {
          uid: 'ch1',
          characterId: 'elena',
          displayName: 'Elena',
          defaultPortrait: 'elena.png',
          expressions: [{ id: 'default', portrait: 'elena.png' }],
        },
        // Malformed:
        { uid: 'bad-no-characterId' },
      ],
      assets: [
        { id: 'a1', name: 'elena.png', type: 'image', uri: 'assets/elena.png', mimeType: 'image/png', size: 10, importedAt: '2026-01-01T00:00:00Z' },
        { name: 'no-type.png' }, // Malformed — missing type
      ],
    });
    const result = ingestChronicaPackageForMobilePlayer(pkg);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.game.characters).toHaveLength(1);
    expect(result.game.characters[0].characterId).toBe('elena');
    expect(result.game.assets).toHaveLength(1);
    expect(result.game.assets[0].name).toBe('elena.png');
    expect(result.unsupportedContent.some(r => r.kind === 'character')).toBe(true);
    expect(result.unsupportedContent.some(r => r.kind === 'asset')).toBe(true);
  });

  test('carries variables and memory into initialVariables/initialMemory', () => {
    const pkg = makePackage({
      variables: { trust: 5, greeted: false },
      memory: { met_elena: true },
    });
    const result = ingestChronicaPackageForMobilePlayer(pkg);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.game.initialVariables.trust).toBe(5);
    expect(result.game.initialMemory.met_elena).toBe(true);
  });

  test('legacy manifest (no runtimeTargets) ingests through fallback', () => {
    const pkg = makePackage({
      manifest: makeManifest({
        runtimeTargets: undefined,
        capabilities: ['narrative', 'choices'],
      }),
    });
    const result = ingestChronicaPackageForMobilePlayer(pkg);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.selectedRuntimeTarget).toBeUndefined();
    expect(result.compatibility.compatibilityLevel).toBe('playable');
  });

  test('reports package with unknown schemaVersion as incompatible', () => {
    const pkg = makePackage({
      manifest: makeManifest({ schemaVersion: 99 }),
    });
    const result = ingestChronicaPackageForMobilePlayer(pkg);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('incompatible');
  });
});

describe('createMobileSessionFromChronicaPackage', () => {
  test('creates a session that can start and choose', async () => {
    const result = await createMobileSessionFromChronicaPackage(makePackage(), {
      autoStart: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.isStarted).toBe(true);
    expect(result.session.fragment?.locationId).toBe('intro');

    const chooseResult = await result.session.choose(result.session.visibleChoices[0]);
    expect(chooseResult.ok).toBe(true);
    expect(result.session.fragment?.locationId).toBe('forest');
  });

  test('attaches first-party modules when requested', async () => {
    const result = await createMobileSessionFromChronicaPackage(makePackage(), {
      modules: { instability: true, echo: true },
      autoStart: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.modules.has(INSTABILITY_MODULE_ID)).toBe(true);
    expect(result.session.modules.has(ECHO_MODULE_ID)).toBe(true);
  });

  test('uses package module hints when attaching with boolean shortcut', async () => {
    const pkg = makePackage({
      modules: {
        [ECHO_MODULE_ID]: {
          echoes: [{ id: 'e-hint', activationThreshold: 5, manifestationThreshold: 10 }],
        },
      },
    });
    const result = await createMobileSessionFromChronicaPackage(pkg, {
      modules: { echo: true },
      autoStart: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const echoes = result.session.context.getModuleData<
      { id: string; state: string }[]
    >(ECHO_MODULE_ID);
    expect(echoes?.[0]?.id).toBe('e-hint');
  });

  test('session save includes module payloads', async () => {
    const result = await createMobileSessionFromChronicaPackage(makePackage(), {
      modules: { instability: true },
      autoStart: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    await result.session.choose(result.session.visibleChoices[0]);
    const save = result.session.toSave(result.game.installId)!;
    expect(save.modules?.[INSTABILITY_MODULE_ID]).toEqual(
      expect.objectContaining({ version: 1 }),
    );
  });

  test('propagates ingest failures unchanged', async () => {
    const bad = makePackage({
      manifest: makeManifest({
        runtimeTargets: [{ ...godot3dTarget, required: true }],
      }),
    });
    const result = await createMobileSessionFromChronicaPackage(bad);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('incompatible');
    expect(result.session).toBeUndefined();
  });

  test('does not autoStart by default', async () => {
    const result = await createMobileSessionFromChronicaPackage(makePackage());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.isStarted).toBe(false);
  });
});
