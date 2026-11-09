import 'react-native-gesture-handler';
import '../global.css';
import { HeroUINativeProvider } from 'heroui-native/provider';
import { Stack, router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts as useInter, Inter_400Regular } from '@expo-google-fonts/inter';
import { useFonts as useNunito, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { AppState, Text, View } from 'react-native';
import { useEffect } from 'react';
import { configureNotificationCategories } from '../src/notifications';
import * as Notifications from 'expo-notifications';
import { submitNotificationReply, syncOnboardingSetup } from '../src/api';
import { ThemeProvider } from '../src/theme';

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
  if (!inter || !nunito)
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Solace</Text>
      </View>
    );
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider>
        <ThemeProvider>
          <SafeAreaProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </SafeAreaProvider>
        </ThemeProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
