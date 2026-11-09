import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Clock, Check } from 'lucide-react-native';
import { useTheme } from '../theme';
import { haptics } from '../haptics';
import { AnimatedPressable } from './AnimatedPressable';

export type Period = 'AM' | 'PM';

export interface ClockTime {
  hour12: number;
  minute: number;
  period: Period;
}

/** Convert "HH:MM" (24h) to { hour12, minute, period, formatted } */
export function to12Hour(time24 = '08:00'): ClockTime & { formatted: string } {
  const [hStr, mStr] = time24.split(':');
  let h = Number(hStr);
  const m = Number(mStr) || 0;
  if (isNaN(h)) h = 8;
  const period: Period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const minPad = m < 10 ? `0${m}` : `${m}`;
  return {
    hour12,
    minute: m,
    period,
    formatted: `${hour12}:${minPad} ${period}`,
  };
}

/** Convert 12h representation back to "HH:MM" (24h) for backend / database */
export function to24Hour(hour12: number, minute: number, period: Period): string {
  let h = hour12 % 12;
  if (period === 'PM') h += 12;
  const hPad = h < 10 ? `0${h}` : `${h}`;
  const mPad = minute < 10 ? `0${minute}` : `${minute}`;
  return `${hPad}:${mPad}`;
}

export function format12Hour(time24 = '08:00'): string {
  return to12Hour(time24).formatted;
}

export function timeToDate(time24 = '08:00'): Date {
  const [hStr, mStr] = time24.split(':');
  const d = new Date();
  d.setHours(Number(hStr) || 8);
  d.setMinutes(Number(mStr) || 0);
  d.setSeconds(0);
  d.setMilliseconds(0);
  return d;
}

export function dateToTime24(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const hPad = h < 10 ? `0${h}` : `${h}`;
  const mPad = m < 10 ? `0${m}` : `${m}`;
  return `${hPad}:${mPad}`;
}

/**
 * Open native system time selector (Android Material TimePickerDialog or iOS modal).
 */
export function openNativeTimePicker({
  value,
  onChange,
  onDismiss,
}: {
  value: string;
  onChange: (time24: string) => void;
  onDismiss?: () => void;
}) {
  void haptics.tap();
  const initialDate = timeToDate(value);

  if (Platform.OS === 'android') {
    try {
      DateTimePickerAndroid.open({
        value: initialDate,
        mode: 'time',
        is24Hour: false,
        onChange: (event: DateTimePickerEvent, selectedDate?: Date) => {
          if (event.type === 'set' && selectedDate) {
            void haptics.tap();
            onChange(dateToTime24(selectedDate));
          } else if (event.type === 'dismissed') {
            onDismiss?.();
          }
        },
      });
      return true;
    } catch (e) {
      console.warn('Native DateTimePickerAndroid unavailable:', e);
      return false;
    }
  }

  return false;
}

/**
 * Native-first time picker component.
 * Displays formatted 12-hour time and opens the native system time selector.
 */
