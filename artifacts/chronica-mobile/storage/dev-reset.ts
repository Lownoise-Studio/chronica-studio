import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FS from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { assetDir } from './fileSystem';

export const APP_STORAGE_KEYS = {
  projects: 'pse_projects_v1',
  onboarded: 'pse_onboarded_v1',
  advancedMode: 'pse_advanced_mode_v1',
  runtimeSavePrefix: 'pse_save_',
} as const;

export async function clearRuntimeSaves(projectIds?: string[]): Promise<void> {
  if (projectIds?.length) {
    await AsyncStorage.multiRemove(
      projectIds.map(id => `${APP_STORAGE_KEYS.runtimeSavePrefix}${id}`),
    );
    return;
  }

  const keys = await AsyncStorage.getAllKeys();
  const saveKeys = keys.filter(key => key.startsWith(APP_STORAGE_KEYS.runtimeSavePrefix));
  if (saveKeys.length) {
    await AsyncStorage.multiRemove(saveKeys);
  }
}

export async function clearProjectAssets(projectIds: string[]): Promise<void> {
  if (Platform.OS === 'web' || !projectIds.length) return;

  await Promise.all(projectIds.map(async projectId => {
    try {
      await FS.deleteAsync(assetDir(projectId), { idempotent: true });
    } catch {
      // Best-effort cleanup during dev resets.
    }
  }));
}

export async function clearAdvancedModePreference(): Promise<void> {
  await AsyncStorage.removeItem(APP_STORAGE_KEYS.advancedMode);
}
