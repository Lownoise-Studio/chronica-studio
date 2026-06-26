import { useCallback, useMemo, useReducer } from 'react';
import { compileProject } from '@/engine/compiler';
import { Choice, ChronicaState, Project, SceneHotspot, ValidationError } from '@/engine/types';
import {
  PlayerHost,
  PlayerActionResult,
  PlayerAdvanceDialogueResult,
  RuntimeSave,
  ResumeResult,
} from '@/runtime';

const EMPTY_SNAPSHOT = {
  started: false,
  state: null as ChronicaState | null,
  fragment: null,
  visibleChoices: [] as Choice[],
  visibleHotspots: [] as SceneHotspot[],
  history: [] as ReturnType<PlayerHost['snapshot']>['history'],
  backgroundUri: undefined as string | undefined,
  audioUri: undefined as string | undefined,
  assetWarnings: [] as ReturnType<PlayerHost['snapshot']>['assetWarnings'],
  runtimeWarnings: [] as ReturnType<PlayerHost['snapshot']>['runtimeWarnings'],
  dialogue: null as ReturnType<PlayerHost['snapshot']>['dialogue'],
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

  /** Fire-and-forget asset existence check; re-renders once it resolves. Never blocks the action result. */
  const verifyAndRefresh = useCallback(() => {
    if (!host) return;
    host.verifyAssets().then(refresh).catch(refresh);
  }, [host, refresh]);

  const start = useCallback((): boolean => {
    if (!host) return false;
    const ok = host.startNew();
    refresh();
    verifyAndRefresh();
    return ok;
  }, [host, refresh, verifyAndRefresh]);

  const tryResume = useCallback((save: RuntimeSave): ResumeResult => {
    if (!host) return { ok: false, reason: 'corrupt-state' };
    const result = host.tryResume(save);
    refresh();
    verifyAndRefresh();
    return result;
  }, [host, refresh, verifyAndRefresh]);

  const resume = useCallback((save: RuntimeSave): boolean => {
    return tryResume(save).ok;
  }, [tryResume]);

  const choose = useCallback((choice: Choice): PlayerActionResult => {
    if (!host) return { ok: false, reason: 'not-started' };
    const result = host.choose(choice);
    refresh();
    verifyAndRefresh();
    return result;
  }, [host, refresh, verifyAndRefresh]);

  const activateHotspot = useCallback((hotspot: SceneHotspot): PlayerActionResult => {
    if (!host) return { ok: false, reason: 'not-started' };
    const result = host.activateHotspot(hotspot);
    refresh();
    verifyAndRefresh();
    return result;
  }, [host, refresh, verifyAndRefresh]);

  const advanceDialogue = useCallback((): PlayerAdvanceDialogueResult => {
    if (!host) return { ok: false, reason: 'not-started' };
    const result = host.advanceDialogue();
    refresh();
    verifyAndRefresh();
    return result;
  }, [host, refresh, verifyAndRefresh]);

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
    activateHotspot,
    advanceDialogue,
    setRuntimeState,
    toSave,
  };
}
