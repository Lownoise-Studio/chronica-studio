import { compileProject } from '../engine/compiler';
import { computeProjectContentHash } from '../engine/compiler/build-compiled-game';
import {
  buildPresentationStyle,
  getObjectForHotspot,
  getRenderableStageObjects,
  isStageObjectVisible,
  presentationOverlayPointerEvents,
  resolveObjectHotspotLinks,
  resolveStageObjectHotspotRef,
  shouldShowPlaytestPresentationOverlay,
} from '../engine/stage-presentation';
import { sortStageObjectsByLayer } from '../engine/stage-authoring';
import type { ChronicaState, Fragment, Project, StageObject } from '../engine/types';

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

const previewState: ChronicaState = {
  location: 'room',
  instability: 0,
  reality_layer: 0,
  memory: {},
  variables: { has_key: true },
  dialogueLineIndex: 0,
};

describe('stage presentation preview', () => {
  test('render order follows stage layers', () => {
    const composition = {
      objects: [
        sampleObject({ uid: 'fg', layer: 'foreground', zIndex: 0 }),
        sampleObject({ uid: 'bg', layer: 'background', zIndex: 5 }),
        sampleObject({ uid: 'mid', layer: 'props', zIndex: 2 }),
      ],
    };
    const ordered = getRenderableStageObjects(composition).map(r => r.object.uid);
    const expected = sortStageObjectsByLayer(composition.objects).map(o => o.uid);
    expect(ordered).toEqual(expected);
    expect(ordered).toEqual(['bg', 'mid', 'fg']);
  });

  test('hidden objects are not rendered in playtest preview', () => {
    const composition = {
      objects: [
        sampleObject({ uid: 'visible' }),
        sampleObject({ uid: 'hidden', hidden: true }),
      ],
    };
    const editor = getRenderableStageObjects(composition, { includeEditorHidden: true });
    const playtest = getRenderableStageObjects(composition);
    expect(editor.map(r => r.object.uid).sort()).toEqual(['hidden', 'visible']);
    expect(playtest.map(r => r.object.uid)).toEqual(['visible']);
  });

  test('visibility conditions are respected with preview state', () => {
    const visible = sampleObject({ uid: 'a', visibleWhen: ['variables.has_key == true'] });
    const hidden = sampleObject({ uid: 'b', visibleWhen: ['variables.has_key == false'] });
    expect(isStageObjectVisible(visible, previewState)).toBe(true);
    expect(isStageObjectVisible(hidden, previewState)).toBe(false);
    const renderable = getRenderableStageObjects(
      { objects: [visible, hidden] },
      { previewState },
    );
    expect(renderable.map(r => r.object.uid)).toEqual(['a']);
  });

  test('linked hotspot/object references resolve', () => {
    const object = sampleObject({ hotspotRef: 'hs1' });
    const links = resolveObjectHotspotLinks({ objects: [object] }, [{
      uid: 'hs1',
      label: 'Lantern',
      x: 0.1,
      y: 0.1,
      width: 0.1,
      height: 0.1,
      action: 'noop',
      conditions: [],
    }]);
    expect(links).toEqual([{ objectUid: 'obj1', hotspotUid: 'hs1' }]);
    expect(resolveStageObjectHotspotRef(object)).toBe('hs1');
    expect(getObjectForHotspot({ objects: [object] }, 'hs1')?.uid).toBe('obj1');
    expect(getObjectForHotspot({ objects: [sampleObject({ interactionRef: 'hs1' })] }, 'hs1')?.uid).toBe('obj1');
  });

  test('playtest overlay does not intercept pointer events', () => {
    expect(presentationOverlayPointerEvents()).toBe('none');
  });

  test('playtest overlay respects composition toggle', () => {
    const composition = { objects: [sampleObject()], showPresentationOverlay: false };
    expect(shouldShowPlaytestPresentationOverlay(composition, true)).toBe(false);
    expect(shouldShowPlaytestPresentationOverlay({ objects: [sampleObject()] }, true)).toBe(true);
    expect(shouldShowPlaytestPresentationOverlay({ objects: [sampleObject()] }, false)).toBe(false);
  });

  test('presentation transitions are editor metadata only', () => {
    expect(buildPresentationStyle({ enter: 'fade-in' }).opacity).toBeLessThan(1);
    expect(buildPresentationStyle({ enter: 'zoom' }).scale).toBeGreaterThan(1);
    expect(buildPresentationStyle(undefined)).toEqual({
      opacity: 1,
      translateX: 0,
      translateY: 0,
      scale: 1,
    });
  });

  test('compiler output remains unchanged when presentation metadata is added', () => {
    const project = makeProject();
    const baseline = compileProject(project);
    expect(baseline.ok).toBe(true);
    if (!baseline.ok) return;

    const withPresentation = makeProject({
      stageAuthoring: {
        objects: [
          sampleObject({
            hotspotRef: 'hs1',
            presentation: { enter: 'slide', exit: 'fade-out' },
          }),
        ],
        showPresentationOverlay: true,
        lightingPreset: 'night',
      },
    });

    const compiled = compileProject(withPresentation);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    expect(compiled.game.contentHash).toBe(baseline.game.contentHash);
    expect(computeProjectContentHash(withPresentation)).toBe(computeProjectContentHash(project));
  });
});
