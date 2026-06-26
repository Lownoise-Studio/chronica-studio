import {
  CHRONICA_PACKAGE_FORMAT,
  MANIFEST_PATH,
  STORY_PATH,
  PACKAGE_LIMITS,
  buildAssetsManifest,
  planChronicaPackage,
  validatePackageEntryStructure,
  type ChronicaPackageManifest,
} from '../engine/chronica-package';
import { computeProjectContentHash } from '../engine/compiler/build-compiled-game';
import { compileProject } from '../engine/compiler';
import { ChronicaRuntime } from '../runtime/chronica-runtime';
import {
  buildChronicaPackageBytes,
  parseChronicaPackage,
} from '../storage/chronica-package-io';
import { encodeZip } from '../storage/zip-store';
import type { Project } from '../engine/types';

const mockWritten = new Map<string, Uint8Array>();

jest.mock('@/storage/fileSystem', () => ({
  assetDir: (id: string) => `/data/mock/pse_assets/${id}/`,
  ensureDir: jest.fn().mockResolvedValue(undefined),
  writeBytes: jest.fn(async (uri: string, data: Uint8Array) => {
    mockWritten.set(uri, data);
  }),
  readBytes: jest.fn(),
  fileExists: jest.fn().mockResolvedValue(true),
  toLocalFileUri: (path: string) => (path.startsWith('file://') ? path : `file://${path}`),
  documentDirectory: '/data/mock/',
}));

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ENC = new TextEncoder();

