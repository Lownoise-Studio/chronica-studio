import { isModelAsset, isModelFilename, isModelMimeType } from './model-assets';
import type { ProjectAsset } from './types';

export type AssetIntakeCategory =
  | 'model'
  | 'character'
  | 'npc'
  | 'player'
  | 'pickup'
  | 'door'
  | 'gate'
  | 'key'
  | 'lantern'
  | 'prop'
  | 'background'
  | 'ambient'
  | 'music'
  | 'sfx'
  | 'ui'
  | 'unknown';

export type AssetIntakeConfidence = 'high' | 'medium' | 'low';

export type AssetIntakeRecipe =
  | 'make_pickup'
  | 'make_door'
  | 'make_npc'
  | 'make_background'
  | 'make_ambient'
  | 'make_music'
  | 'make_sfx'
  | 'make_ui'
  | 'none';

export interface AssetIntakeClassification {
  category: AssetIntakeCategory;
  confidence: AssetIntakeConfidence;
  suggestedRecipe: AssetIntakeRecipe;
  /** Short label for tiles and detail views. */
  label: string;
  /** Optional hint explaining the suggestion. */
  hint?: string;
}

export interface AssetImportReportEntry {
  asset: ProjectAsset;
  classification: AssetIntakeClassification;
}

export interface AssetImportReportWarning {
  assetName: string;
  message: string;
}

export interface AssetImportSuggestedAction {
  message: string;
  recipe: AssetIntakeRecipe;
  assetNames: string[];
}

export interface AssetImportReport {
  detected: AssetImportReportEntry[];
  unknown: AssetImportReportEntry[];
  warnings: AssetImportReportWarning[];
  suggestedNextActions: AssetImportSuggestedAction[];
}

interface ParsedAssetName {
  folderSegments: string[];
  stem: string;
  tokens: string[];
  extension: string;
}

interface CategoryRule {
  category: AssetIntakeCategory;
  /** Exact token matches in filename stem. */
  tokens?: readonly string[];
  /** Substrings anywhere in the full path (folders + filename). */
  pathIncludes?: readonly string[];
  /** Folder segment exact matches. */
  folderSegments?: readonly string[];
  confidence: AssetIntakeConfidence;
}

const CATEGORY_LABELS: Record<AssetIntakeCategory, string> = {
  model: '3D model',
  character: 'Character art',
  npc: 'NPC',
  player: 'Player',
  pickup: 'Pickup item',
  door: 'Door',
  gate: 'Gate',
  key: 'Key item',
  lantern: 'Lantern',
  prop: 'Prop',
  background: 'Background',
  ambient: 'Ambient audio',
  music: 'Music',
  sfx: 'Sound effect',
  ui: 'UI graphic',
  unknown: 'Unknown',
};

const RECIPE_BY_CATEGORY: Partial<Record<AssetIntakeCategory, AssetIntakeRecipe>> = {
  pickup: 'make_pickup',
  key: 'make_pickup',
  lantern: 'make_pickup',
  door: 'make_door',
  gate: 'make_door',
  npc: 'make_npc',
  character: 'make_npc',
  player: 'make_npc',
  background: 'make_background',
  ambient: 'make_ambient',
  music: 'make_music',
  sfx: 'make_sfx',
  ui: 'make_ui',
};

const RECIPE_ACTION_LABELS: Record<Exclude<AssetIntakeRecipe, 'none'>, string> = {
  make_pickup: 'Add as inventory pickup in Gameplay catalog',
  make_door: 'Use as a door or gate hotspot',
  make_npc: 'Assign to an NPC or stage actor',
  make_background: 'Set as a scene background image',
  make_ambient: 'Assign as scene ambient audio',
  make_music: 'Assign as scene music track',
  make_sfx: 'Wire as a sound effect in hotspots or actions',
  make_ui: 'Use in menus or title screens',
};

