import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import { Uniwind } from 'uniwind';

export const colors = {
  light: { bg: '#FFFFFF', text: '#17171A', muted: '#6B6B76', divider: '#E7E7EC', input: '#F6F6F8', userBubble: '#F2F2F5', accent: '#7C5CFA', onAccent: '#FFFFFF' },
  dark: { bg: '#101012', text: '#F2F2F5', muted: '#9A9AA5', divider: '#26262B', input: '#1A1A1E', userBubble: '#26262B', accent: '#9D86FF', onAccent: '#101012' },
} as const;

const shared = {
  spacing: { xs: 4, sm: 8, md: 16, lg: 20, xl: 32, xxl: 48 },
  radii: { sm: 12, md: 12, lg: 16, pill: 999 },
  typography: { display: 28, title: 18, body: 16, caption: 13 },
} as const;
export const themes = {
  light: {
    ...shared,
    colors: { ...colors.light, background: colors.light.bg, surface: colors.light.bg, ink: colors.light.text, primary: colors.light.accent, onPrimary: colors.light.onAccent, secondary: colors.light.divider, border: colors.light.divider, wash: colors.light.bg, warning: colors.light.muted },
  },
  dark: {
    ...shared,
    colors: { ...colors.dark, background: colors.dark.bg, surface: colors.dark.bg, ink: colors.dark.text, primary: colors.dark.accent, onPrimary: colors.dark.onAccent, secondary: colors.dark.divider, border: colors.dark.divider, wash: colors.dark.bg, warning: colors.dark.muted },
  },
};
export type ThemeMode = 'system' | 'light' | 'dark';
const ThemeModeContext = createContext<{ mode: ThemeMode; setMode: (mode: ThemeMode) => void }>({
  mode: 'system',
  setMode: () => undefined,
});
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  useEffect(() => {
    AsyncStorage.getItem('solace.theme').then((value) => {
      if (value === 'light' || value === 'dark' || value === 'system') setModeState(value);
    });
  }, []);
  useEffect(() => {
    Uniwind.setTheme(mode);
  }, [mode]);
  const setMode = (next: ThemeMode) => {
    setModeState(next);
    void AsyncStorage.setItem('solace.theme', next);
  };
  return createElement(ThemeModeContext.Provider, { value: { mode, setMode } }, children);
}
export function useThemeMode() {
  return useContext(ThemeModeContext);
}
export function useTheme() {
  const system = useColorScheme();
  const { mode } = useThemeMode();
  return themes[mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode];
}
