/**
 * Re-exports shared schema version constants for the compat package layer.
 * See {@link ../../schema-versions.ts} for definitions.
 */
export {
  CHRONICA_SCHEMA_VERSION_CURRENT,
  CHRONICA_SCHEMA_VERSION_KNOWN_MAX,
  CHRONICA_SCHEMA_VERSION_MIN,
  CHRONICA_SCHEMA_VERSION_MOBILE_PLAYER_FULLY_ENABLED_MAX,
  classifyStorySchemaVersion,
  knownLimitedSchemaWarning,
} from '../../schema-versions';
export type { StorySchemaVersionSupport } from '../../schema-versions';