/** Higher priority rules are evaluated first for high-confidence matches. */
const CATEGORY_RULES: readonly CategoryRule[] = [
  { category: 'door', tokens: ['door', 'doorway'], pathIncludes: ['/doors/', '/door/'], folderSegments: ['doors', 'door'], confidence: 'high' },
  { category: 'gate', tokens: ['gate'], pathIncludes: ['/gates/', '/gate/'], folderSegments: ['gates', 'gate'], confidence: 'high' },
  { category: 'lantern', tokens: ['lantern', 'lamp', 'torch'], confidence: 'high' },
  { category: 'key', tokens: ['key', 'keys'], confidence: 'high' },
  { category: 'pickup', tokens: ['pickup', 'collectible', 'collect', 'item'], confidence: 'high' },
  { category: 'npc', tokens: ['npc'], pathIncludes: ['/npcs/', '/npc/'], folderSegments: ['npcs', 'npc'], confidence: 'high' },
  { category: 'player', tokens: ['player', 'protagonist', 'playable'], pathIncludes: ['/player/', '/players/'], folderSegments: ['player', 'players'], confidence: 'high' },
  { category: 'character', tokens: ['character', 'portrait', 'avatar'], pathIncludes: ['/characters/', '/character/'], folderSegments: ['characters', 'character'], confidence: 'high' },
  { category: 'background', tokens: ['background', 'backdrop', 'bg', 'scene'], pathIncludes: ['/backgrounds/', '/background/', '/bg/'], folderSegments: ['backgrounds', 'background', 'bg'], confidence: 'high' },
  { category: 'ambient', tokens: ['ambient', 'ambience', 'atmos', 'atmosphere'], pathIncludes: ['/ambient/', '/ambience/'], folderSegments: ['ambient', 'ambience'], confidence: 'high' },
  { category: 'music', tokens: ['music', 'theme', 'soundtrack', 'score', 'bgm'], pathIncludes: ['/music/', '/soundtrack/'], folderSegments: ['music', 'soundtrack'], confidence: 'high' },
  { category: 'sfx', tokens: ['sfx', 'soundfx', 'foley', 'footstep', 'footsteps', 'effect'], pathIncludes: ['/sfx/', '/soundfx/', '/sounds/'], folderSegments: ['sfx', 'soundfx', 'sounds'], confidence: 'high' },
  { category: 'ui', tokens: ['ui', 'hud', 'icon', 'logo', 'title', 'button', 'menu'], pathIncludes: ['/ui/', '/icons/', '/hud/'], folderSegments: ['ui', 'icons', 'hud'], confidence: 'high' },
  { category: 'prop', tokens: ['prop', 'props', 'furniture', 'decoration', 'object'], pathIncludes: ['/props/', '/prop/'], folderSegments: ['props', 'prop'], confidence: 'medium' },
  { category: 'character', tokens: ['sprite', 'idle', 'walk'], confidence: 'medium' },
  { category: 'music', tokens: ['song', 'track'], confidence: 'medium' },
];

const CONFIDENCE_RANK: Record<AssetIntakeConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function parseAssetName(name: string): ParsedAssetName {
  const normalized = name.replace(/\\/g, '/').trim();
  const segments = normalized.split('/').filter(Boolean);
  const basename = segments[segments.length - 1] ?? normalized;
  const folderSegments = segments.slice(0, -1).map(segment => segment.toLowerCase());
  const dot = basename.lastIndexOf('.');
  const stem = (dot > 0 ? basename.slice(0, dot) : basename).toLowerCase();
  const extension = dot > 0 ? basename.slice(dot + 1).toLowerCase() : '';
  const tokens = stem.split(/[_\-.]+/).filter(Boolean);
  return { folderSegments, stem, tokens, extension };
}

function pathLower(name: string): string {
  return name.replace(/\\/g, '/').toLowerCase();
}

function ruleMatches(rule: CategoryRule, parsed: ParsedAssetName, fullPath: string): boolean {
  if (rule.tokens?.some(token => parsed.tokens.includes(token))) return true;
  if (rule.folderSegments?.some(segment => parsed.folderSegments.includes(segment))) return true;
  if (rule.pathIncludes?.some(fragment => fullPath.includes(fragment))) return true;
  return false;
}

