import 'react-native-gesture-handler';
import '../global.css';
import { HeroUINativeProvider } from 'heroui-native/provider';
import { Stack, router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts as useInter, Inter_400Regular } from '@expo-google-fonts/inter';
import { useFonts as useNunito, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { AppState } from 'react-native';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { configureNotificationCategories } from '../src/notifications';
import * as Notifications from 'expo-notifications';
import { submitNotificationReply, syncOnboardingSetup } from '../src/api';
import { ThemeProvider } from '../src/theme';

// Keep the native splash window visible until we explicitly hide it in index.tsx
// (after fonts are loaded and onboarding state is resolved).
SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [inter] = useInter({ Inter_400Regular });
  const [nunito] = useNunito({ Nunito_700Bold });

  useEffect(() => {
    syncOnboardingSetup();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncOnboardingSetup();
    });
    const retry = setInterval(() => {
      if (AppState.currentState === 'active') syncOnboardingSetup();
    }, 30_000);
    return () => {
      clearInterval(retry);
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    void configureNotificationCategories();
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = response.notification.request.content.data?.route;
      if (typeof route === 'string') router.push(route as never);
      const action = response.actionIdentifier;
      const reply = 'userText' in response ? response.userText : undefined;
      if (action === 'reply' && typeof reply === 'string' && reply.trim())
        void submitNotificationReply(reply).catch(() => undefined);
    });
    return () => subscription.remove();
  }, []);

  // While fonts are loading, keep the native splash on screen (don't render
  // anything — SplashScreen.preventAutoHideAsync() already holds the window).
  if (!inter || !nunito) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider>
        <ThemeProvider>
          <SafeAreaProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                animation: 'fade',
                animationDuration: 280,
              }}
            />
          </SafeAreaProvider>
        </ThemeProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
