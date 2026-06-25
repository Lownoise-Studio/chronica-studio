import {
  getPlayerLayoutMode,
  getStoryTextColor,
  getChoiceSurfaceColor,
  shouldShowSceneBackground,
  getBackgroundOverlayColor,
  BACKGROUND_OVERLAY_OPACITY,
  CONTENT_PANEL_BG,
} from '../engine/player-presentation';
import { resolveSceneBackgroundUri } from '../engine/asset-resolver';
import {
  startSession,
  choose,
  serializeState,
  deserializeState,
} from '../engine/chronica-session';
import { buildCompiledGame } from '../engine/compiler';
import {
  playerReadabilityStory,
  readabilitySceneIds,
} from './fixtures/player-readability-story';

const FOREGROUND = '#e8e6f0';
const SECONDARY = '#1e1d2b';

function layoutForScene(locationId: string) {
  const fragment = playerReadabilityStory.fragments.find(f => f.locationId === locationId)!;
  const uri = resolveSceneBackgroundUri(
    playerReadabilityStory.assets,
    fragment.backgroundImage,
  );
  const showBackground = shouldShowSceneBackground(uri);
  return {
    fragment,
    uri,
    showBackground,
    layoutMode: getPlayerLayoutMode(showBackground),
    textColor: getStoryTextColor(showBackground, FOREGROUND),
    choiceBg: getChoiceSurfaceColor(showBackground, SECONDARY),
  };
}

describe('player readability story fixture', () => {
  test('scene 1: long text + background resolves image layout', () => {
    const { fragment, uri, showBackground, layoutMode } = layoutForScene(readabilitySceneIds.long);
    expect(fragment.text.length).toBeGreaterThan(500);
    expect(fragment.backgroundImage).toBe('scroll-bg.jpg');
    expect(uri).toContain('scroll-bg.jpg');
    expect(showBackground).toBe(true);
    expect(layoutMode).toBe('image');
    expect(getBackgroundOverlayColor()).toBe(`rgba(0,0,0,${BACKGROUND_OVERLAY_OPACITY})`);
  });

  test('scene 2: short text + different background resolves image layout', () => {
    const { fragment, uri, showBackground, layoutMode } = layoutForScene(readabilitySceneIds.short);
    expect(fragment.text.split('\n\n').length).toBeLessThanOrEqual(3);
    expect(fragment.backgroundImage).toBe('short-bg.jpg');
    expect(uri).toContain('short-bg.jpg');
    expect(showBackground).toBe(true);
    expect(layoutMode).toBe('image');
  });

  test('scene 3: no image uses plain layout', () => {
    const { fragment, uri, showBackground, layoutMode, textColor, choiceBg } =
      layoutForScene(readabilitySceneIds.plain);
    expect(fragment.backgroundImage).toBeUndefined();
    expect(uri).toBeUndefined();
    expect(showBackground).toBe(false);
    expect(layoutMode).toBe('plain');
    expect(textColor).toBe(FOREGROUND);
    expect(choiceBg).toBe(SECONDARY);
  });
});

describe('player readability navigation', () => {
  const readabilityGame = buildCompiledGame(playerReadabilityStory);

  test('moving between scenes updates background resolution', () => {
    let session = startSession(readabilityGame);
    expect(
      resolveSceneBackgroundUri(
        playerReadabilityStory.assets,
        session.fragment?.backgroundImage,
      ),
    ).toContain('scroll-bg.jpg');

    session = {
      ...session,
      ...choose(session.visibleChoices[0], session.state, readabilityGame),
    };
    expect(session.fragment?.locationId).toBe(readabilitySceneIds.short);
    expect(
      resolveSceneBackgroundUri(
        playerReadabilityStory.assets,
        session.fragment?.backgroundImage,
      ),
    ).toContain('short-bg.jpg');

    const toPlain = session.visibleChoices.find(c => c.action === 'goto:plain-scene')!;
    session = {
      ...session,
      ...choose(toPlain, session.state, readabilityGame),
    };
    expect(session.fragment?.locationId).toBe(readabilitySceneIds.plain);
    expect(
      resolveSceneBackgroundUri(
        playerReadabilityStory.assets,
        session.fragment?.backgroundImage,
      ),
    ).toBeUndefined();

    const backToShort = session.visibleChoices[0];
    session = {
      ...session,
      ...choose(backToShort, session.state, readabilityGame),
    };
    expect(
      resolveSceneBackgroundUri(
        playerReadabilityStory.assets,
        session.fragment?.backgroundImage,
      ),
    ).toContain('short-bg.jpg');

    const returnLong = session.visibleChoices.find(c => c.action === 'goto:long-scene')!;
    session = {
      ...session,
      ...choose(returnLong, session.state, readabilityGame),
    };
    expect(session.fragment?.locationId).toBe(readabilitySceneIds.long);
    expect(
      resolveSceneBackgroundUri(
        playerReadabilityStory.assets,
        session.fragment?.backgroundImage,
      ),
    ).toContain('scroll-bg.jpg');
  });

  test('save/resume round-trip preserves location for background restore', () => {
    const shortStartGame = buildCompiledGame({
      ...playerReadabilityStory,
      startLocation: readabilitySceneIds.short,
    });
    const started = startSession(shortStartGame);
    const toPlain = started.visibleChoices.find(c => c.action === 'goto:plain-scene')!;
    choose(toPlain, started.state, shortStartGame);

    const json = serializeState(started.state);
    const restored = deserializeState(JSON.parse(json));
    expect(restored?.location).toBe(readabilitySceneIds.plain);

    const frag = playerReadabilityStory.fragments.find(
      f => f.locationId === restored!.location,
    );
    expect(shouldShowSceneBackground(
      resolveSceneBackgroundUri(playerReadabilityStory.assets, frag?.backgroundImage),
    )).toBe(false);
  });
});

describe('player presentation tokens', () => {
  test('failed image load falls back to plain layout', () => {
    expect(shouldShowSceneBackground('file:///img.jpg', true)).toBe(false);
    expect(getPlayerLayoutMode(false)).toBe('plain');
  });

  test('content panel token matches spec', () => {
    expect(CONTENT_PANEL_BG).toBe('rgba(5,5,12,0.72)');
  });

  test('choice cards stay on elevated surface when image active', () => {
    expect(getChoiceSurfaceColor(true, SECONDARY)).toBe('rgba(30,29,43,0.92)');
    expect(getChoiceSurfaceColor(false, SECONDARY)).toBe(SECONDARY);
  });
});