function suggestedRecipeForCategory(category: AssetIntakeCategory): AssetIntakeRecipe {
  return RECIPE_BY_CATEGORY[category] ?? 'none';
}

function hintForClassification(
  category: AssetIntakeCategory,
  recipe: AssetIntakeRecipe,
  confidence: AssetIntakeConfidence,
): string | undefined {
  if (category === 'unknown') {
    return 'Filename and type did not match a known Chronica asset role.';
  }
  if (confidence === 'low') {
    return 'Weak match — review before wiring into gameplay or scenes.';
  }
  if (recipe !== 'none') {
    return RECIPE_ACTION_LABELS[recipe];
  }
  if (category === 'model' || category === 'prop') {
    return 'Place in stage authoring or link a preview thumbnail.';
  }
  return undefined;
}

function typeFallbackCategory(
  asset: Pick<ProjectAsset, 'type' | 'name' | 'mimeType'>,
): AssetIntakeClassification | null {
  const isModel = isModelAsset(asset) || isModelFilename(asset.name) || isModelMimeType(asset.mimeType);
  if (isModel) {
    return {
      category: 'model',
      confidence: 'medium',
      suggestedRecipe: 'none',
      label: CATEGORY_LABELS.model,
      hint: 'Portable 3D model — add a preview thumbnail for stage authoring.',
    };
  }

  const mime = asset.mimeType?.toLowerCase() ?? '';
  if (asset.type === 'audio' || mime.startsWith('audio/')) {
    return {
      category: 'music',
      confidence: 'low',
      suggestedRecipe: 'make_music',
      label: CATEGORY_LABELS.music,
      hint: 'Audio file with no role keyword — review before assigning.',
    };
  }

  if (asset.type === 'image' || mime.startsWith('image/')) {
    return {
      category: 'unknown',
      confidence: 'low',
      suggestedRecipe: 'none',
      label: CATEGORY_LABELS.unknown,
      hint: hintForClassification('unknown', 'none', 'low'),
    };
  }

  return null;
}

function collectMatchingRules(parsed: ParsedAssetName, fullPath: string): CategoryRule[] {
  return CATEGORY_RULES.filter(rule => ruleMatches(rule, parsed, fullPath));
}

/** Classify a single asset from filename, MIME type, extension, and path-like name. */
export function classifyProjectAsset(
  asset: Pick<ProjectAsset, 'name' | 'type' | 'mimeType'>,
): AssetIntakeClassification {
  const parsed = parseAssetName(asset.name);
  const fullPath = pathLower(asset.name);
  const matches = collectMatchingRules(parsed, fullPath);

  if (matches.length === 0) {
    const fallback = typeFallbackCategory(asset);
    if (fallback) return fallback;
    return {
      category: 'unknown',
      confidence: 'low',
      suggestedRecipe: 'none',
      label: CATEGORY_LABELS.unknown,
      hint: hintForClassification('unknown', 'none', 'low'),
    };
  }

  const categories = new Set(matches.map(match => match.category));
  if (categories.size > 1) {
    const highMatches = matches.filter(match => match.confidence === 'high');
    const highCategories = new Set(highMatches.map(match => match.category));

    if (highCategories.has('pickup') && highCategories.has('lantern')) {
      const recipe = suggestedRecipeForCategory('pickup');
      return {
        category: 'pickup',
        confidence: 'high',
        suggestedRecipe: recipe,
        label: CATEGORY_LABELS.pickup,
        hint: hintForClassification('pickup', recipe, 'high'),
      };
    }

    if (highMatches.length === 1) {
      const best = highMatches[0]!;
      const recipe = suggestedRecipeForCategory(best.category);
      return {
        category: best.category,
        confidence: 'high',
        suggestedRecipe: recipe,
        label: CATEGORY_LABELS[best.category],
        hint: hintForClassification(best.category, recipe, 'high'),
      };
    }

    const best = [...matches].sort(
      (a, b) => CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence],
    )[0]!;
    const recipe = suggestedRecipeForCategory(best.category);
    return {
      category: best.category,
      confidence: 'medium',
      suggestedRecipe: recipe,
      label: CATEGORY_LABELS[best.category],
      hint: 'Multiple role keywords detected — review before wiring.',
    };
  }

  const best = [...matches].sort(
    (a, b) => CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence],
  )[0]!;
  const recipe = suggestedRecipeForCategory(best.category);

  if (isModelAsset(asset) && best.category !== 'model' && !['door', 'gate', 'prop', 'lantern', 'key', 'pickup'].includes(best.category)) {
    return {
      category: best.category,
      confidence: best.confidence,
      suggestedRecipe: recipe,
      label: CATEGORY_LABELS[best.category],
      hint: hintForClassification(best.category, recipe, best.confidence),
    };
  }

  return {
    category: best.category,
    confidence: best.confidence,
    suggestedRecipe: recipe,
    label: CATEGORY_LABELS[best.category],
    hint: hintForClassification(best.category, recipe, best.confidence),
  };
}

