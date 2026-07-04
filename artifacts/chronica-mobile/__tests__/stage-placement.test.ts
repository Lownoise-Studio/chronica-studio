import { compileProject } from '../engine/compiler';
import { computeProjectContentHash } from '../engine/compiler/build-compiled-game';
import {
  createStageObjectFromAsset,
  filterStageAssets,
  insertStageObjectFromAsset,
  layerOrderPreserved,
  mergeStageScenePreset,
  setStageObjectHotspotRef,
  setStageObjectLayer,
  updateStageObjectTransform,
} from '../engine/stage-placement';
import { normalizeStageComposition, sortStageObjectsByLayer } from '../engine/stage-authoring';
import type { Fragment, Project, StageObject } from '../engine/types';

function sampleObject(overrides: Partial<StageObject> = {}): StageObject {
  return {
    uid: 'obj1',
    label: 'Crate',
    asset: 'prop.png',
    x: 0.4,
    y: 0.5,
    scale: 1,
    rotation: 0,
    layer: 'props',
    zIndex: 1,
    ...overrides,
  };
}

function makeProject(fragment: Partial<Fragment> = {}): Project {
  return {
    schemaVersion: 3,
    gameId: 'a0000001-0000-4000-8000-000000000099',
    id: 'p1',
    title: 'Stage Tale',
    description: '',
    startLocation: 'room',
    initialVariables: {},
    initialMemory: {},
    createdAt: '',
    updatedAt: '',
    assets: [
      { id: 'a1', name: 'prop.png', type: 'image', uri: 'file://prop.png', mimeType: 'image/png', size: 1, importedAt: '' },
      { id: 'a2', name: 'theme.mp3', type: 'audio', uri: 'file://theme.mp3', mimeType: 'audio/mpeg', size: 1, importedAt: '' },
    ],
    characters: [],
    fragments: [{
      uid: 'f1',
      title: 'Room',
      locationId: 'room',
      priority: 0,
      conditions: [],
      effects: [],
      text: 'A room.',
      choices: [],
      hotspots: [{
        uid: 'hs1',
        label: 'Lantern',
        x: 0.2,
        y: 0.3,
        width: 0.2,
        height: 0.2,
        action: 'variables.has_lantern = true',
        conditions: [],
      }],
      ...fragment,
    }],
  };
}

describe('stage placement polish', () => {
  test('asset picker inserts stage object from image asset', () => {
    const asset = { name: 'prop.png', type: 'image' as const };
    const { composition, object } = insertStageObjectFromAsset(undefined, asset, {
      createUid: () => 'new-obj',
    });
    expect(composition.objects).toHaveLength(1);
    expect(object.uid).toBe('new-obj');
    expect(object.asset).toBe('prop.png');
    expect(createStageObjectFromAsset(asset, { uid: 'x' }).layer).toBe('props');
  });

  test('asset filter respects type', () => {
    const project = makeProject();
    expect(filterStageAssets(project.assets, 'image')).toHaveLength(1);
    expect(filterStageAssets(project.assets, 'audio')).toHaveLength(1);
    expect(filterStageAssets(project.assets, 'all')).toHaveLength(2);
  });

  test('object transform updates stageAuthoring only', () => {
    const project = makeProject();
    const baseline = compileProject(project);
    expect(baseline.ok).toBe(true);
    if (!baseline.ok) return;

    const object = sampleObject();
    const moved = updateStageObjectTransform(object, { x: 0.7, y: 0.2, scale: 1.5, rotation: 45 });
    expect(moved.x).toBeCloseTo(0.7);
    expect(moved.scale).toBe(1.5);
    expect(moved.rotation).toBe(45);

    const withStage = makeProject({
      stageAuthoring: normalizeStageComposition({ objects: [moved] }),
    });
    const compiled = compileProject(withStage);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    expect(compiled.game.contentHash).toBe(baseline.game.contentHash);
    expect(computeProjectContentHash(withStage)).toBe(computeProjectContentHash(project));
  });

  test('layer changes preserve order for other objects', () => {
    const objects = [
      sampleObject({ uid: 'a', layer: 'props', zIndex: 0 }),
      sampleObject({ uid: 'b', layer: 'props', zIndex: 1 }),
      sampleObject({ uid: 'c', layer: 'foreground', zIndex: 0 }),
    ];
    const changed = setStageObjectLayer(objects[0], 'background');
    const next = objects.map(o => (o.uid === 'a' ? changed : o));
    expect(layerOrderPreserved(objects, next, 'a')).toBe(true);
    expect(sortStageObjectsByLayer(next).map(o => o.uid)).toEqual(['a', 'b', 'c']);
  });

  test('hotspot link selector writes hotspotRef', () => {
    const linked = setStageObjectHotspotRef(sampleObject(), 'hs1');
    expect(linked.hotspotRef).toBe('hs1');
    expect(linked.interactionRef).toBe('hs1');
    const cleared = setStageObjectHotspotRef(linked, undefined);
    expect(cleared.hotspotRef).toBeUndefined();
  });

  test('scene presets merge objects without touching compiler output', () => {
    const project = makeProject();
    const baseline = compileProject(project);
    expect(baseline.ok).toBe(true);
    if (!baseline.ok) return;

    const preset = mergeStageScenePreset(undefined, 'exploration', {
      assetName: 'prop.png',
      createUid: () => 'preset-1',
    });
    expect(preset.objects.length).toBeGreaterThan(0);
    expect(preset.cameraGuides?.ruleOfThirds).toBe(true);

    const withPreset = makeProject({ stageAuthoring: preset });
    const compiled = compileProject(withPreset);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    expect(compiled.game.contentHash).toBe(baseline.game.contentHash);
  });
});
