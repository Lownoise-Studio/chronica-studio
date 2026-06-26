import { useCallback, useMemo, useReducer } from 'react';
import { compileProject } from '@/engine/compiler';
import { Choice, ChronicaState, Project, ValidationError } from '@/engine/types';
import {
  PlayerHost,
  ChooseResult,
  RuntimeSave,
  ResumeResult,
} from '@/runtime';

const EMPTY_SNAPSHOT = {
  started: false,
  state: null as ChronicaState | null,
  fragment: null,
  visibleChoices: [] as Choice[],
  history: [] as ReturnType<PlayerHost['snapshot']>['history'],
  backgroundUri: undefined as string | undefined,
  audioUri: undefined as string | undefined,
};

export function useChronicaRuntime(project: Project | undefined) {
  const [, tick] = useReducer((n: number) => n + 1, 0);

  const compileResult = useMemo(() => {
    if (!project) return null;
    return compileProject(project);
  }, [project?.id, project?.updatedAt]);

  const host = useMemo(() => {
    if (!compileResult?.ok) return null;
    return PlayerHost.create(compileResult.game);
  }, [compileResult]);

  const refresh = useCallback(() => tick(), []);

  const start = useCallback((): boolean => {
    if (!host) return false;
    const ok = host.startNew();
    refresh();
    return ok;
  }, [host, refresh]);

  const tryResume = useCallback((save: RuntimeSave): ResumeResult => {
    if (!host) return { ok: false, reason: 'corrupt-state' };
    const result = host.tryResume(save);
    refresh();
    return result;
  }, [host, refresh]);

  const resume = useCallback((save: RuntimeSave): boolean => {
    return tryResume(save).ok;
  }, [tryResume]);

  const choose = useCallback((choice: Choice): ChooseResult => {
    if (!host) return { ok: false, reason: 'not-started' };
    const result = host.choose(choice);
    refresh();
    return result;
  }, [host, refresh]);

  const setRuntimeState = useCallback((next: ChronicaState) => {
    host?.setRuntimeState(next);
    refresh();
  }, [host, refresh]);

  const toSave = useCallback((installId: string): RuntimeSave | null => {
    return host?.toSave(installId) ?? null;
  }, [host]);

  const view = host ? host.snapshot() : EMPTY_SNAPSHOT;
  const compileDiagnostics: ValidationError[] = compileResult?.ok
    ? []
    : compileResult?.diagnostics ?? [];

  return {
    host,
    runtime: host?.runtime ?? null,
    compileOk: compileResult?.ok ?? false,
    compileDiagnostics,
    ...view,
    start,
    resume,
    tryResume,
    choose,
    setRuntimeState,
    toSave,
  };
}
