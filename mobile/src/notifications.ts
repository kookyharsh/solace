import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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
  return Notifications.scheduleNotificationAsync({
    content: { title, body, data: { route: '/(tabs)/chat' } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 60 * 60 * 4,
      repeats: true,
    },
  });
}
