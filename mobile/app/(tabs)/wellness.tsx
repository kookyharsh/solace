import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, GradientBackground } from '../../src/components/ui';
import { CompanionBlob } from '../../src/companion/CompanionBlob';
import { useTheme } from '../../src/theme';
export default function Wellness() {
  const t = useTheme();
  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1, padding: t.spacing.lg, gap: t.spacing.lg }}>
        <Text
          style={{
            color: t.colors.ink,
            fontSize: t.typography.display,
            fontFamily: 'Nunito_700Bold',
          }}
        >
          Wellness
        </Text>
        <Card>
<CompanionBlob />
          <Text
            style={{ color: t.colors.ink, fontSize: t.typography.body, marginTop: t.spacing.md }}
          >
            Your gentle space is taking shape.
          </Text>
        </Card>
      </SafeAreaView>
    </GradientBackground>
  );
}
