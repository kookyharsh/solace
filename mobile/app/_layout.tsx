import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts as useInter, Inter_400Regular } from '@expo-google-fonts/inter';
import { useFonts as useNunito, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { Text, View } from 'react-native';
import { useEffect } from 'react';
import { configureNotificationCategories } from '../src/notifications';

export default function RootLayout() {
  const [inter] = useInter({ Inter_400Regular });
  const [nunito] = useNunito({ Nunito_700Bold });
  useEffect(() => {
    void configureNotificationCategories();
  }, []);
  if (!inter || !nunito)
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Solace</Text>
      </View>
    );
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
