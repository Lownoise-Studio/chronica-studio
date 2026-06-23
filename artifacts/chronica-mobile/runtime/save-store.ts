import AsyncStorage from '@react-native-async-storage/async-storage';
import { RuntimeSave } from './chronica-runtime';

function saveKey(projectId: string): string {
  return `pse_save_${projectId}`;
}

export async function loadRuntimeSave(projectId: string): Promise<RuntimeSave | null> {
  try {
    const json = await AsyncStorage.getItem(saveKey(projectId));
    if (!json) return null;
    return JSON.parse(json) as RuntimeSave;
  } catch {
    return null;
  }
}

export async function persistRuntimeSave(save: RuntimeSave): Promise<void> {
  await AsyncStorage.setItem(saveKey(save.projectId), JSON.stringify(save));
}
