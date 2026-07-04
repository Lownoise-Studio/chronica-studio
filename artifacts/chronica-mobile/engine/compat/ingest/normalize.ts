import type {
  Character,
  CharacterExpression,
  Choice,
  DialogueLine,
  Fragment,
  ProjectAsset,
  SceneHotspot,
  StageActor,
  StageActorExpression,
} from '../../types';
import type { UnsupportedContentReport } from './types';

/**
 * Defensive normalization from arbitrary parsed package JSON into the
 * strict mobile shapes required by the compiler. Anything the mobile
 * runtime cannot use is dropped and reported through
 * {@link UnsupportedContentReport} — ingestion never throws on unknown
 * fields.
 */

const KNOWN_FRAGMENT_FIELDS = new Set([
  'uid', 'title', 'locationId', 'priority',
  'conditions', 'effects', 'text', 'dialogue',
  'choices', 'hotspots', 'stageActors',
  'backgroundImage', 'backgroundAudio',
]);

const KNOWN_CHOICE_FIELDS = new Set(['uid', 'label', 'action', 'conditions']);
const KNOWN_HOTSPOT_FIELDS = new Set([
  'uid', 'label', 'x', 'y', 'width', 'height', 'action', 'conditions',
]);
const KNOWN_DIALOGUE_FIELDS = new Set(['uid', 'speakerId', 'expressionId', 'text']);
const KNOWN_CHARACTER_FIELDS = new Set([
  'uid', 'characterId', 'displayName', 'defaultPortrait', 'expressions',
]);
const KNOWN_ASSET_FIELDS = new Set([
  'id', 'name', 'type', 'uri', 'mimeType', 'size', 'importedAt',
  'source', 'license', 'previewImageAssetId',
]);
const KNOWN_ACTOR_FIELDS = new Set([
  'uid', 'characterId', 'label', 'asset',
  'x', 'y', 'width', 'scale', 'zIndex',
  'expressions', 'expressionFromVariable', 'visibleWhen',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function reportUnknownFields(
  raw: Record<string, unknown>,
  known: Set<string>,
  path: string,
  reports: UnsupportedContentReport[],
): void {
  for (const key of Object.keys(raw)) {
    if (!known.has(key)) {
      reports.push({ kind: 'field', path: `${path}.${key}`, reason: 'field is not consumed by the mobile runtime' });
    }
  }
}

function normalizeChoice(
  raw: unknown,
  path: string,
  reports: UnsupportedContentReport[],
): Choice | null {
  if (!isRecord(raw)) {
    reports.push({ kind: 'choice', path, reason: 'not an object' });
    return null;
  }
  if (typeof raw.uid !== 'string' || !raw.uid) {
    reports.push({ kind: 'choice', path, reason: 'missing uid' });
    return null;
  }
  reportUnknownFields(raw, KNOWN_CHOICE_FIELDS, path, reports);
  return {
    uid: raw.uid,
    label: typeof raw.label === 'string' ? raw.label : '',
    action: typeof raw.action === 'string' ? raw.action : '',
    conditions: stringArray(raw.conditions),
  };
}

function normalizeHotspot(
  raw: unknown,
  path: string,
  reports: UnsupportedContentReport[],
): SceneHotspot | null {
  if (!isRecord(raw)) {
    reports.push({ kind: 'hotspot', path, reason: 'not an object' });
    return null;
  }
  if (typeof raw.uid !== 'string' || !raw.uid) {
    reports.push({ kind: 'hotspot', path, reason: 'missing uid' });
    return null;
  }
  reportUnknownFields(raw, KNOWN_HOTSPOT_FIELDS, path, reports);
  const clamp01 = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return {
    uid: raw.uid,
    label: typeof raw.label === 'string' ? raw.label : '',
    x: clamp01(raw.x, 0),
    y: clamp01(raw.y, 0),
    width: clamp01(raw.width, 0),
    height: clamp01(raw.height, 0),
    action: typeof raw.action === 'string' ? raw.action : '',
    conditions: stringArray(raw.conditions),
  };
}

function normalizeDialogueLine(raw: unknown, path: string, reports: UnsupportedContentReport[]): DialogueLine | null {
  if (!isRecord(raw)) {
    reports.push({ kind: 'field', path, reason: 'dialogue line is not an object' });
    return null;
  }
  if (typeof raw.uid !== 'string' || !raw.uid) return null;
  reportUnknownFields(raw, KNOWN_DIALOGUE_FIELDS, path, reports);
  return {
    uid: raw.uid,
    text: typeof raw.text === 'string' ? raw.text : '',
    speakerId: typeof raw.speakerId === 'string' ? raw.speakerId : undefined,
    expressionId: typeof raw.expressionId === 'string' ? raw.expressionId : undefined,
  };
}

function normalizeStageActor(raw: unknown, path: string, reports: UnsupportedContentReport[]): StageActor | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.uid !== 'string' || !raw.uid) return null;
  if (typeof raw.asset !== 'string' || !raw.asset) return null;
  reportUnknownFields(raw, KNOWN_ACTOR_FIELDS, path, reports);
  const expressions: StageActorExpression[] = Array.isArray(raw.expressions)
    ? raw.expressions
      .map((e): StageActorExpression | null =>
        isRecord(e) && typeof e.id === 'string' && typeof e.asset === 'string'
          ? { id: e.id, asset: e.asset }
          : null,
      )
      .filter((e): e is StageActorExpression => e !== null)
    : [];
  return {
    uid: raw.uid,
    asset: raw.asset,
    characterId: typeof raw.characterId === 'string' ? raw.characterId : undefined,
    label: typeof raw.label === 'string' ? raw.label : undefined,
    x: typeof raw.x === 'number' ? raw.x : 0.5,
    y: typeof raw.y === 'number' ? raw.y : 0.9,
    width: typeof raw.width === 'number' ? raw.width : undefined,
    scale: typeof raw.scale === 'number' ? raw.scale : undefined,
    zIndex: typeof raw.zIndex === 'number' ? raw.zIndex : undefined,
    expressions,
    expressionFromVariable: typeof raw.expressionFromVariable === 'string' ? raw.expressionFromVariable : undefined,
    visibleWhen: stringArray(raw.visibleWhen),
  };
}

