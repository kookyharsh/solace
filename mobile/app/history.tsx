import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteConversation, getConversations } from '../src/api';
import { Card, ScreenBackground } from '../src/components/ui';
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
    <ScreenBackground>
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
              <Card>
                <Pressable
                  onPress={() =>
                    router.replace({
                      pathname: '/(tabs)/chat',
                      params: { conversationId: item.id },
                    })
                  }
                >
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
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    void deleteConversation(item.id).then(() =>
                      setItems((current) => current.filter((entry) => entry.id !== item.id)),
                    )
                  }
                >
                  <Text style={{ color: '#B05A62', marginTop: t.spacing.md }}>Delete</Text>
                </Pressable>
              </Card>
            )}
          />
        )}
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={{ color: t.colors.primary, textAlign: 'center' }}>Back to chat</Text>
        </Pressable>
      </SafeAreaView>
    </ScreenBackground>
  );
}
