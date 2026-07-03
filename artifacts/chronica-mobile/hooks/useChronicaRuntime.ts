import { useCallback, useEffect, useMemo, useState } from 'react';
import { compileProject } from '@/engine/compiler';
import {
  AdventureInteractable,
  Choice,
  ChronicaState,
  Project,
  SceneHotspot,
  ValidationError,
} from '@/engine/types';
import {
  ActivateInteractableResult,
  MovePlayerResult,
  PlayerHost,
  PlayerActionResult,
  PlayerAdvanceDialogueResult,
  PlayerSnapshot,
  RuntimeSave,
  ResumeResult,
} from '@/runtime';

const EMPTY_SNAPSHOT: PlayerSnapshot = {
  started: false,
  state: null,
  fragment: null,
  visibleChoices: [],
  visibleHotspots: [],
  visibleInteractables: [],
  history: [],
  backgroundUri: undefined,
  audioUri: undefined,
  assetWarnings: [],
  runtimeWarnings: [],
  dialogue: null,
  stageActors: [],
};

export function useChronicaRuntime(project: Project | undefined) {
  const [view, setView] = useState<PlayerSnapshot>(EMPTY_SNAPSHOT);

  const compileResult = useMemo(() => {
    if (!project) return null;
    return compileProject(project);
  }, [project?.id, project?.updatedAt]);

  const host = useMemo(() => {
    if (!compileResult?.ok) return null;
    return PlayerHost.create(compileResult.game);
  }, [compileResult]);

  const syncView = useCallback(() => {
    setView(host ? host.snapshot() : EMPTY_SNAPSHOT);
  }, [host]);

  useEffect(() => {
    syncView();
  }, [host, syncView]);

  /** Verify only uncached URIs; re-render once checks finish. */
  const verifyAndRefresh = useCallback(async (force = false) => {
    if (!host) return;
    await host.verifyAssets(force ? { force: true } : undefined);
    syncView();
  }, [host, syncView]);

  const start = useCallback((): boolean => {
    if (!host) return false;
    const ok = host.startNew();
    syncView();
    void verifyAndRefresh(true);
    return ok;
  }, [host, syncView, verifyAndRefresh]);

  const tryResume = useCallback((save: RuntimeSave): ResumeResult => {
    if (!host) return { ok: false, reason: 'corrupt-state' };
    const result = host.tryResume(save);
    syncView();
    void verifyAndRefresh(true);
    return result;
  }, [host, syncView, verifyAndRefresh]);

  const resume = useCallback((save: RuntimeSave): boolean => {
    return tryResume(save).ok;
  }, [tryResume]);

  const choose = useCallback((choice: Choice): PlayerActionResult => {
    if (!host) return { ok: false, reason: 'not-started' };
    const result = host.choose(choice);
    syncView();
    void verifyAndRefresh();
    return result;
  }, [host, syncView, verifyAndRefresh]);

  const activateHotspot = useCallback((hotspot: SceneHotspot): PlayerActionResult => {
    if (!host) return { ok: false, reason: 'not-started' };
    const result = host.activateHotspot(hotspot);
    syncView();
    void verifyAndRefresh();
    return result;
  }, [host, syncView, verifyAndRefresh]);

  const activateInteractable = useCallback(
    (interactable: AdventureInteractable): ActivateInteractableResult | PlayerActionResult => {
      if (!host) return { ok: false, reason: 'not-started' as const };
      const result = host.activateInteractable(interactable);
      syncView();
      void verifyAndRefresh();
      return result;
    },
    [host, syncView, verifyAndRefresh],
  );

  const movePlayer = useCallback(
    (dxNorm: number, dyNorm: number, seconds: number): MovePlayerResult => {
      if (!host) return { ok: false, reason: 'not-started' as const };
      const result = host.movePlayer(dxNorm, dyNorm, seconds);
      // Position updates are frequent — sync without re-verifying assets.
      syncView();
      return result;
    },
    [host, syncView],
  );

  const advanceDialogue = useCallback((): PlayerAdvanceDialogueResult => {
    if (!host) return { ok: false, reason: 'not-started' };
    const result = host.advanceDialogue();
    syncView();
    return result;
  }, [host, syncView]);

  const setRuntimeState = useCallback((next: ChronicaState) => {
    host?.setRuntimeState(next);
    syncView();
  }, [host, syncView]);

  const toSave = useCallback((installId: string): RuntimeSave | null => {
    return host?.toSave(installId) ?? null;
  }, [host]);

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
    activateInteractable,
    movePlayer,
    advanceDialogue,
    setRuntimeState,
    toSave,
  };
}
