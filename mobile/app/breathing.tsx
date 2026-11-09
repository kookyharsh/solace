import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, GradientBackground } from '../src/components/ui';
import { BreathingExercise } from '../src/components/wellness-exercises';
import { useTheme } from '../src/theme';

export default function Breathing() {
  const t = useTheme();
  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: t.spacing.lg }}
        >
          <View style={{ gap: t.spacing.md }}>
            <BreathingExercise />
            <Button label="Return to chat" variant="outline" onPress={() => router.back()} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}
