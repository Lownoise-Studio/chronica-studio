import { PROJECT_SCHEMA_VERSION } from './project-migration';

/** Lowest story `schemaVersion` defined by the Chronica Specification. */
export const CHRONICA_SCHEMA_VERSION_MIN = 1;

/**
 * Highest `schemaVersion` this build recognizes as a known spec revision
 * (including versions not yet fully enabled on every runtime path).
 */
export const CHRONICA_SCHEMA_VERSION_KNOWN_MAX = PROJECT_SCHEMA_VERSION;

/**
 * Highest `schemaVersion` the mobile-player **compat ingest** path fully
 * enables without downgrade. The ZIP importer may accept higher known versions.
 */
export const CHRONICA_SCHEMA_VERSION_MOBILE_PLAYER_FULLY_ENABLED_MAX = 2;

/** Default schemaVersion for newly authored Studio projects. */
export const CHRONICA_SCHEMA_VERSION_CURRENT = PROJECT_SCHEMA_VERSION;

export type StorySchemaVersionSupport =
  | 'fully-enabled'
  | 'known-limited'
  | 'unknown';

/**
 * Classify a story `schemaVersion` for compatibility reporting.
 *
 * - **fully-enabled** — v1–v2 on mobile-player compat ingest today.
 * - **known-limited** — v3 is recognized (dialogue/hotspots/stage-actors schema)
 *   but compat ingest does not yet guarantee full v3 parity.
 * - **unknown** — outside spec bounds; reject explicitly.
 */
export function classifyStorySchemaVersion(schemaVersion: number): StorySchemaVersionSupport {
  if (!Number.isFinite(schemaVersion) || schemaVersion < CHRONICA_SCHEMA_VERSION_MIN) {
    return 'unknown';
  }
  if (schemaVersion > CHRONICA_SCHEMA_VERSION_KNOWN_MAX) {
    return 'unknown';
  }
  if (schemaVersion > CHRONICA_SCHEMA_VERSION_MOBILE_PLAYER_FULLY_ENABLED_MAX) {
    return 'known-limited';
  }
  return 'fully-enabled';
}

/** User-facing warning when a known-but-limited schema is accepted. */
export function knownLimitedSchemaWarning(schemaVersion: number): string {
  return (
    `schemaVersion ${schemaVersion} is recognized but not fully enabled on the ` +
    'mobile-player compat ingest path; v3 dialogue/hotspot/stage-actor features ' +
    'may be partially normalized or behave differently until ingest catches up.'
  );
}
