import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_STORAGE_KEYS, clearAdvancedModePreference } from '@/storage/dev-reset';

const STORAGE_KEY = APP_STORAGE_KEYS.advancedMode;

type AdvancedModeContextType = {
  advancedMode: boolean;
  toggleAdvancedMode: () => void;
  resetAdvancedMode: () => Promise<void>;
};

const AdvancedModeContext = createContext<AdvancedModeContextType>({
  advancedMode: false,
  toggleAdvancedMode: () => {},
  resetAdvancedMode: async () => {},
});

export function AdvancedModeProvider({ children }: { children: React.ReactNode }) {
  const [advancedMode, setAdvancedMode] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(val => { if (val === 'true') setAdvancedMode(true); })
      .catch(() => {});
  }, []);

  const toggleAdvancedMode = () => {
    setAdvancedMode(prev => {
      const next = !prev;
      AsyncStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  const resetAdvancedMode = async () => {
    setAdvancedMode(false);
    await clearAdvancedModePreference();
  };

  return (
    <AdvancedModeContext.Provider value={{ advancedMode, toggleAdvancedMode, resetAdvancedMode }}>
      {children}
    </AdvancedModeContext.Provider>
  );
}

export function useAdvancedMode() {
  return useContext(AdvancedModeContext);
}
