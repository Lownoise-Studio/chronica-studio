import { compileProject } from '../engine/compiler';
import {
  isChronicaPackageBytes,
  verifyPackageAssetsManifest,
  validatePackageManifest,
  validatePackageStory,
  MANIFEST_PATH,
  STORY_PATH,
} from '../engine/chronica-package';
import { migrateProject } from '../engine/project-migration';
import {
  buildShowcasePackageBytes,
  validateShowcasePackageBytes,
} from '../demo/showcase-package';
import { getShowcaseProject } from '../demo/showcase-project';
import { parseChronicaPackage } from '../storage/chronica-package-io';
import { ChronicaRuntime } from '../runtime/chronica-runtime';
import { PlayerHost } from '../runtime/player-host';
import { decodeZip, getZipTextFile, zipEntryMap } from '../storage/zip-store';

jest.mock('@/storage/fileSystem', () => ({
  assetDir: (id: string) => `/data/mock/pse_assets/${id}/`,
  ensureDir: jest.fn().mockResolvedValue(undefined),
  writeBytes: jest.fn().mockResolvedValue(undefined),
  readBytes: jest.fn(),
  fileExists: jest.fn().mockResolvedValue(true),
  toLocalFileUri: (path: string) => (path.startsWith('file://') ? path : `file://${path}`),
  documentDirectory: '/data/mock/',
}));

async function importShowcaseGame() {
  const bytes = buildShowcasePackageBytes('2026-06-22T12:00:00.000Z');
  const result = await parseChronicaPackage(bytes, 'demo-import');
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.project;
}

describe('showcase demo package', () => {
  test('builds valid .chronica with cast, dialogue assets, and integrity checks', async () => {
    const bytes = buildShowcasePackageBytes('2026-06-22T12:00:00.000Z');
    expect(isChronicaPackageBytes(bytes)).toBe(true);

    const { manifest, story, assets } = validateShowcasePackageBytes(bytes);
    expect(manifest.ok).toBe(true);
    expect(story.ok).toBe(true);
    expect(assets.ok).toBe(true);

    const project = await importShowcaseGame();
    expect(project.characters).toHaveLength(1);
    expect(project.characters[0]?.displayName).toBe('Elena');
    expect(project.fragments).toHaveLength(7);
    expect(project.fragments[0]?.dialogue?.length).toBeGreaterThanOrEqual(3);
    expect(project.fragments[2]?.hotspots?.length).toBe(1);
    expect(project.fragments[3]?.hotspots?.length).toBe(1);
    expect(project.assets.length).toBeGreaterThanOrEqual(9);
  });

  test('compiles cleanly after package import', async () => {
    const project = await importShowcaseGame();
    const compiled = compileProject(migrateProject(project));
    expect(compiled.ok).toBe(true);
  });

  test('manifest and story inside zip pass validation', () => {
    const bytes = buildShowcasePackageBytes('2026-06-22T12:00:00.000Z');
    const map = zipEntryMap(decodeZip(bytes));
    const manifest = validatePackageManifest(JSON.parse(getZipTextFile(map, MANIFEST_PATH)!));
    const story = validatePackageStory(JSON.parse(getZipTextFile(map, STORY_PATH)!));
    expect(manifest.ok).toBe(true);
    expect(story.ok).toBe(true);
    if (!manifest.ok) return;

    const assets = verifyPackageAssetsManifest(
      path => map.get(path),
      manifest.manifest.assetsManifest,
    );
    expect(assets.ok).toBe(true);
  });
});

