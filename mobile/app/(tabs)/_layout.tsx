import { Tabs } from 'expo-router';
import { useTheme } from '../../src/theme';
export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.colors.primary,
        tabBarInactiveTintColor: t.colors.muted,
        tabBarStyle: { backgroundColor: t.colors.surface, borderTopWidth: 0, height: 68 },
        tabBarLabelStyle: { fontFamily: 'Nunito_700Bold', fontSize: 14 },
      }}
    >
      <Tabs.Screen name="chat" options={{ title: 'Chat', tabBarHideOnKeyboard: true }} />
      <Tabs.Screen name="wellness" options={{ title: 'Wellness' }} />
    </Tabs>
  );
}
