import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CompanionBlob } from '../companion/CompanionBlob';
import { useTheme } from '../theme';

interface Props {
  onReady: () => void;
  minVisibleMs?: number;
}

export function AnimatedSplashScreen({ onReady, minVisibleMs = 1600 }: Props) {
  const { colors } = useTheme();
  useEffect(() => {
    const timer = setTimeout(onReady, minVisibleMs);
    return () => clearTimeout(timer);
  }, [minVisibleMs, onReady]);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 24 }]}>
      <CompanionBlob size={132} state="idle" />
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Text style={{ color: colors.text, fontFamily: 'Nunito_700Bold', fontSize: 28 }}>Solace</Text>
        <Text style={{ color: colors.muted, fontSize: 16 }}>A gentle place to be heard.</Text>
      </View>
    </View>
  );
}

export function SplashScreenWrapper(props: Props) {
  return <AnimatedSplashScreen {...props} />;
}
