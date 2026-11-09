import { Tabs } from 'expo-router';
import { HeartPulse, MessageCircle } from 'lucide-react-native';
import { useTheme } from '../../src/theme';
export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.colors.primary,
        tabBarInactiveTintColor: t.colors.muted,
        tabBarStyle: {
          backgroundColor: t.colors.surface,
          borderTopWidth: 1,
          borderTopColor: t.colors.border,
          height: 72,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontFamily: 'Nunito_700Bold', fontSize: 14 },
      }}
    >
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarHideOnKeyboard: true,
          tabBarIcon: ({ color, size }) => (
            <MessageCircle color={color} size={size} strokeWidth={2.2} />
          ),
        }}
      />
      <Tabs.Screen
        name="wellness"
        options={{
          title: 'Wellness',
          tabBarIcon: ({ color, size }) => (
            <HeartPulse color={color} size={size} strokeWidth={2.2} />
          ),
        }}
      />
    </Tabs>
  );
}
