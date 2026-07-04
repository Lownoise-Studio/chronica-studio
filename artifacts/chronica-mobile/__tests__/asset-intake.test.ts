import {
  buildAssetImportReport,
  classifyProjectAsset,
  needsClassificationAttention,
  summarizeImportReport,
} from '../engine/asset-intake';
import type { ProjectAsset } from '../engine/types';

function sampleAsset(
  name: string,
  type: ProjectAsset['type'] = 'image',
  mimeType?: string,
): ProjectAsset {
  const ext = name.split('.').pop()?.toLowerCase() ?? 'png';
  const defaultMime = type === 'audio'
    ? 'audio/mpeg'
    : type === 'model'
      ? 'model/gltf-binary'
      : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  return {
    id: `asset-${name}`,
    name,
    type,
    uri: `file:///device/${name}`,
    mimeType: mimeType ?? defaultMime,
    size: 1024,
    importedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('asset intake classification', () => {
  test('door_wood.glb is a high-confidence door with make_door recipe', () => {
    const result = classifyProjectAsset(sampleAsset('door_wood.glb', 'model'));
    expect(result.category).toBe('door');
    expect(result.confidence).toBe('high');
    expect(result.suggestedRecipe).toBe('make_door');
  });

  test('gate_locked.glb is a high-confidence gate with make_door recipe', () => {
    const result = classifyProjectAsset(sampleAsset('gate_locked.glb', 'model'));
    expect(result.category).toBe('gate');
    expect(result.confidence).toBe('high');
    expect(result.suggestedRecipe).toBe('make_door');
  });

  test('lantern_pickup.png is classified as pickup', () => {
    const result = classifyProjectAsset(sampleAsset('lantern_pickup.png'));
    expect(result.category).toBe('pickup');
    expect(result.confidence).toBe('high');
    expect(result.suggestedRecipe).toBe('make_pickup');
  });

  test('npc_lamplighter.png is a high-confidence NPC', () => {
    const result = classifyProjectAsset(sampleAsset('npc_lamplighter.png'));
    expect(result.category).toBe('npc');
    expect(result.confidence).toBe('high');
    expect(result.suggestedRecipe).toBe('make_npc');
  });

  test('player_idle.png is a high-confidence player asset', () => {
    const result = classifyProjectAsset(sampleAsset('player_idle.png'));
    expect(result.category).toBe('player');
    expect(result.confidence).toBe('high');
    expect(result.suggestedRecipe).toBe('make_npc');
  });

  test('forest_ambient.mp3 is ambient audio', () => {
    const result = classifyProjectAsset(sampleAsset('forest_ambient.mp3', 'audio', 'audio/mpeg'));
    expect(result.category).toBe('ambient');
    expect(result.confidence).toBe('high');
    expect(result.suggestedRecipe).toBe('make_ambient');
  });

  test('footstep_gravel.wav is an sfx asset', () => {
    const result = classifyProjectAsset(sampleAsset('footstep_gravel.wav', 'audio', 'audio/wav'));
    expect(result.category).toBe('sfx');
    expect(result.confidence).toBe('high');
    expect(result.suggestedRecipe).toBe('make_sfx');
  });

  test('title_logo.png is a UI graphic', () => {
    const result = classifyProjectAsset(sampleAsset('title_logo.png'));
    expect(result.category).toBe('ui');
    expect(result.confidence).toBe('high');
    expect(result.suggestedRecipe).toBe('make_ui');
  });

  test('ambiguous filenames fall back to unknown with low confidence', () => {
    const result = classifyProjectAsset(sampleAsset('IMG_4829.png'));
    expect(result.category).toBe('unknown');
    expect(result.confidence).toBe('low');
    expect(result.suggestedRecipe).toBe('none');
    expect(needsClassificationAttention(result)).toBe(true);
  });

  test('path-like names use folder segments for background detection', () => {
    const result = classifyProjectAsset(sampleAsset('backgrounds/forest.jpg', 'image', 'image/jpeg'));
    expect(result.category).toBe('background');
    expect(result.confidence).toBe('high');
    expect(result.suggestedRecipe).toBe('make_background');
  });

  test('generic glb without role keywords is a medium-confidence model', () => {
    const result = classifyProjectAsset(sampleAsset('mesh_export.glb', 'model'));
    expect(result.category).toBe('model');
    expect(result.confidence).toBe('medium');
    expect(result.suggestedRecipe).toBe('none');
  });

  test('conflicting role keywords produce a medium-confidence warning', () => {
    const result = classifyProjectAsset(sampleAsset('door_gate_prop.glb', 'model'));
    expect(['door', 'gate', 'prop']).toContain(result.category);
    expect(result.confidence).toBe('medium');
    expect(result.hint).toContain('Multiple role keywords');
  });
});

describe('asset import report', () => {
  test('groups detected, unknown, warnings, and suggested actions', () => {
    const assets = [
      sampleAsset('door_wood.glb', 'model'),
      sampleAsset('forest_ambient.mp3', 'audio', 'audio/mpeg'),
      sampleAsset('IMG_0001.png'),
    ];
    const report = buildAssetImportReport(assets);

    expect(report.detected).toHaveLength(2);
    expect(report.unknown).toHaveLength(1);
    expect(report.unknown[0]?.asset.name).toBe('IMG_0001.png');
    expect(report.suggestedNextActions.some(action => action.recipe === 'make_door')).toBe(true);
    expect(report.suggestedNextActions.some(action => action.recipe === 'make_ambient')).toBe(true);
    expect(report.suggestedNextActions.some(action => action.message.includes('need manual review'))).toBe(true);
    expect(summarizeImportReport(report)).toContain('classified');
    expect(summarizeImportReport(report)).toContain('need review');
  });

  test('import report is non-destructive and does not mutate assets', () => {
    const assets = [sampleAsset('npc_lamplighter.png')];
    const before = JSON.stringify(assets);
    buildAssetImportReport(assets);
    expect(JSON.stringify(assets)).toBe(before);
  });
});
