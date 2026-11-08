import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getConversations } from '../src/api';
import { Card, GradientBackground } from '../src/components/ui';
import { useTheme } from '../src/theme';

export default function History() {
  const t = useTheme();
  const [items, setItems] = useState<
    Array<{ id: string; title: string | null; updatedAt: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getConversations()
      .then(setItems)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);
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
          Chat history
        </Text>
        {loading ? (
          <ActivityIndicator />
        ) : items.length === 0 ? (
          <Card>
            <Text style={{ color: t.colors.muted }}>Your conversations will appear here.</Text>
          </Card>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: t.spacing.md }}
            renderItem={({ item }) => (
              <Pressable onPress={() => router.replace('/(tabs)/chat')}>
                <Card>
                  <Text
                    style={{
                      color: t.colors.ink,
                      fontSize: t.typography.body,
                      fontFamily: 'Nunito_700Bold',
                    }}
                  >
                    {item.title ?? 'A quiet conversation'}
                  </Text>
                  <Text style={{ color: t.colors.muted, marginTop: t.spacing.sm }}>
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </Text>
                </Card>
              </Pressable>
            )}
          />
        )}
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={{ color: t.colors.primary, textAlign: 'center' }}>Back to chat</Text>
        </Pressable>
      </SafeAreaView>
    </GradientBackground>
  );
}
