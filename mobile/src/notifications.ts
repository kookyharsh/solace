import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerDevice } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function configureNotificationCategories() {
  // Notification action categories are implemented by the iOS/Android native
  // modules. Expo's web implementation intentionally does not provide them.
  if (Platform.OS === 'web') return;

  await Notifications.setNotificationCategoryAsync('solace-checkin', [
    {
      identifier: 'reply',
      buttonTitle: 'Reply',
      textInput: { submitButtonTitle: 'Send', placeholder: 'Reply to your companion…' },
      options: { opensAppToForeground: false, isAuthenticationRequired: false },
    },
    { identifier: 'open', buttonTitle: 'Open chat', options: { opensAppToForeground: true } },
  ]);
  await Notifications.setNotificationCategoryAsync('solace-reminder', [
    { identifier: 'start', buttonTitle: 'Start now', options: { opensAppToForeground: true } },
    {
      identifier: 'snooze',
      buttonTitle: 'Snooze 10 min',
      options: { opensAppToForeground: false },
    },
  ]);
}

export async function requestNotifications() {
  // expo-notifications does not provide local scheduling on the web target.
  // Returning false lets each reminder flow exit without attempting a native call.
  if (Platform.OS === 'web') return false;

  const current = await Notifications.getPermissionsAsync();
  if (current.status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    if (requested.status !== 'granted') return false;
  }
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    await registerDevice(
      token.data,
      Platform.OS === 'android' ? 'android' : Platform.OS === 'ios' ? 'ios' : 'web',
    );
  } catch (error) {
    // Expo Go and development clients without push credentials can still use local reminders.
    console.warn('Failed to register push token with backend:', error);
  }
  return true;
}

export async function scheduleGentleReminder(
  title = 'A gentle moment',
  body = 'How are you feeling right now?',
) {
  const enabled = await requestNotifications();
  if (!enabled) return null;
  await configureNotificationCategories();
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      categoryIdentifier: 'solace-checkin',
      data: { route: '/(tabs)/chat', source: 'notification' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 60 * 60 * 4,
      repeats: true,
    },
  });
}
export async function scheduleDefaultDailyReminders(companionName = 'Your companion') {
  const enabled = await requestNotifications();
  if (!enabled) return [];
  await configureNotificationCategories();
  const [morning, night] = await Promise.all([
    Notifications.scheduleNotificationAsync({
      content: {
        title: companionName,
        body: 'A gentle morning check-in, whenever you are ready.',
        categoryIdentifier: 'solace-checkin',
        data: { route: '/(tabs)/chat', source: 'notification' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 9, minute: 0 },
    }),
    Notifications.scheduleNotificationAsync({
      content: {
        title: companionName,
        body: 'How was your day? A small reflection is enough.',
        categoryIdentifier: 'solace-checkin',
        data: { route: '/(tabs)/chat', source: 'notification' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 20, minute: 0 },
    }),
  ]);
  return [morning, night];
}

export async function scheduleCustomReminder(title: string, time: string, days: number[]) {
  const enabled = await requestNotifications();
  if (!enabled) return [];
  await configureNotificationCategories();
  const [hour, minute] = time.split(':').map(Number);
  return Promise.all(
    (days.length ? days : [new Date().getDay()]).map((day) =>
      Notifications.scheduleNotificationAsync({
        content: {
          title,
          body: 'A small, caring reminder from your Solace space.',
          categoryIdentifier: 'solace-reminder',
          data: { route: '/settings', source: 'reminder' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: day === 0 ? 1 : day + 1,
          hour,
          minute,
        },
      }),
    ),
  );
}
