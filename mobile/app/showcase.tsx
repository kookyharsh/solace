import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Avatar,
  Button,
  Card,
  Chip,
  GradientBackground,
  IconButton,
  ProgressBar,
  Sheet,
  Skeleton,
  Toast,
} from '../src/components/ui';
import { useTheme } from '../src/theme';
export default function Showcase() {
  const t = useTheme();
  const [selected, setSelected] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState(false);
  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md }}>
          <Text
            style={{
              color: t.colors.ink,
              fontSize: t.typography.title,
              fontFamily: 'Nunito_700Bold',
            }}
          >
            Components
          </Text>
          <Card>
            <Avatar />
            <Text style={{ color: t.colors.ink, marginTop: t.spacing.md }}>
              Static avatar placeholder
            </Text>
          </Card>
          <Chip label="A gentle chip" selected={selected} onPress={() => setSelected(!selected)} />
          <Button label="Open sheet" onPress={() => setSheet(true)} />
          <IconButton
            label="Show toast"
            icon="♡"
            onPress={() => {
              setToast(true);
              setTimeout(() => setToast(false), 2500);
            }}
          />
          <ProgressBar value={65} />
          <Skeleton />
          <View style={{ height: t.spacing.xxl }} />
        </ScrollView>
        <Sheet visible={sheet} onClose={() => setSheet(false)}>
          <Text style={{ color: t.colors.ink, fontSize: t.typography.body }}>
            A calm bottom sheet.
          </Text>
          <Button label="Close" onPress={() => setSheet(false)} />
        </Sheet>
        <Toast visible={toast} message="A little moment of calm" />
      </SafeAreaView>
    </GradientBackground>
  );
}
