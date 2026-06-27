import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useProjects } from '@/context/ProjectsContext';
import { pickAndLoadGame, loadGameFromPackageBytes } from '@/storage/load-game';
import { buildPasturePackageBytes } from '@/demo/pasture-package';
import type { Project } from '@/engine/types';

import type { Router } from 'expo-router';

export type LoadGameNavigation = {
  projectId: string;
  autoStart?: boolean;
};

function formatLoadError(error: string, diagnostics?: { message: string }[]): string {
  if (!diagnostics?.length) return error;
  return `${error}\n\n${diagnostics.slice(0, 4).map(d => `• ${d.message}`).join('\n')}`;
}

export function useLoadGameActions() {
  const { importProject, importProjectPackage } = useProjects();
  const [loadingGame, setLoadingGame] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);

  const loadProjectBytes = async (bytes: Uint8Array): Promise<LoadGameNavigation | null> => {
    const result = await loadGameFromPackageBytes(bytes, { importProject, importProjectPackage });
    if (!result.ok) {
      Alert.alert('Could not load game', formatLoadError(result.error, result.diagnostics));
      return null;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return { projectId: result.project.id, autoStart: true };
  };

  const handleLoadGame = async (): Promise<LoadGameNavigation | null> => {
    if (Platform.OS === 'web') {
      Alert.alert('Not supported', 'Load Game is not available in the web preview. Use the native mobile app.');
      return null;
    }
    setLoadingGame(true);
    try {
      const result = await pickAndLoadGame({ importProject, importProjectPackage });
      if (!result.ok) {
        if (result.cancelled) return null;
        Alert.alert('Could not load game', formatLoadError(result.error, result.diagnostics));
        return null;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return { projectId: result.project.id, autoStart: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not load game.';
      Alert.alert('Could not load game', msg);
      return null;
    } finally {
      setLoadingGame(false);
    }
  };

  const handleTryDemo = async (): Promise<LoadGameNavigation | null> => {
    if (Platform.OS === 'web') {
      Alert.alert('Not supported', 'Try Demo is not available in the web preview. Use the native mobile app.');
      return null;
    }
    setLoadingDemo(true);
    try {
      const bytes = buildPasturePackageBytes();
      const result = await loadGameFromPackageBytes(bytes, { importProject, importProjectPackage });
      if (!result.ok) {
        Alert.alert(
          'Could not load demo',
          formatLoadError(result.error, result.diagnostics),
        );
        return null;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return { projectId: result.project.id, autoStart: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not load demo.';
      Alert.alert('Could not load demo', msg);
      return null;
    } finally {
      setLoadingDemo(false);
    }
  };

  return {
    loadingGame,
    loadingDemo,
    loadProjectBytes,
    handleLoadGame,
    handleTryDemo,
  };
}

export function navigateToPlay(router: Pick<Router, 'push'>, nav: LoadGameNavigation) {
  router.push({
    pathname: '/project/[id]/play',
    params: {
      id: nav.projectId,
      ...(nav.autoStart ? { loaded: '1' } : {}),
    },
  });
}

export function showRemoveGameMenu(
  project: Project,
  deleteProject: (id: string) => void,
) {
  Alert.alert(project.title, 'Remove this game from your library?', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Remove',
      style: 'destructive',
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        deleteProject(project.id);
      },
    },
  ]);
}