function makeProject(): Project {
  return {
    schemaVersion: 2,
    gameId: 'a0000001-0000-4000-8000-000000000099',
    id: 'story-1',
    title: 'Forest Tale',
    description: '',
    startLocation: 'intro',
    initialVariables: {},
    initialMemory: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    assets: [
      {
        id: 'a1',
        name: 'forest.jpg',
        type: 'image' as const,
        uri: 'file:///device/pse_assets/story-1/forest.jpg',
        mimeType: 'image/jpeg',
        size: PNG_BYTES.length,
        importedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    characters: [],
    fragments: [
      {
        uid: 'f1',
        title: 'Intro',
        locationId: 'intro',
        priority: 0,
        conditions: [],
        effects: [],
        text: 'Welcome.',
        choices: [],
        backgroundImage: 'forest.jpg',
      },
    ],
  };
}

/** A structurally-correct manifest object for makeProject's story. */
function goodManifest(plan: ReturnType<typeof planChronicaPackage>, overrides: Record<string, unknown> = {}) {
  return {
    ...plan.manifest,
    assetsManifest: buildAssetsManifest([{ path: 'assets/forest.jpg', data: PNG_BYTES }]),
    assetCount: 1,
    storyContentHash: computeProjectContentHash(plan.story),
    ...overrides,
  } as ChronicaPackageManifest & Record<string, unknown>;
}

type Entry = { path: string; data: Uint8Array };

function zipFrom(parts: Entry[]): Uint8Array {
  return encodeZip(parts);
}

function standardEntries(
  plan: ReturnType<typeof planChronicaPackage>,
  manifestOverrides: Record<string, unknown> = {},
): Entry[] {
  return [
    { path: MANIFEST_PATH, data: ENC.encode(JSON.stringify(goodManifest(plan, manifestOverrides))) },
    { path: STORY_PATH, data: ENC.encode(JSON.stringify(plan.story)) },
    { path: 'assets/forest.jpg', data: PNG_BYTES },
  ];
}

async function expectReason(bytes: Uint8Array, reason: string, id = 'imp') {
  const result = await parseChronicaPackage(bytes, id);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('expected failure');
  expect(result.reason).toBe(reason);
  return result;
}

let plan: ReturnType<typeof planChronicaPackage>;

beforeEach(() => {
  mockWritten.clear();
  plan = planChronicaPackage(makeProject(), () => true, '2026-06-22T12:00:00.000Z');
});

describe('package boundary — typed import failures', () => {
  test('truncated / invalid ZIP bytes -> invalid-zip', async () => {
    await expectReason(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x01]), 'invalid-zip');
  });

  test('missing manifest -> missing-manifest', async () => {
    const bytes = zipFrom([
      { path: STORY_PATH, data: ENC.encode(JSON.stringify(plan.story)) },
      { path: 'assets/forest.jpg', data: PNG_BYTES },
    ]);
    await expectReason(bytes, 'missing-manifest');
  });

  test('missing story -> missing-story', async () => {
    const bytes = zipFrom([
      { path: MANIFEST_PATH, data: ENC.encode(JSON.stringify(goodManifest(plan))) },
      { path: 'assets/forest.jpg', data: PNG_BYTES },
    ]);
    await expectReason(bytes, 'missing-story');
  });

  test('duplicate manifest -> duplicate-manifest', async () => {
    const m = ENC.encode(JSON.stringify(goodManifest(plan)));
    const bytes = zipFrom([
      { path: MANIFEST_PATH, data: m },
      { path: MANIFEST_PATH, data: m },
      { path: STORY_PATH, data: ENC.encode(JSON.stringify(plan.story)) },
      { path: 'assets/forest.jpg', data: PNG_BYTES },
    ]);
    await expectReason(bytes, 'duplicate-manifest');
  });

  test('duplicate story -> duplicate-story', async () => {
    const s = ENC.encode(JSON.stringify(plan.story));
    const bytes = zipFrom([
      { path: MANIFEST_PATH, data: ENC.encode(JSON.stringify(goodManifest(plan))) },
      { path: STORY_PATH, data: s },
      { path: STORY_PATH, data: s },
      { path: 'assets/forest.jpg', data: PNG_BYTES },
    ]);
    await expectReason(bytes, 'duplicate-story');
  });

  test('duplicate normalized asset path -> duplicate-asset-path', async () => {
    const bytes = zipFrom([
      { path: MANIFEST_PATH, data: ENC.encode(JSON.stringify(goodManifest(plan))) },
      { path: STORY_PATH, data: ENC.encode(JSON.stringify(plan.story)) },
      { path: 'assets/forest.jpg', data: PNG_BYTES },
      { path: 'assets/Forest.jpg', data: PNG_BYTES }, // case-collides on extraction
    ]);
    await expectReason(bytes, 'duplicate-asset-path');
  });

  test('../ zip-slip path -> path-traversal', async () => {
    const bytes = zipFrom([
      { path: MANIFEST_PATH, data: ENC.encode(JSON.stringify(goodManifest(plan))) },
      { path: STORY_PATH, data: ENC.encode(JSON.stringify(plan.story)) },
      { path: 'assets/../../../etc/passwd', data: PNG_BYTES },
      { path: 'assets/forest.jpg', data: PNG_BYTES },
    ]);
    await expectReason(bytes, 'path-traversal');
  });

  test('absolute / unexpected top-level entry -> unexpected-entry', async () => {
    // A leading-slash path normalizes to a top-level non-asset entry.
    const bytes = zipFrom([
      { path: MANIFEST_PATH, data: ENC.encode(JSON.stringify(goodManifest(plan))) },
      { path: STORY_PATH, data: ENC.encode(JSON.stringify(plan.story)) },
      { path: '/etc/passwd', data: PNG_BYTES },
      { path: 'assets/forest.jpg', data: PNG_BYTES },
    ]);
    await expectReason(bytes, 'unexpected-entry');
  });

  test('stripped storyContentHash -> invalid-manifest', async () => {
    const m = goodManifest(plan) as Record<string, unknown>;
    delete m.storyContentHash;
    const bytes = zipFrom([
      { path: MANIFEST_PATH, data: ENC.encode(JSON.stringify(m)) },
      { path: STORY_PATH, data: ENC.encode(JSON.stringify(plan.story)) },
      { path: 'assets/forest.jpg', data: PNG_BYTES },
    ]);
    const result = await expectReason(bytes, 'invalid-manifest');
    expect(result.error).toContain('storyContentHash');
  });

  test('stripped assetsManifest -> invalid-manifest', async () => {
    const m = goodManifest(plan) as Record<string, unknown>;
    delete m.assetsManifest;
    const bytes = zipFrom([
      { path: MANIFEST_PATH, data: ENC.encode(JSON.stringify(m)) },
      { path: STORY_PATH, data: ENC.encode(JSON.stringify(plan.story)) },
    ]);
    const result = await expectReason(bytes, 'invalid-manifest');
    expect(result.error).toContain('assetsManifest');
  });

  test('assetCount mismatch -> invalid-manifest', async () => {
    const bytes = zipFrom(standardEntries(plan, { assetCount: 5 }));
    await expectReason(bytes, 'invalid-manifest');
  });

  test('missing zip asset (listed but absent) -> missing-asset', async () => {
    const bytes = zipFrom([
      { path: MANIFEST_PATH, data: ENC.encode(JSON.stringify(goodManifest(plan))) },
      { path: STORY_PATH, data: ENC.encode(JSON.stringify(plan.story)) },
    ]);
    await expectReason(bytes, 'missing-asset');
  });

  test('corrupt CRC asset -> corrupt-asset', async () => {
    const tampered = new Uint8Array(PNG_BYTES);
    tampered[0] = 0x00;
    // manifest CRC is for original PNG_BYTES; zip ships tampered bytes of same length.
    const m = goodManifest(plan); // crc/size from PNG_BYTES
    const bytes = zipFrom([
      { path: MANIFEST_PATH, data: ENC.encode(JSON.stringify(m)) },
      { path: STORY_PATH, data: ENC.encode(JSON.stringify(plan.story)) },
      { path: 'assets/forest.jpg', data: tampered },
    ]);
    await expectReason(bytes, 'corrupt-asset');
  });

  test('wrong asset size -> corrupt-asset', async () => {
    const bigger = new Uint8Array([...PNG_BYTES, 0x00, 0x00]);
    const m = goodManifest(plan); // size from PNG_BYTES
    const bytes = zipFrom([
      { path: MANIFEST_PATH, data: ENC.encode(JSON.stringify(m)) },
      { path: STORY_PATH, data: ENC.encode(JSON.stringify(plan.story)) },
      { path: 'assets/forest.jpg', data: bigger },
    ]);
    const result = await expectReason(bytes, 'corrupt-asset');
    expect(result.error).toContain('size mismatch');
  });

  test('unsupported package version -> unsupported-package-version', async () => {
    const bytes = zipFrom(standardEntries(plan, { version: 999 }));
    await expectReason(bytes, 'unsupported-package-version');
  });

  test('unsupported story schema version -> unsupported-schema-version', async () => {
    const story = { ...plan.story, schemaVersion: 999 };
    const m = goodManifest(plan, { storyContentHash: computeProjectContentHash(story) });
    const bytes = zipFrom([
      { path: MANIFEST_PATH, data: ENC.encode(JSON.stringify(m)) },
      { path: STORY_PATH, data: ENC.encode(JSON.stringify(story)) },
      { path: 'assets/forest.jpg', data: PNG_BYTES },
    ]);
    await expectReason(bytes, 'unsupported-schema-version');
  });

  test('gameId mismatch -> gameid-mismatch', async () => {
    const story = { ...plan.story, gameId: 'b0000002-0000-4000-8000-000000000000' };
    const m = goodManifest(plan, { storyContentHash: computeProjectContentHash(story) });
    const bytes = zipFrom([
      { path: MANIFEST_PATH, data: ENC.encode(JSON.stringify(m)) },
      { path: STORY_PATH, data: ENC.encode(JSON.stringify(story)) },
      { path: 'assets/forest.jpg', data: PNG_BYTES },
    ]);
    await expectReason(bytes, 'gameid-mismatch');
  });

  test('hash mismatch -> hash-mismatch', async () => {
    const bytes = zipFrom(standardEntries(plan, { storyContentHash: 'deadbeefdeadbeef' }));
    await expectReason(bytes, 'hash-mismatch');
  });

  test('extra unlisted asset -> unexpected-entry', async () => {
    const bytes = zipFrom([
      { path: MANIFEST_PATH, data: ENC.encode(JSON.stringify(goodManifest(plan))) },
      { path: STORY_PATH, data: ENC.encode(JSON.stringify(plan.story)) },
      { path: 'assets/forest.jpg', data: PNG_BYTES },
      { path: 'assets/stowaway.bin', data: new Uint8Array([9, 9, 9]) },
    ]);
    await expectReason(bytes, 'unexpected-entry');
  });

  test('oversized package -> oversized-package', async () => {
    const fake = new Uint8Array(PACKAGE_LIMITS.maxPackageBytes + 1);
    // PK signature so it looks like a zip; size guard rejects before decode.
    fake[0] = 0x50; fake[1] = 0x4b;
    await expectReason(fake, 'oversized-package');
  });

  test('compile-failed -> compile-failed with diagnostics', async () => {
    const project = makeProject();
    project.fragments[0].choices = [{ uid: 'c1', label: 'Broken', action: 'goto:nowhere', conditions: [] }];
    const broken = planChronicaPackage(project, () => true, '2026-06-22T12:00:00.000Z');
    const bytes = zipFrom([
      { path: MANIFEST_PATH, data: ENC.encode(JSON.stringify(goodManifest(broken))) },
      { path: STORY_PATH, data: ENC.encode(JSON.stringify(broken.story)) },
      { path: 'assets/forest.jpg', data: PNG_BYTES },
    ]);
    const result = await expectReason(bytes, 'compile-failed');
    expect(result.diagnostics?.length).toBeGreaterThan(0);
  });

  test('manifest with unknown future field is accepted (forward-compat)', async () => {
    const bytes = zipFrom(standardEntries(plan, { someFutureField: { nested: true } }));
    const result = await parseChronicaPackage(bytes, 'future-field');
    expect(result.ok).toBe(true);
  });

  test('manifest missing title is safely defaulted, not rejected', async () => {
    const m = goodManifest(plan) as Record<string, unknown>;
    delete m.title;
    const bytes = zipFrom([
      { path: MANIFEST_PATH, data: ENC.encode(JSON.stringify(m)) },
      { path: STORY_PATH, data: ENC.encode(JSON.stringify(plan.story)) },
      { path: 'assets/forest.jpg', data: PNG_BYTES },
    ]);
    const result = await parseChronicaPackage(bytes, 'no-title');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.manifestTitle).toBeTruthy();
  });
});

