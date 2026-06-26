import { useEffect, useRef } from 'react';

async function playAudioFromUri(uri: string): Promise<{ unload: () => void } | null> {
  try {
    const { Audio } = await import('expo-av');
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { isLooping: true, shouldPlay: true },
    );
    return { unload: () => sound.unloadAsync().catch(() => {}) };
  } catch {
    return null;
  }
}

/** Loop scene background audio; unloads when the scene or URI changes. */
export function useSceneAudio(audioUri: string | undefined, sceneKey: string | undefined): void {
  const audioHandleRef = useRef<{ unload: () => void } | null>(null);

  useEffect(() => {
    if (audioHandleRef.current) {
      audioHandleRef.current.unload();
      audioHandleRef.current = null;
    }
    if (audioUri) {
      playAudioFromUri(audioUri).then(h => { audioHandleRef.current = h; });
    }
    return () => {
      audioHandleRef.current?.unload();
      audioHandleRef.current = null;
    };
  }, [sceneKey, audioUri]);
}
