import { isBundledDemoProject, SAMPLE_GAME_ID } from '../demo/bundled-demos';
import { SHOWCASE_GAME_ID } from '../demo/showcase-project';

describe('isBundledDemoProject', () => {
  it('matches seeded sample and showcase game IDs', () => {
    expect(isBundledDemoProject({ gameId: SAMPLE_GAME_ID })).toBe(true);
    expect(isBundledDemoProject({ gameId: SHOWCASE_GAME_ID })).toBe(true);
  });

  it('ignores user-created projects', () => {
    expect(isBundledDemoProject({ gameId: 'a0000001-0000-4000-8000-000000000099' })).toBe(false);
  });
});
