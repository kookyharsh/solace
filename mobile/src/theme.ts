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
  sage: '#ABC270',
  honey: '#FEC868',
  apricot: '#FDA769',
  espresso: '#473C33',
} as const;

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
} as const;
export const themes = {
  light: {
    ...shared,
    colors: {
      background: '#FBF8EC',
      surface: '#FFFCF4',
      ink: palette.espresso,
      muted: '#716154',
      primary: '#4E602E',
      onPrimary: '#FFFFFF',
      secondary: palette.apricot,
      accent: palette.sage,
      warning: palette.honey,
      border: '#DFD6C1',
      wash: '#E9EED5',
    },
  },
  dark: {
    ...shared,
    colors: {
      background: '#252019',
      surface: '#332B22',
      ink: '#FFF6E6',
      muted: '#CFBFAC',
      primary: palette.sage,
      onPrimary: '#252019',
      secondary: palette.apricot,
      accent: palette.sage,
      warning: palette.honey,
      border: '#584A3A',
      wash: '#313722',
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