export function normalizeFragment(
  raw: unknown,
  index: number,
  reports: UnsupportedContentReport[],
): Fragment | null {
  const path = `fragments[${index}]`;
  if (!isRecord(raw)) {
    reports.push({ kind: 'fragment', path, reason: 'not an object' });
    return null;
  }
  if (typeof raw.uid !== 'string' || !raw.uid) {
    reports.push({ kind: 'fragment', path, reason: 'missing uid' });
    return null;
  }
  if (typeof raw.locationId !== 'string' || !raw.locationId) {
    reports.push({ kind: 'fragment', path, reason: 'missing locationId' });
    return null;
  }

  reportUnknownFields(raw, KNOWN_FRAGMENT_FIELDS, path, reports);

  const choices: Choice[] = Array.isArray(raw.choices)
    ? raw.choices
      .map((c, i) => normalizeChoice(c, `${path}.choices[${i}]`, reports))
      .filter((c): c is Choice => c !== null)
    : [];

  const hotspots: SceneHotspot[] = Array.isArray(raw.hotspots)
    ? raw.hotspots
      .map((h, i) => normalizeHotspot(h, `${path}.hotspots[${i}]`, reports))
      .filter((h): h is SceneHotspot => h !== null)
    : [];

  const dialogue: DialogueLine[] = Array.isArray(raw.dialogue)
    ? raw.dialogue
      .map((d, i) => normalizeDialogueLine(d, `${path}.dialogue[${i}]`, reports))
      .filter((d): d is DialogueLine => d !== null)
    : [];

  const stageActors: StageActor[] = Array.isArray(raw.stageActors)
    ? raw.stageActors
      .map((a, i) => normalizeStageActor(a, `${path}.stageActors[${i}]`, reports))
      .filter((a): a is StageActor => a !== null)
    : [];

  return {
    uid: raw.uid,
    title: typeof raw.title === 'string' ? raw.title : '',
    locationId: raw.locationId,
    priority: typeof raw.priority === 'number' ? raw.priority : 0,
    conditions: stringArray(raw.conditions),
    effects: stringArray(raw.effects),
    text: typeof raw.text === 'string' ? raw.text : '',
    dialogue: dialogue.length ? dialogue : undefined,
    choices,
    hotspots: hotspots.length ? hotspots : undefined,
    stageActors: stageActors.length ? stageActors : undefined,
    backgroundImage: typeof raw.backgroundImage === 'string' ? raw.backgroundImage : undefined,
    backgroundAudio: typeof raw.backgroundAudio === 'string' ? raw.backgroundAudio : undefined,
  };
}

