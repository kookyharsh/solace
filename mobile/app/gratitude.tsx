import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ScreenBackground } from '../src/components/ui';
import { GratitudeExercise } from '../src/components/wellness-exercises';
import { useTheme } from '../src/theme';

export default function Gratitude() {
  const t = useTheme();
  return (
    <ScreenBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: t.spacing.lg }}
        >
          <View style={{ gap: t.spacing.md }}>
            <GratitudeExercise />
            <Button label="Return to wellness" variant="outline" onPress={() => router.back()} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}
