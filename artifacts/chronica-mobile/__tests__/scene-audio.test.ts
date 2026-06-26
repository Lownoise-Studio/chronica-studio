import { createSceneAudioController, SceneAudioHandle } from '@/components/player/useSceneAudio';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

describe('scene audio lifecycle', () => {
  it('unloads stale audio that resolves after a newer scene starts loading', async () => {
    const first = deferred<SceneAudioHandle | null>();
    const second = deferred<SceneAudioHandle | null>();
    const firstHandle = { unload: jest.fn() };
    const secondHandle = { unload: jest.fn() };
    const loadAudio = jest.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const controller = createSceneAudioController(loadAudio);

    controller.load('first.mp3');
    controller.load('second.mp3');

    first.resolve(firstHandle);
    await first.promise;
    await Promise.resolve();

    expect(firstHandle.unload).toHaveBeenCalledTimes(1);
    expect(secondHandle.unload).not.toHaveBeenCalled();

    second.resolve(secondHandle);
    await second.promise;
    await Promise.resolve();

    expect(secondHandle.unload).not.toHaveBeenCalled();
  });

  it('unloads audio that resolves after cleanup', async () => {
    const pending = deferred<SceneAudioHandle | null>();
    const handle = { unload: jest.fn() };
    const controller = createSceneAudioController(jest.fn().mockReturnValue(pending.promise));

    const cleanup = controller.load('scene.mp3');
    cleanup();

    pending.resolve(handle);
    await pending.promise;
    await Promise.resolve();

    expect(handle.unload).toHaveBeenCalledTimes(1);
  });

  it('preserves normal playback until cleanup', async () => {
    const handle = { unload: jest.fn() };
    const controller = createSceneAudioController(jest.fn().mockResolvedValue(handle));

    const cleanup = controller.load('scene.mp3');
    await Promise.resolve();

    expect(handle.unload).not.toHaveBeenCalled();

    cleanup();

    expect(handle.unload).toHaveBeenCalledTimes(1);
  });
});
