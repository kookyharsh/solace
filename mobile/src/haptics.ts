import * as Haptics from 'expo-haptics';
export const haptics = {
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  reward: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
};