describe('structural validator (pure, large-size cases without huge allocation)', () => {
  const minimal = () => [
    { path: MANIFEST_PATH, data: new Uint8Array([1]) },
    { path: STORY_PATH, data: new Uint8Array([1]) },
  ];

  // Fake an entry whose reported byte length exceeds a ceiling, without allocating it.
  const fakeSized = (path: string, length: number): { path: string; data: Uint8Array } => ({
    path,
    data: { length } as unknown as Uint8Array,
  });

  test('oversized individual asset -> oversized-asset', () => {
    const result = validatePackageEntryStructure([
      ...minimal(),
      fakeSized('assets/huge.bin', PACKAGE_LIMITS.maxAssetBytes + 1),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('oversized-asset');
  });

  test('too many assets -> oversized-package', () => {
    const assets = Array.from({ length: PACKAGE_LIMITS.maxAssetCount + 1 }, (_, i) =>
      ({ path: `assets/a${i}.bin`, data: new Uint8Array([1]) }));
    const result = validatePackageEntryStructure([...minimal(), ...assets]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('oversized-package');
  });

  test('oversized story.json -> oversized-package', () => {
    const result = validatePackageEntryStructure([
      { path: MANIFEST_PATH, data: new Uint8Array([1]) },
      fakeSized(STORY_PATH, PACKAGE_LIMITS.maxStoryJsonBytes + 1),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('oversized-package');
  });

  test('directory markers are ignored, not treated as unexpected', () => {
    const result = validatePackageEntryStructure([
      ...minimal(),
      { path: 'assets/', data: new Uint8Array([]) },
    ]);
    expect(result.ok).toBe(true);
  });
});

describe('package boundary — export consistency + full round trip', () => {
  const fs = jest.requireMock('@/storage/fileSystem') as {
    readBytes: jest.Mock;
    fileExists: jest.Mock;
  };

  beforeEach(() => {
    fs.readBytes.mockResolvedValue(PNG_BYTES);
    fs.fileExists.mockResolvedValue(true);
  });

  test('valid round trip: build -> parse -> compile -> runtime -> save -> resume', async () => {
    const built = await buildChronicaPackageBytes(makeProject());
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    // assetCount matches and hash matches exported story.
    expect(built.plan.manifest.assetCount).toBe(built.plan.manifest.assetsManifest.length);
    expect(built.plan.manifest.storyContentHash).toBe(computeProjectContentHash(built.plan.story));

    const imported = await parseChronicaPackage(built.bytes, 'rt-1');
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    const compiled = compileProject(imported.project);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const rt = new ChronicaRuntime(compiled.game);
    rt.start();
    rt.advanceDialogue();
    const save = rt.toSave(imported.project.id)!;

    const rt2 = new ChronicaRuntime(compiled.game);
    expect(rt2.tryResume(save)).toEqual({ ok: true });
    expect(rt2.runtimeState?.location).toBe(save.state.location as string);
  });

  test('export blocks when a referenced asset file is missing on disk', async () => {
    fs.fileExists.mockResolvedValue(false);
    const built = await buildChronicaPackageBytes(makeProject());
    expect(built.ok).toBe(false);
  });
});