export function ClockTimePicker({
  value,
  onChange,
  onConfirm,
  confirmLabel = 'Done',
}: {
  value: string; // "HH:MM"
  onChange: (time24: string) => void;
  onConfirm?: (time24: string) => void;
  confirmLabel?: string;
}) {
  const t = useTheme();
  const formatted = format12Hour(value);
  const [iosModalVisible, setIosModalVisible] = useState(false);
  const [fallbackModalVisible, setFallbackModalVisible] = useState(false);
  const [tempDate, setTempDate] = useState(() => timeToDate(value));

  const handleOpenPicker = () => {
    void haptics.tap();
    if (Platform.OS === 'android') {
      const opened = openNativeTimePicker({
        value,
        onChange,
      });
      if (!opened) {
        setFallbackModalVisible(true);
      }
    } else if (Platform.OS === 'ios') {
      setTempDate(timeToDate(value));
      setIosModalVisible(true);
    } else {
      setFallbackModalVisible(true);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
      <Text style={[styles.labelHint, { color: t.colors.muted }]}>Selected time</Text>

      {/* Prominent 12-hour time display button */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Choose time, currently ${formatted}`}
        onPress={handleOpenPicker}
        style={[styles.timeCard, { backgroundColor: t.colors.background, borderColor: t.colors.border }]}
      >
        <Clock size={24} color={t.colors.primary} />
        <Text style={[styles.timeCardText, { color: t.colors.ink }]}>{formatted}</Text>
        <View style={[styles.changeBadge, { backgroundColor: t.colors.primary }]}>
          <Text style={[styles.changeBadgeText, { color: t.colors.onPrimary }]}>Change</Text>
        </View>
      </Pressable>

      <Text style={[styles.tapNote, { color: t.colors.muted }]}>
        Tap to open the system clock
      </Text>

      {/* iOS Native Modal */}
      {Platform.OS === 'ios' && (
        <Modal visible={iosModalVisible} transparent animationType="slide" onRequestClose={() => setIosModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.iosModalCard, { backgroundColor: t.colors.surface }]}>
              <View style={styles.iosModalHeader}>
                <Pressable onPress={() => setIosModalVisible(false)}>
                  <Text style={{ color: t.colors.muted, fontSize: 16 }}>Cancel</Text>
                </Pressable>
                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 16, color: t.colors.ink }}>Select time</Text>
                <Pressable
                  onPress={() => {
                    onChange(dateToTime24(tempDate));
                    setIosModalVisible(false);
                  }}
                >
                  <Text style={{ color: t.colors.primary, fontFamily: 'Nunito_700Bold', fontSize: 16 }}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="time"
                display="spinner"
                is24Hour={false}
                onChange={(_, d) => d && setTempDate(d)}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Clean fallback stepper modal if native module is unavailable */}
      <FallbackStepperModal
        visible={fallbackModalVisible}
        value={value}
        onClose={() => setFallbackModalVisible(false)}
        onSave={(time) => {
          onChange(time);
          setFallbackModalVisible(false);
        }}
      />

      {/* Confirm Button */}
      {onConfirm && (
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel={confirmLabel}
          onPress={() => onConfirm(value)}
          style={[styles.confirmButton, { backgroundColor: t.colors.primary }]}
        >
          <Check size={18} color={t.colors.onPrimary} style={{ marginRight: 6 }} />
          <Text style={[styles.confirmButtonText, { color: t.colors.onPrimary }]}>
            {confirmLabel}
          </Text>
        </AnimatedPressable>
      )}
    </View>
  );
}

/** Tappable button that opens the native time selector directly */
export function TimePickerButton({
  value,
  label,
  onPress,
}: {
  value: string;
  label?: string;
  onPress: () => void;
}) {
  const t = useTheme();
  const formatted = format12Hour(value);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ? `${label}: ${formatted}` : formatted}
      onPress={onPress}
      style={[
        styles.pickerButton,
        {
          backgroundColor: t.colors.background,
          borderColor: t.colors.border,
        },
      ]}
    >
      <Clock size={20} color={t.colors.primary} />
      <Text style={[styles.pickerButtonText, { color: t.colors.ink, flex: 1 }]}>
        {formatted}
      </Text>
      <View style={[styles.openBadge, { backgroundColor: t.colors.primary }]}>
        <Text style={[styles.openBadgeText, { color: t.colors.onPrimary }]}>Change</Text>
      </View>
    </Pressable>
  );
}

/** Modal wrapper for ClockTimePicker (used when native picker needs a modal wrapper) */
export function ClockTimePickerModal({
  visible,
  value,
  title = 'Pick a time',
  onClose,
  onSave,
}: {
  visible: boolean;
  value: string;
  title?: string;
  onClose: () => void;
  onSave: (time24: string) => void;
}) {
  const t = useTheme();
  const [selected, setSelected] = useState(value);

  React.useEffect(() => {
    if (visible) setSelected(value);
  }, [visible, value]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.modalCard, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
          <Text style={[styles.modalTitle, { color: t.colors.ink }]}>{title}</Text>
          <ClockTimePicker
            value={selected}
            onChange={setSelected}
            onConfirm={(time24) => {
              onSave(time24);
              onClose();
            }}
            confirmLabel="Set time"
          />
        </View>
      </View>
    </Modal>
  );
}

/** Clean aligned stepper modal fallback (zero trig alignment issues) */
function FallbackStepperModal({
  visible,
  value,
  onClose,
  onSave,
}: {
  visible: boolean;
  value: string;
  onClose: () => void;
  onSave: (time24: string) => void;
}) {
  const t = useTheme();
  const parsed = to12Hour(value);
  const [hour12, setHour12] = useState(parsed.hour12);
  const [minute, setMinute] = useState(parsed.minute);
  const [period, setPeriod] = useState<Period>(parsed.period);

  React.useEffect(() => {
    if (visible) {
      const p = to12Hour(value);
      setHour12(p.hour12);
      setMinute(p.minute);
      setPeriod(p.period);
    }
  }, [visible, value]);

  if (!visible) return null;

  const incHour = () => setHour12((h) => (h === 12 ? 1 : h + 1));
  const decHour = () => setHour12((h) => (h === 1 ? 12 : h - 1));
  const incMin = () => setMinute((m) => (m + 5 >= 60 ? 0 : m + 5));
  const decMin = () => setMinute((m) => (m - 5 < 0 ? 55 : m - 5));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.modalCard, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
          <Text style={[styles.modalTitle, { color: t.colors.ink }]}>Choose time</Text>

          <View style={styles.stepperRow}>
            {/* Hour Stepper */}
            <View style={styles.stepperCol}>
              <Pressable onPress={incHour} style={styles.arrowBtn}><Text style={styles.arrowText}>▲</Text></Pressable>
              <View style={[styles.stepperDigitBox, { backgroundColor: t.colors.background, borderColor: t.colors.border }]}>
                <Text style={[styles.stepperDigitText, { color: t.colors.ink }]}>{hour12 < 10 ? `0${hour12}` : hour12}</Text>
              </View>
              <Pressable onPress={decHour} style={styles.arrowBtn}><Text style={styles.arrowText}>▼</Text></Pressable>
            </View>

            <Text style={[styles.colonText, { color: t.colors.ink }]}>:</Text>

            {/* Minute Stepper */}
            <View style={styles.stepperCol}>
              <Pressable onPress={incMin} style={styles.arrowBtn}><Text style={styles.arrowText}>▲</Text></Pressable>
              <View style={[styles.stepperDigitBox, { backgroundColor: t.colors.background, borderColor: t.colors.border }]}>
                <Text style={[styles.stepperDigitText, { color: t.colors.ink }]}>{minute < 10 ? `0${minute}` : minute}</Text>
              </View>
              <Pressable onPress={decMin} style={styles.arrowBtn}><Text style={styles.arrowText}>▼</Text></Pressable>
            </View>

            {/* AM/PM toggle */}
            <View style={[styles.amPmContainer, { borderColor: t.colors.border }]}>
              <Pressable
                onPress={() => setPeriod('AM')}
                style={[styles.amPmButton, period === 'AM' && { backgroundColor: t.colors.primary }]}
              >
                <Text style={{ color: period === 'AM' ? t.colors.onPrimary : t.colors.muted, fontFamily: 'Nunito_700Bold' }}>AM</Text>
              </Pressable>
              <Pressable
                onPress={() => setPeriod('PM')}
                style={[styles.amPmButton, period === 'PM' && { backgroundColor: t.colors.primary }]}
              >
                <Text style={{ color: period === 'PM' ? t.colors.onPrimary : t.colors.muted, fontFamily: 'Nunito_700Bold' }}>PM</Text>
              </Pressable>
            </View>
          </View>

          <AnimatedPressable
            accessibilityRole="button"
            onPress={() => onSave(to24Hour(hour12, minute, period))}
            style={[styles.confirmButton, { backgroundColor: t.colors.primary }]}
          >
            <Check size={18} color={t.colors.onPrimary} style={{ marginRight: 6 }} />
            <Text style={[styles.confirmButtonText, { color: t.colors.onPrimary }]}>Set time</Text>
          </AnimatedPressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    gap: 12,
    width: '100%',
  },
  labelHint: {
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
  },
  timeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 18,
    borderWidth: 1,
    width: '100%',
    gap: 12,
  },
  timeCardText: {
    fontSize: 26,
    fontFamily: 'Nunito_700Bold',
    flex: 1,
    textAlign: 'center',
  },
  changeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  changeBadgeText: {
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
  },
  tapNote: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
    marginTop: 6,
    width: '100%',
  },
  confirmButtonText: {
    fontSize: 15,
    fontFamily: 'Nunito_700Bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Nunito_700Bold',
    textAlign: 'center',
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pickerButtonText: {
    fontSize: 17,
    fontFamily: 'Nunito_700Bold',
  },
  openBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  openBadgeText: {
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
  },
  iosModalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 16,
  },
  iosModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  stepperCol: {
    alignItems: 'center',
  },
  stepperDigitBox: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 60,
    alignItems: 'center',
  },
  stepperDigitText: {
    fontSize: 26,
    fontFamily: 'Nunito_700Bold',
  },
  colonText: {
    fontSize: 26,
    fontFamily: 'Nunito_700Bold',
  },
  arrowBtn: {
    padding: 6,
  },
  arrowText: {
    fontSize: 14,
    color: '#888',
  },
  amPmContainer: {
    flexDirection: 'column',
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
    marginLeft: 6,
  },
  amPmButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
});
