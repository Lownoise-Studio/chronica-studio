import { isBundledDemoProject, SAMPLE_GAME_ID } from '../demo/bundled-demos';
import { SHOWCASE_GAME_ID } from '../demo/showcase-project';
import { PASTURE_GAME_ID } from '../demo/pasture-project';

describe('isBundledDemoProject', () => {
  it('matches seeded sample and bundled demo game IDs', () => {
    expect(isBundledDemoProject({ gameId: SAMPLE_GAME_ID })).toBe(true);
    expect(isBundledDemoProject({ gameId: SHOWCASE_GAME_ID })).toBe(true);
    expect(isBundledDemoProject({ gameId: PASTURE_GAME_ID })).toBe(true);
  });

  it('ignores user-created projects', () => {
    expect(isBundledDemoProject({ gameId: 'a0000001-0000-4000-8000-000000000099' })).toBe(false);
  });
});
