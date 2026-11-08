import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem('solace.onboarding').then((value) => {
      setDone(value === 'done');
      setReady(true);
    });
  }, []);
  if (!ready)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  return <Redirect href={done ? '/(tabs)/chat' : '/onboarding'} />;
}
