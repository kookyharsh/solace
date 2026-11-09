import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { SplashScreenWrapper } from '../src/components/AnimatedSplashScreen';

export default function Index() {
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [animDone, setAnimDone] = useState(false);

  // Load onboarding state concurrently with the splash animation
  useEffect(() => {
    AsyncStorage.getItem('solace.onboarding').then((value) => {
      setOnboardingDone(value === 'done');
    });
  }, []);

  // As soon as the JS root mounts (fonts are ready), hide the native splash.
  // The AnimatedSplashScreen component takes over visually from that moment.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  // Navigate once BOTH the animation has finished AND onboarding state is known
  const handleAnimationReady = useCallback(() => {
    setAnimDone(true);
  }, []);

  useEffect(() => {
    if (animDone && onboardingDone !== null) {
      router.replace(onboardingDone ? '/(tabs)/chat' : '/onboarding');
    }
  }, [animDone, onboardingDone]);

  return <SplashScreenWrapper onReady={handleAnimationReady} />;
}
