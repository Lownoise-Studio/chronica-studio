import { compileProject } from '../engine/compiler';
import { buildCompiledGame, computeProjectContentHash, fragmentForRuntimeCompile } from '../engine/compiler/build-compiled-game';
import { createId } from '../engine/identity';
import {
  alignStageObjects,
  buildSceneInspectorSections,
  duplicateStageObject,
  normalizeStageComposition,
  selectStageGroup,
  serializeStageComposition,
  sortStageObjectsByLayer,
  validateStageObject,
} from '../engine/stage-authoring';
import type { Fragment, Project, StageComposition, StageObject } from '../engine/types';

function makeProject(fragment: Partial<Fragment> = {}): Project {
  const base: Fragment = {
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
    stageActors: [{
      uid: 'actor1',
      asset: 'prop.png',
      x: 0.5,
      y: 0.8,
      label: 'Keeper',
    }],
    ...fragment,
  };
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
    assets: [{ id: 'a1', name: 'prop.png', type: 'image', uri: 'file://prop.png', mimeType: 'image/png', size: 1, importedAt: '' }],
    characters: [],
    fragments: [base],
  };
}

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

describe('stage authoring', () => {
  test('scene object serialization round-trips', () => {
    const composition: StageComposition = {
      objects: [sampleObject()],
      lightingPreset: 'sunset',
      cameraGuides: { centerGuides: true, ruleOfThirds: true },
    };
    const restored = normalizeStageComposition(JSON.parse(serializeStageComposition(composition)));
    expect(restored.lightingPreset).toBe('sunset');
    expect(restored.objects[0].label).toBe('Crate');
    expect(restored.cameraGuides?.ruleOfThirds).toBe(true);
  });

  test('layer ordering sorts background before foreground', () => {
    const ordered = sortStageObjectsByLayer([
      sampleObject({ uid: 'a', layer: 'foreground', zIndex: 0 }),
      sampleObject({ uid: 'b', layer: 'background', zIndex: 5 }),
      sampleObject({ uid: 'c', layer: 'props', zIndex: 2 }),
    ]);
    expect(ordered.map(o => o.uid)).toEqual(['b', 'c', 'a']);
  });

  test('visibility conditions validate against expression grammar', () => {
    const valid = validateStageObject(sampleObject({ visibleWhen: ['variables.has_key == true'] }));
    const invalid = validateStageObject(sampleObject({ visibleWhen: ['bad condition syntax'] }));
    expect(valid).toEqual([]);
    expect(invalid.length).toBeGreaterThan(0);
  });

  test('selection helpers support group ids', () => {
    const objects = [
      sampleObject({ uid: 'a', groupId: 'g1' }),
      sampleObject({ uid: 'b', groupId: 'g1' }),
      sampleObject({ uid: 'c' }),
    ];
    expect(selectStageGroup(objects, 'g1')).toEqual(['a', 'b']);
  });

  test('align and duplicate keep objects editable', () => {
    const objects = [
      sampleObject({ uid: 'a', x: 0.2, y: 0.2 }),
      sampleObject({ uid: 'b', x: 0.8, y: 0.8 }),
    ];
    const aligned = alignStageObjects(objects, ['a', 'b'], 'center-x');
    expect(aligned.find(o => o.uid === 'a')?.x).toBeCloseTo(0.5, 1);
    const copy = duplicateStageObject(objects[0], createId());
    expect(copy.label).toContain('copy');
    expect(copy.uid).not.toBe('a');
  });

  test('scene inspector lists objects hotspots actors and catalog refs', () => {
    const project = makeProject({
      stageAuthoring: {
        objects: [sampleObject()],
        lightingPreset: 'day',
      },
    });
    const fragment = project.fragments[0];
    const sections = buildSceneInspectorSections(fragment, {
      inventory: [{ id: 'lantern', label: 'Lantern', assetName: 'lantern.png', stateKey: 'variables.has_lantern', stateKind: 'variable' }],
      objectives: [],
      worldState: [],
    });
    expect(sections.find(s => s.title === 'Objects')?.items[0]).toContain('Crate');
    expect(sections.find(s => s.title === 'Hotspots')?.items[0]).toContain('Lantern');
    expect(sections.find(s => s.title === 'Actors')?.items[0]).toContain('Keeper');
  });

  test('compiler output unchanged when stage authoring is added', () => {
    const project = makeProject();
    const baseline = compileProject(project);
    expect(baseline.ok).toBe(true);
    if (!baseline.ok) return;

    const withStage = makeProject({
      stageAuthoring: {
        objects: [sampleObject(), sampleObject({ uid: 'obj2', layer: 'foreground', x: 0.7 })],
        lightingPreset: 'night',
        cameraGuides: { safeArea: true, ruleOfThirds: true },
      },
    });

    const compiled = compileProject(withStage);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    expect(compiled.game.contentHash).toBe(baseline.game.contentHash);
    expect(compiled.game.hotspotActions).toEqual(baseline.game.hotspotActions);
    expect(compiled.game.choiceActions).toEqual(baseline.game.choiceActions);
    expect(compiled.game.fragments[0]).not.toHaveProperty('stageAuthoring');

    const built = buildCompiledGame(withStage);
    expect(built.fragments[0]).not.toHaveProperty('stageAuthoring');
    expect(fragmentForRuntimeCompile(withStage.fragments[0])).not.toHaveProperty('stageAuthoring');
    expect(computeProjectContentHash(withStage)).toBe(computeProjectContentHash(project));
  });
});
