import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Card, GradientBackground } from '../../src/components/ui';
import { useTheme } from '../../src/theme';
export default function Chat() {
  const t = useTheme();
  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1, padding: t.spacing.lg }}>
        <View style={{ alignItems: 'center', gap: t.spacing.md, marginTop: t.spacing.xl }}>
          <Avatar size={96} />
          <Text
            style={{
              color: t.colors.ink,
              fontSize: t.typography.display,
              fontFamily: 'Nunito_700Bold',
            }}
          >
            Solace
          </Text>
        </View>
        <Card style={{ marginTop: t.spacing.xxl }}>
          <Text
            style={{
              color: t.colors.ink,
              fontSize: t.typography.body,
              fontFamily: 'Inter_400Regular',
            }}
          >
            A gentle place to be heard.
          </Text>
          <Text
            style={{ color: t.colors.muted, marginTop: t.spacing.sm, fontSize: t.typography.body }}
          >
            Chat arrives in Phase 2.
          </Text>
        </Card>
        {__DEV__ && (
          <Link href="/showcase" style={{ color: t.colors.primary, marginTop: t.spacing.lg }}>
            View components
          </Link>
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}
