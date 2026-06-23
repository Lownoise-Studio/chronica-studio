import { useCallback, useMemo, useReducer } from 'react';
import { Choice, ChronicaState, Fragment, Project } from '@/engine/types';
import {
  ChronicaRuntime,
  ChooseResult,
  HistoryEntry,
  RuntimeSave,
} from '@/runtime';

type RuntimeSnapshot = {
  started: boolean;
  state: ChronicaState | null;
  fragment: Fragment | null;
  visibleChoices: Choice[];
  history: HistoryEntry[];
  backgroundUri: string | undefined;
  audioUri: string | undefined;
};

function snapshot(runtime: ChronicaRuntime): RuntimeSnapshot {
  return {
    started: runtime.isStarted,
    state: runtime.runtimeState,
    fragment: runtime.currentFragment,
    visibleChoices: runtime.visibleChoices,
    history: runtime.pathHistory,
    backgroundUri: runtime.getBackgroundUri(),
    audioUri: runtime.getAudioUri(),
  };
}

const EMPTY_SNAPSHOT: RuntimeSnapshot = {
  started: false,
  state: null,
  fragment: null,
  visibleChoices: [],
  history: [],
  backgroundUri: undefined,
  audioUri: undefined,
};

export function useChronicaRuntime(project: Project | undefined) {
  const [, tick] = useReducer((n: number) => n + 1, 0);

  const runtime = useMemo(() => {
    if (!project) return null;
    return new ChronicaRuntime(project);
  }, [project?.id]);

  const refresh = useCallback(() => tick(), []);

  const start = useCallback((): boolean => {
    if (!runtime) return false;
    const ok = runtime.start();
    refresh();
    return ok;
  }, [runtime, refresh]);

  const resume = useCallback((save: RuntimeSave): boolean => {
    if (!runtime) return false;
    const ok = runtime.resume(save);
    refresh();
    return ok;
  }, [runtime, refresh]);

  const choose = useCallback((choice: Choice): ChooseResult => {
    if (!runtime) return { ok: false, reason: 'not-started' };
    const result = runtime.choose(choice);
    refresh();
    return result;
  }, [runtime, refresh]);

  const setRuntimeState = useCallback((next: ChronicaState) => {
    runtime?.setRuntimeState(next);
    refresh();
  }, [runtime, refresh]);

  const toSave = useCallback((projectId: string): RuntimeSave | null => {
    return runtime?.toSave(projectId) ?? null;
  }, [runtime]);

  const view = runtime ? snapshot(runtime) : EMPTY_SNAPSHOT;

  return {
    runtime,
    ...view,
    start,
    resume,
    choose,
    setRuntimeState,
    toSave,
  };
}
