import * as Notifications from 'expo-notifications';

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
