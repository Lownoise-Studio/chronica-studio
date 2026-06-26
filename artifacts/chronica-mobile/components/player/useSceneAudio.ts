import { useEffect, useRef } from 'react';

export type SceneAudioHandle = { unload: () => void };
export type SceneAudioLoader = (uri: string) => Promise<SceneAudioHandle | null>;

async function playAudioFromUri(uri: string): Promise<SceneAudioHandle | null> {
  const { Audio } = await import('expo-av');
  try {
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

export function createSceneAudioController(loadAudio: SceneAudioLoader = playAudioFromUri) {
  let activeHandle: SceneAudioHandle | null = null;
  let generation = 0;

  const unloadActive = () => {
    activeHandle?.unload();
    activeHandle = null;
  };

  return {
    load(audioUri: string | undefined): () => void {
      const currentGeneration = ++generation;
      unloadActive();

      if (audioUri) {
        loadAudio(audioUri)
          .then(handle => {
            if (!handle) return;
            if (generation !== currentGeneration) {
              handle.unload();
              return;
            }
            activeHandle = handle;
          })
          .catch(() => {});
      }

      return () => {
        if (generation === currentGeneration) {
          generation += 1;
        }
        unloadActive();
      };
    },
  };
}

/** Loop scene background audio; unloads when the scene or URI changes. */
export function useSceneAudio(audioUri: string | undefined, sceneKey: string | undefined): void {
  const controllerRef = useRef<ReturnType<typeof createSceneAudioController> | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = createSceneAudioController();
  }

  useEffect(() => {
    return controllerRef.current?.load(audioUri);
  }, [sceneKey, audioUri]);
}
