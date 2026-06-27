import { compileProject } from '../engine/compiler';
import { isChronicaPackageBytes } from '../engine/chronica-package';
import { migrateProject } from '../engine/project-migration';
import {
  buildPasturePackageBytes,
  validatePasturePackageBytes,
} from '../demo/pasture-package';
import { getPastureProject, PASTURE_GAME_ID } from '../demo/pasture-project';
import { parseChronicaPackage } from '../storage/chronica-package-io';
import { ChronicaRuntime } from '../runtime/chronica-runtime';
import { PlayerHost } from '../runtime/player-host';

jest.mock('@/storage/fileSystem', () => ({
  assetDir: (id: string) => `/data/mock/pse_assets/${id}/`,
  ensureDir: jest.fn().mockResolvedValue(undefined),
  writeBytes: jest.fn().mockResolvedValue(undefined),
  readBytes: jest.fn(),
  fileExists: jest.fn().mockResolvedValue(true),
  toLocalFileUri: (path: string) => (path.startsWith('file://') ? path : `file://${path}`),
  documentDirectory: '/data/mock/',
}));

async function importPastureGame() {
  const bytes = buildPasturePackageBytes('2026-06-22T12:00:00.000Z');
  const result = await parseChronicaPackage(bytes, 'pasture-import');
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.project;
}

describe('pasture demo package', () => {
  test('builds valid .chronica with stage actors and time-of-day variants', () => {
    const bytes = buildPasturePackageBytes('2026-06-22T12:00:00.000Z');
    expect(isChronicaPackageBytes(bytes)).toBe(true);

    const { manifest, story, assets, map } = validatePasturePackageBytes(bytes);
    expect(manifest.ok).toBe(true);
    expect(story.ok).toBe(true);
    expect(assets.ok).toBe(true);
    if (!story.ok) return;

    expect(story.story.gameId).toBe(PASTURE_GAME_ID);
    expect(story.story.fragments.filter(f => f.locationId === 'pasture')).toHaveLength(4);
    expect(story.story.fragments[0]?.stageActors?.length).toBeGreaterThan(0);

    const morningBg = map.get('assets/pasture-morning.jpg');
    expect(morningBg).toBeTruthy();
    expect(morningBg!.length).toBeGreaterThan(1000);
    expect(morningBg![0]).toBe(0xff);
    expect(morningBg![1]).toBe(0xd8);

    const cowIdle = map.get('assets/cow-idle.png');
    expect(cowIdle).toBeTruthy();
    expect(cowIdle!.length).toBeGreaterThan(100);
    expect(cowIdle!.slice(0, 4)).toEqual(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
  });

  test('compiles after import', async () => {
    const project = await importPastureGame();
    expect(compileProject(migrateProject(project)).ok).toBe(true);
  });

  test('raw pasture project compiles without import', () => {
    expect(compileProject(getPastureProject()).ok).toBe(true);
  });
});

describe('pasture demo gameplay', () => {
  async function startHost() {
    const project = await importPastureGame();
    const compiled = compileProject(migrateProject(project));
    if (!compiled.ok) throw new Error('compile failed');
    const host = PlayerHost.create(compiled.game);
    host.startNew();
    return host;
  }

  function exhaustDialogue(host: PlayerHost) {
    while (host.snapshot().dialogue?.canAdvance) {
      host.advanceDialogue();
    }
  }

  test('opens on morning pasture with cow sprite on stage', async () => {
    const host = await startHost();
    exhaustDialogue(host);
    const snap = host.snapshot();
    expect(snap.fragment?.title).toContain('Morning');
    expect(snap.stageActors.some(a => a.assetName === 'cow-idle.png')).toBe(true);
    expect(snap.visibleHotspots.length).toBeGreaterThan(0);
  });

  test('grass hotspot switches cow to grazing expression', async () => {
    const host = await startHost();
    exhaustDialogue(host);
    const grass = host.snapshot().visibleHotspots.find(h => h.label === 'Grass patch');
    expect(grass).toBeTruthy();
    host.activateHotspot(grass!);
    expect(host.snapshot().stageActors[0]?.assetName).toBe('cow-graze.png');
    expect(host.snapshot().state?.variables.cow_state).toBe('grazing');
  });

  test('time hotspot advances to afternoon at the same location', async () => {
    const host = await startHost();
    exhaustDialogue(host);
    const watch = host.snapshot().visibleHotspots.find(h => h.label === 'Watch the morning pass');
    expect(watch).toBeTruthy();
    host.activateHotspot(watch!);
    const snap = host.snapshot();
    expect(snap.state?.variables.time).toBe('afternoon');
    expect(snap.fragment?.title).toContain('Afternoon');
    expect(snap.stageActors[0]?.assetName).toBe('cow-idle.png');
  });

  test('full day cycle reaches night with star on stage', async () => {
    const host = await startHost();
    exhaustDialogue(host);

    for (const label of ['Watch the morning pass', 'Wait for sunset', 'Let night fall']) {
      exhaustDialogue(host);
      const hotspot = host.snapshot().visibleHotspots.find(h => h.label === label);
      expect(hotspot).toBeTruthy();
      host.activateHotspot(hotspot!);
    }

    const snap = host.snapshot();
    expect(snap.state?.variables.time).toBe('night');
    expect(snap.fragment?.title).toContain('Night');
    expect(snap.stageActors.some(a => a.assetName === 'star.png')).toBe(true);
  });

  test('save and resume preserve cow state', async () => {
    const project = await importPastureGame();
    const compiled = compileProject(migrateProject(project));
    if (!compiled.ok) throw new Error('compile failed');

    const rt = new ChronicaRuntime(compiled.game);
    rt.start();
    rt.advanceDialogue();
    rt.advanceDialogue();
    rt.activateHotspot(rt.visibleHotspots.find(h => h.label === 'Grass patch')!);
    const save = rt.toSave(project.id)!;

    const rt2 = new ChronicaRuntime(compiled.game);
    expect(rt2.tryResume(save)).toEqual({ ok: true });
    expect(rt2.runtimeState?.variables.cow_state).toBe('grazing');
  });
});
