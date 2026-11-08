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
  const current = await Notifications.getPermissionsAsync();
  if (current.status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    if (requested.status !== 'granted') return false;
  }
  try {
    const token = await Notifications.getExpoPushTokenAsync();
    await registerDevice(
      token.data,
      Platform.OS === 'android' ? 'android' : Platform.OS === 'ios' ? 'ios' : 'web',
    );
  } catch {
    // Expo Go and development clients without push credentials can still use local reminders.
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
