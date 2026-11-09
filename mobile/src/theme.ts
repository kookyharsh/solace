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

export const palette = {
  lavender: '#A78BFA',
  lilac: '#E9D5FF',
  peach: '#FDBA9B',
  plum: '#352A45',
} as const;

const shared = {
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radii: { sm: 12, md: 18, lg: 24, pill: 999 },
  typography: { display: 34, title: 24, body: 16, caption: 14 },
  shadows: {
    card: {
      elevation: 3,
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
  },
} as const;
export const themes = {
  light: {
    ...shared,
    colors: {
      background: '#FFF9FC',
      surface: '#FFFFFF',
      ink: palette.plum,
      muted: '#74677E',
      primary: '#7656C9',
      onPrimary: '#FFFFFF',
      secondary: palette.peach,
      accent: palette.lilac,
      warning: '#F7C873',
      border: '#E9DFF0',
      wash: '#F4ECFF',
    },
  },
  dark: {
    ...shared,
    colors: {
      background: '#211B2B',
      surface: '#30253D',
      ink: '#FFF7FF',
      muted: '#D6C7E1',
      primary: '#C4B5FD',
      onPrimary: '#30253D',
      secondary: '#F7A987',
      accent: '#4D3A63',
      warning: '#F7C873',
      border: '#4A3B59',
      wash: '#3B2E4A',
    },
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