export function normalizeCharacter(
  raw: unknown,
  index: number,
  reports: UnsupportedContentReport[],
): Character | null {
  const path = `characters[${index}]`;
  if (!isRecord(raw)) {
    reports.push({ kind: 'character', path, reason: 'not an object' });
    return null;
  }
  if (typeof raw.uid !== 'string' || !raw.uid) {
    reports.push({ kind: 'character', path, reason: 'missing uid' });
    return null;
  }
  if (typeof raw.characterId !== 'string' || !raw.characterId) {
    reports.push({ kind: 'character', path, reason: 'missing characterId' });
    return null;
  }
  reportUnknownFields(raw, KNOWN_CHARACTER_FIELDS, path, reports);
  const expressions: CharacterExpression[] = Array.isArray(raw.expressions)
    ? raw.expressions
      .map((e): CharacterExpression | null =>
        isRecord(e) && typeof e.id === 'string' && typeof e.portrait === 'string'
          ? {
              id: e.id,
              portrait: e.portrait,
              label: typeof e.label === 'string' ? e.label : undefined,
            }
          : null,
      )
      .filter((e): e is CharacterExpression => e !== null)
    : [];
  return {
    uid: raw.uid,
    characterId: raw.characterId,
    displayName: typeof raw.displayName === 'string' ? raw.displayName : raw.characterId,
    defaultPortrait: typeof raw.defaultPortrait === 'string' ? raw.defaultPortrait : undefined,
    expressions,
  };
}

export function normalizeAsset(
  raw: unknown,
  index: number,
  reports: UnsupportedContentReport[],
): ProjectAsset | null {
  const path = `assets[${index}]`;
  if (!isRecord(raw)) {
    reports.push({ kind: 'asset', path, reason: 'not an object' });
    return null;
  }
  if (typeof raw.name !== 'string' || !raw.name) {
    reports.push({ kind: 'asset', path, reason: 'missing name' });
    return null;
  }
  const type = raw.type;
  if (type !== 'image' && type !== 'audio' && type !== 'data' && type !== 'model') {
    reports.push({ kind: 'asset', path, reason: `unsupported asset type: ${String(type)}` });
    return null;
  }
  reportUnknownFields(raw, KNOWN_ASSET_FIELDS, path, reports);
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : raw.name,
    name: raw.name,
    type,
    uri: typeof raw.uri === 'string' ? raw.uri : '',
    mimeType: typeof raw.mimeType === 'string' ? raw.mimeType : '',
    size: typeof raw.size === 'number' ? raw.size : 0,
    importedAt: typeof raw.importedAt === 'string' ? raw.importedAt : new Date().toISOString(),
    source: typeof raw.source === 'string' ? raw.source : undefined,
    license: typeof raw.license === 'string' ? raw.license : undefined,
    previewImageAssetId: typeof raw.previewImageAssetId === 'string' ? raw.previewImageAssetId : undefined,
  };
}
