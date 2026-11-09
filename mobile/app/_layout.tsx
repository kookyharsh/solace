import 'react-native-gesture-handler';
import '../global.css';
import { Stack, router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts as useInter, Inter_400Regular } from '@expo-google-fonts/inter';
import { useFonts as useNunito, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { AppState, Platform } from 'react-native';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { configureNotificationCategories } from '../src/notifications';
import * as Notifications from 'expo-notifications';
import { logMood, submitNotificationReply, syncOnboardingSetup, updateActivity } from '../src/api';
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
    if (Platform.OS === 'web') return;
    void configureNotificationCategories();
    const handled = new Set<string>();
    const handle = async (response: Notifications.NotificationResponse) => {
      const responseKey = `${response.notification.request.identifier}:${response.actionIdentifier}`;
      if (handled.has(responseKey)) return;
      handled.add(responseKey);
      const data = response.notification.request.content.data;
      const conversationId = typeof data?.conversationId === 'string' ? data.conversationId : undefined;
      const activityId = typeof data?.activityId === 'string' ? data.activityId : undefined;
      const action = response.actionIdentifier;
      const reply = 'userText' in response ? response.userText : undefined;
      try {
        if (action === 'reply' && typeof reply === 'string' && reply.trim()) {
          await submitNotificationReply(reply, conversationId);
        } else if (action.startsWith('mood-')) {
          await logMood(Number(action.slice(5)));
        } else if (activityId && ['done', 'cancel', 'snooze'].includes(action)) {
          await updateActivity(activityId, action === 'snooze' ? { snoozedUntil: new Date(Date.now() + 10 * 60000).toISOString() } : { status: action === 'done' ? 'completed' : 'cancelled' });
        }
      } catch (error) { console.warn('Notification action failed', error); }
      if (action === Notifications.DEFAULT_ACTION_IDENTIFIER || action === 'open' || action === 'start') {
        router.push(conversationId ? { pathname: '/(tabs)/chat', params: { conversationId } } : '/(tabs)/chat');
      }
    };
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => { void handle(response); });
    void Notifications.getLastNotificationResponseAsync().then(response => { if (response) void handle(response); }).finally(() => { void Notifications.clearLastNotificationResponseAsync(); });
    return () => subscription.remove();
  }, []);

  // While fonts are loading, keep the native splash on screen (don't render
  // anything — SplashScreen.preventAutoHideAsync() already holds the window).
  if (!inter || !nunito) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <SafeAreaProvider>
            <Stack
              screenOptions={{
                headerShown: false,
              }}
            />
          </SafeAreaProvider>
        </ThemeProvider>
    </GestureHandlerRootView>
  );
}