describe('showcase demo gameplay', () => {
  async function startRuntime() {
    const project = await importShowcaseGame();
    const compiled = compileProject(migrateProject(project));
    if (!compiled.ok) throw new Error('compile failed');
    const rt = new ChronicaRuntime(compiled.game);
    rt.start();
    return rt;
  }

  function exhaustDialogue(rt: ChronicaRuntime) {
    while (rt.getDialoguePresentation()?.canAdvance) {
      rt.advanceDialogue();
    }
  }

  function reachBridgeViaEngine(rt: ChronicaRuntime) {
    exhaustDialogue(rt);
    rt.choose(rt.visibleChoices.find(c => c.action === 'goto:corridor')!);
    exhaustDialogue(rt);
    rt.choose(rt.visibleChoices.find(c => c.action === 'goto:engine')!);
    exhaustDialogue(rt);
    rt.activateHotspot(rt.visibleHotspots[0]!);
    rt.choose(rt.visibleChoices.find(c => c.action === 'goto:bridge')!);
  }

  test('dialogue advances before choices appear', async () => {
    const rt = await startRuntime();
    expect(rt.currentFragment?.locationId).toBe('briefing');
    expect(rt.visibleChoices).toHaveLength(0);
    expect(rt.getDialoguePresentation()?.canAdvance).toBe(true);

    exhaustDialogue(rt);
    expect(rt.getDialoguePresentation()?.exhausted).toBe(true);
    expect(rt.visibleChoices).toHaveLength(1);
  });

  test('hotspot sets variable and reveals gated choice on the bridge', async () => {
    const rt = await startRuntime();
    reachBridgeViaEngine(rt);
    expect(rt.currentFragment?.locationId).toBe('bridge');
    expect(rt.runtimeState?.variables.power_routed).toBe(true);

    exhaustDialogue(rt);
    expect(rt.visibleHotspots).toHaveLength(1);
    expect(rt.visibleChoices).toHaveLength(0);

    rt.activateHotspot(rt.visibleHotspots[0]!);
    expect(rt.runtimeState?.variables.console_inspected).toBe(true);
    expect(rt.visibleHotspots).toHaveLength(0);
    expect(rt.visibleChoices).toHaveLength(1);
    expect(rt.visibleChoices[0]?.label).toBe('Enter the sealed conduit');
  });

  test('conduit vault choice stays locked until both variables are set', async () => {
    const rt = await startRuntime();
    exhaustDialogue(rt);
    rt.choose(rt.visibleChoices.find(c => c.action === 'goto:corridor')!);
    exhaustDialogue(rt);
    rt.choose(rt.visibleChoices.find(c => c.action === 'goto:bridge')!);
    exhaustDialogue(rt);
    rt.activateHotspot(rt.visibleHotspots[0]!);
    rt.choose(rt.visibleChoices.find(c => c.action === 'goto:conduit')!);
    exhaustDialogue(rt);

    expect(rt.visibleChoices.find(c => c.action === 'goto:vault')).toBeUndefined();
    expect(rt.visibleChoices.find(c => c.action === 'goto:bridge')).toBeTruthy();
  });

  test('full tour reaches the epilogue', async () => {
    const rt = await startRuntime();
    reachBridgeViaEngine(rt);
    exhaustDialogue(rt);
    rt.activateHotspot(rt.visibleHotspots[0]!);
    rt.choose(rt.visibleChoices.find(c => c.action === 'goto:conduit')!);
    exhaustDialogue(rt);
    rt.choose(rt.visibleChoices.find(c => c.action === 'goto:vault')!);

    expect(rt.currentFragment?.locationId).toBe('vault');
    exhaustDialogue(rt);
    rt.choose(rt.visibleChoices.find(c => c.action === 'goto:epilogue')!);
    expect(rt.currentFragment?.locationId).toBe('epilogue');
    expect(rt.getDialoguePresentation()?.speakerName).toBe('Elena');
  });

  test('save/resume preserves dialogue progress', async () => {
    const project = await importShowcaseGame();
    const compiled = compileProject(migrateProject(project));
    if (!compiled.ok) throw new Error('compile failed');

    const host = PlayerHost.create(compiled.game);
    host.startNew();
    host.advanceDialogue();
    host.advanceDialogue();
    expect(host.snapshot().state?.dialogueLineIndex).toBe(2);

    const save = host.toSave(project.id);
    expect(save).not.toBeNull();

    const resumed = PlayerHost.create(compiled.game);
    const result = resumed.tryResume(save!);
    expect(result.ok).toBe(true);
    expect(resumed.snapshot().state?.dialogueLineIndex).toBe(2);
    expect(resumed.snapshot().dialogue?.lineIndex).toBe(2);
  });
});

describe('showcase source project', () => {
  test('raw showcase project compiles without import', () => {
    const result = compileProject(getShowcaseProject());
    expect(result.ok).toBe(true);
  });
});