export function formatSuggestedRecipe(recipe: AssetIntakeRecipe): string {
  if (recipe === 'none') return 'No suggested recipe';
  return RECIPE_ACTION_LABELS[recipe];
}

export function needsClassificationAttention(classification: AssetIntakeClassification): boolean {
  return classification.category === 'unknown' || classification.confidence === 'low';
}

export function buildAssetImportReport(assets: readonly ProjectAsset[]): AssetImportReport {
  const entries = assets.map(asset => ({
    asset,
    classification: classifyProjectAsset(asset),
  }));

  const detected = entries.filter(entry => entry.classification.category !== 'unknown');
  const unknown = entries.filter(entry => entry.classification.category === 'unknown');

  const warnings: AssetImportReportWarning[] = [];
  for (const entry of entries) {
    const { asset, classification } = entry;
    if (classification.hint?.includes('Multiple role keywords')) {
      warnings.push({
        assetName: asset.name,
        message: `Ambiguous role keywords in "${asset.name}" — classified as ${classification.label}.`,
      });
    }
    if (classification.confidence === 'low' && classification.category !== 'unknown') {
      warnings.push({
        assetName: asset.name,
        message: `Low-confidence classification for "${asset.name}" (${classification.label}).`,
      });
    }
  }

  const recipeGroups = new Map<AssetIntakeRecipe, string[]>();
  for (const entry of entries) {
    const recipe = entry.classification.suggestedRecipe;
    if (recipe === 'none') continue;
    const names = recipeGroups.get(recipe) ?? [];
    names.push(entry.asset.name);
    recipeGroups.set(recipe, names);
  }

  const suggestedNextActions: AssetImportSuggestedAction[] = [...recipeGroups.entries()]
    .map(([recipe, assetNames]) => ({
      recipe,
      assetNames,
      message: `${assetNames.length} asset${assetNames.length === 1 ? '' : 's'} → ${formatSuggestedRecipe(recipe)}`,
    }))
    .sort((a, b) => b.assetNames.length - a.assetNames.length);

  if (unknown.length > 0) {
    suggestedNextActions.push({
      recipe: 'none',
      assetNames: unknown.map(entry => entry.asset.name),
      message: `${unknown.length} asset${unknown.length === 1 ? '' : 's'} need manual review (unknown role).`,
    });
  }

  return { detected, unknown, warnings, suggestedNextActions };
}

export function summarizeImportReport(report: AssetImportReport): string {
  const parts: string[] = [];
  if (report.detected.length > 0) {
    parts.push(`${report.detected.length} classified`);
  }
  if (report.unknown.length > 0) {
    parts.push(`${report.unknown.length} need review`);
  }
  if (report.warnings.length > 0) {
    parts.push(`${report.warnings.length} warning${report.warnings.length === 1 ? '' : 's'}`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'No assets to classify';
}
