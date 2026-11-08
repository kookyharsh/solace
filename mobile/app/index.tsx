import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Text, View } from 'react-native';
import { CompanionBlob } from '../src/companion/CompanionBlob';
import { GradientBackground } from '../src/components/ui';
import { useTheme } from '../src/theme';

export default function Index() {
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  const [splash, setSplash] = useState(true);
  const t = useTheme();
  useEffect(() => {
    AsyncStorage.getItem('solace.onboarding').then((value) => {
      setDone(value === 'done');
      setReady(true);
    });
    const timer = setTimeout(() => setSplash(false), 1200);
    return () => clearTimeout(timer);
  }, []);
  if (splash)
    return (
      <GradientBackground>
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing.lg }}
        >
          <CompanionBlob size={132} state="idle" />
          <Text
            style={{
              color: t.colors.ink,
              fontFamily: 'Nunito_700Bold',
              fontSize: t.typography.display,
            }}
          >
            Solace
          </Text>
          <Text style={{ color: t.colors.muted, fontSize: t.typography.body }}>
            A gentle place to be heard.
          </Text>
        </View>
      </GradientBackground>
    );
  if (!ready)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  return <Redirect href={done ? '/(tabs)/chat' : '/onboarding'} />;
}
