import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, ScreenBackground } from '../src/components/ui';
import { useTheme } from '../src/theme';
import { getTodayJournal } from '../src/api';

export default function Today() {
  const t = useTheme();
  const [data, setData] = useState<Awaited<ReturnType<typeof getTodayJournal>>>();
  useEffect(() => {
    getTodayJournal()
      .then(setData)
      .catch(() => setData({ messages: [], summary: null }));
  }, []);
  return (
    <ScreenBackground>
      <SafeAreaView style={{ flex: 1, padding: t.spacing.lg }}>
        <Text
          style={{
            color: t.colors.ink,
            fontSize: t.typography.display,
            fontFamily: 'Nunito_700Bold',
            marginBottom: t.spacing.lg,
          }}
        >
          Today
        </Text>
        {!data ? (
          <ActivityIndicator />
        ) : (
          <FlatList
            data={data.messages}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              data.summary ? (
                <Card style={{ marginBottom: t.spacing.md }}>
                  <Text style={{ color: t.colors.ink, fontFamily: 'Nunito_700Bold' }}>
                    {data.summary}
                  </Text>
                </Card>
              ) : undefined
            }
            ListEmptyComponent={
              <Card>
                <Text style={{ color: t.colors.muted }}>
                  Your day is still unwritten. A small check-in counts.
                </Text>
              </Card>
            }
            renderItem={({ item }) => (
              <Card
                style={{
                  marginBottom: t.spacing.sm,
                  alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '90%',
                }}
              >
                <Text style={{ color: t.colors.ink }}>
                  {item.parts.find((part) => part.type === 'text')?.text ?? ''}
                </Text>
              </Card>
            )}
          />
        )}
      </SafeAreaView>
    </ScreenBackground>
  );
}
