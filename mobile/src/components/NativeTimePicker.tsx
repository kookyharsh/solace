import { useEffect, useState } from 'react';
import { Alert, Modal, Platform, Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { format12Hour } from './ClockTimePicker';

function asDate(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

function asTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function NativeTimePicker({ value, label, onConfirm }: {
  value: string;
  label: string;
  onConfirm: (value: string) => void;
}) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState(() => asDate(value));
  const [Picker, setPicker] = useState<typeof import('@expo/ui/community/datetime-picker').default | null>(null);
  useEffect(() => { if (!visible) setSelected(asDate(value)); }, [value, visible]);
  const picker = visible && Picker ? (
    <Picker
      value={selected}
      mode="time"
      display="default"
      is24Hour={false}
      accentColor={colors.accent}
      positiveButton={{ label: 'Confirm' }}
      themeVariant={colors.bg === '#101012' ? 'dark' : 'light'}
      onDismiss={() => setVisible(false)}
      onValueChange={(_, date) => {
        setSelected(date);
        if (Platform.OS === 'android') { setVisible(false); onConfirm(asTime(date)); }
      }}
    />
  ) : null;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${format12Hour(value)}`}
        onPress={() => {
          void import('@expo/ui/community/datetime-picker')
            .then((module) => { setPicker(() => module.default); setVisible(true); })
            .catch(() => Alert.alert('Native picker unavailable', 'Rebuild the development client to use the time picker.'));
        }}
        style={({ pressed }) => ({ backgroundColor: colors.input, borderRadius: 12, minHeight: 48, alignSelf: 'stretch', justifyContent: 'center', paddingHorizontal: 16, opacity: pressed ? 0.6 : 1 })}
      >
        <Text style={{ color: colors.text, fontSize: 16 }}>{format12Hour(value)} · Choose time</Text>
      </Pressable>
      {visible && (Platform.OS === 'android' ? picker : (
        <Modal visible transparent animationType="none" onRequestClose={() => setVisible(false)}>
          <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#0008' }}>
            <View style={{ backgroundColor: colors.bg, borderRadius: 12, padding: 20, gap: 16 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{label}</Text>
              {picker}
              <Pressable onPress={() => { setVisible(false); onConfirm(asTime(selected)); }} style={{ backgroundColor: colors.accent, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.onAccent, fontSize: 16, fontWeight: '700' }}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ))}
    </>
  );
}
