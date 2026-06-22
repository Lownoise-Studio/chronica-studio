import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'pse_advanced_mode_v1';

type AdvancedModeContextType = {
  advancedMode: boolean;
  toggleAdvancedMode: () => void;
};

const AdvancedModeContext = createContext<AdvancedModeContextType>({
  advancedMode: false,
  toggleAdvancedMode: () => {},
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

  return (
    <AdvancedModeContext.Provider value={{ advancedMode, toggleAdvancedMode }}>
      {children}
    </AdvancedModeContext.Provider>
  );
}

export function useAdvancedMode() {
  return useContext(AdvancedModeContext);
}
