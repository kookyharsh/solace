import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

const shared = {
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radii: { sm: 12, md: 20, lg: 28, pill: 999 },
  typography: { display: 34, title: 24, body: 16, caption: 14 },
  shadows: {
    card: {
      elevation: 3,
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
  },
  mood: ['#8A8FB8', '#9DB4E0', '#BFD8C8', '#FFD98A', '#FFB59E'],
} as const;
export const themes = {
  light: {
    ...shared,
    colors: {
      background: '#FBF7F2',
      surface: '#FFFFFF',
      ink: '#2B2A33',
      muted: '#7C7A8A',
      primary: '#8B7CF6',
      secondary: '#FFB59E',
      accent: '#8FD6C0',
      warning: '#FFD98A',
    },
  },
  dark: {
    ...shared,
    colors: {
      background: '#14121C',
      surface: '#1E1B2B',
      ink: '#F3F0FA',
      muted: '#A6A0B6',
      primary: '#A99CFF',
      secondary: '#FFB59E',
      accent: '#8FD6C0',
      warning: '#FFD98A',
    },
  },
};
export type ThemeMode = 'system' | 'light' | 'dark';
const ThemeModeContext = createContext<{ mode: ThemeMode; setMode: (mode: ThemeMode) => void }>({ mode: 'system', setMode: () => undefined });
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  useEffect(() => { AsyncStorage.getItem('solace.theme').then((value) => { if (value === 'light' || value === 'dark' || value === 'system') setModeState(value); }); }, []);
  const setMode = (next: ThemeMode) => { setModeState(next); void AsyncStorage.setItem('solace.theme', next); };
  return <ThemeModeContext.Provider value={{ mode, setMode }}>{children}</ThemeModeContext.Provider>;
}
export function useThemeMode() { return useContext(ThemeModeContext); }
export function useTheme() {
  const system = useColorScheme();
  const { mode } = useThemeMode();
  return themes[mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode];
}
