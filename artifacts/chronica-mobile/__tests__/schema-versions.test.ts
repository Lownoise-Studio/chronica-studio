import {
  CHRONICA_SCHEMA_VERSION_CURRENT,
  CHRONICA_SCHEMA_VERSION_KNOWN_MAX,
  CHRONICA_SCHEMA_VERSION_MIN,
  CHRONICA_SCHEMA_VERSION_MOBILE_PLAYER_FULLY_ENABLED_MAX,
  classifyStorySchemaVersion,
} from '../engine/schema-versions';

describe('story schema version constants', () => {
  test('known bounds match spec expectations', () => {
    expect(CHRONICA_SCHEMA_VERSION_MIN).toBe(1);
    expect(CHRONICA_SCHEMA_VERSION_KNOWN_MAX).toBe(3);
    expect(CHRONICA_SCHEMA_VERSION_MOBILE_PLAYER_FULLY_ENABLED_MAX).toBe(2);
    expect(CHRONICA_SCHEMA_VERSION_CURRENT).toBe(3);
  });

  test('classifyStorySchemaVersion tiers', () => {
    expect(classifyStorySchemaVersion(1)).toBe('fully-enabled');
    expect(classifyStorySchemaVersion(2)).toBe('fully-enabled');
    expect(classifyStorySchemaVersion(3)).toBe('known-limited');
    expect(classifyStorySchemaVersion(99)).toBe('unknown');
    expect(classifyStorySchemaVersion(0)).toBe('unknown');
  });
});
