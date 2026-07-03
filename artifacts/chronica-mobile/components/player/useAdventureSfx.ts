import { useCallback, useEffect, useRef } from 'react';
import { resolveAssetUri } from '@/engine/asset-resolver';
import type { ProjectAsset } from '@/engine/types';

/**
 * Lightweight one-shot SFX player. Loads sounds lazily and unloads them when
 * the hook unmounts. Failures are swallowed — SFX is decorative, not required.
 */
export function useAdventureSfx(assets: readonly ProjectAsset[]) {
  const cacheRef = useRef<Map<string, unknown>>(new Map());
  const activeRef = useRef<Set<unknown>>(new Set());

  useEffect(() => {
    return () => {
      const active = activeRef.current;
      active.forEach((sound: any) => {
        try {
          sound?.unloadAsync?.();
        } catch {
          // ignore
        }
      });
      active.clear();
      cacheRef.current.clear();
    };
  }, []);

  const play = useCallback(async (assetName: string | undefined): Promise<void> => {
    if (!assetName) return;
    const uri = resolveAssetUri(assets, assetName);
    if (!uri) return;
    try {
      const { Audio } = await import('expo-av');
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true, volume: 0.8 });
      activeRef.current.add(sound);
      sound.setOnPlaybackStatusUpdate(status => {
        if (!status || typeof status !== 'object') return;
        // expo-av loaded status has didJustFinish; check duck-typing.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((status as any).didJustFinish) {
          activeRef.current.delete(sound);
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch {
      // ignore audio errors — SFX must never break gameplay.
    }
  }, [assets]);

  return { play };
}
