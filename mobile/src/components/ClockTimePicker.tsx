import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Clock, Check, ChevronUp, ChevronDown } from 'lucide-react-native';
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
export function to12Hour(time24: string = '08:00'): ClockTime & { formatted: string } {
  const safeTime = typeof time24 === 'string' && time24.includes(':') ? time24 : '08:00';
  const [hStr, mStr] = safeTime.split(':');
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

interface ClockTimePickerProps {
  value: string; // "HH:MM"
  onChange: (time24: string) => void;
  onConfirm?: (time24: string) => void;
  confirmLabel?: string;
}

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

/**
 * Clean, perfectly aligned 12-hour Material-style time picker.
 * Features large digital readouts with step arrows, AM/PM toggle,
 * and a tactile 12-hour / 5-minute number grid that works 100% reliably.
 */
export function ClockTimePicker({
  value,
  onChange,
  onConfirm,
  confirmLabel = 'Done',
}: ClockTimePickerProps) {
  const t = useTheme();
  const parsed = useMemo(() => to12Hour(value), [value]);
  const [mode, setMode] = useState<'hour' | 'minute'>('hour');

  const update = (hour12: number, minute: number, period: Period) => {
    void haptics.tap();
    onChange(to24Hour(hour12, minute, period));
  };

  const handleHourSelect = (h: number) => {
    update(h, parsed.minute, parsed.period);
    // Auto-advance to minute selection after hour pick
    setTimeout(() => setMode('minute'), 200);
  };

  const handleMinuteSelect = (m: number) => {
    update(parsed.hour12, m, parsed.period);
  };

  const handlePeriodToggle = (p: Period) => {
    if (parsed.period !== p) {
      update(parsed.hour12, parsed.minute, p);
    }
  };

  const stepHour = (delta: number) => {
    let next = parsed.hour12 + delta;
    if (next > 12) next = 1;
    if (next < 1) next = 12;
    update(next, parsed.minute, parsed.period);
  };

  const stepMinute = (delta: number) => {
    let next = parsed.minute + delta;
    if (next >= 60) next = 0;
    if (next < 0) next = 55;
    update(parsed.hour12, next, parsed.period);
  };

  return (
    <View style={[styles.container, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
      {/* 12-Hour Digital Display + Steppers + AM/PM Toggle */}
      <View style={styles.headerRow}>
        {/* Hour Box */}
        <View style={styles.stepperCol}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Increase hour"
            onPress={() => stepHour(1)}
            style={styles.arrowBtn}
          >
            <ChevronUp size={20} color={t.colors.muted} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Select hours"
            onPress={() => setMode('hour')}
            style={[
              styles.timeDigitBox,
              {
                backgroundColor: mode === 'hour' ? t.colors.primary : t.colors.background,
                borderColor: mode === 'hour' ? t.colors.primary : t.colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.timeDigitText,
                { color: mode === 'hour' ? t.colors.onPrimary : t.colors.ink },
              ]}
            >
              {parsed.hour12 < 10 ? `0${parsed.hour12}` : parsed.hour12}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decrease hour"
            onPress={() => stepHour(-1)}
            style={styles.arrowBtn}
          >
            <ChevronDown size={20} color={t.colors.muted} />
          </Pressable>
        </View>

        <Text style={[styles.colonText, { color: t.colors.ink }]}>:</Text>

        {/* Minute Box */}
        <View style={styles.stepperCol}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Increase minute"
            onPress={() => stepMinute(5)}
            style={styles.arrowBtn}
          >
            <ChevronUp size={20} color={t.colors.muted} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Select minutes"
            onPress={() => setMode('minute')}
            style={[
              styles.timeDigitBox,
              {
                backgroundColor: mode === 'minute' ? t.colors.primary : t.colors.background,
                borderColor: mode === 'minute' ? t.colors.primary : t.colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.timeDigitText,
                { color: mode === 'minute' ? t.colors.onPrimary : t.colors.ink },
              ]}
            >
              {parsed.minute < 10 ? `0${parsed.minute}` : parsed.minute}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decrease minute"
            onPress={() => stepMinute(-5)}
            style={styles.arrowBtn}
          >
            <ChevronDown size={20} color={t.colors.muted} />
          </Pressable>
        </View>

        {/* AM / PM Segment */}
        <View style={[styles.amPmContainer, { borderColor: t.colors.border, backgroundColor: t.colors.background }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Set to AM"
            onPress={() => handlePeriodToggle('AM')}
            style={[
              styles.amPmButton,
              parsed.period === 'AM' && { backgroundColor: t.colors.primary },
            ]}
          >
            <Text
              style={[
                styles.amPmText,
                { color: parsed.period === 'AM' ? t.colors.onPrimary : t.colors.muted },
              ]}
            >
              AM
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Set to PM"
            onPress={() => handlePeriodToggle('PM')}
            style={[
              styles.amPmButton,
              parsed.period === 'PM' && { backgroundColor: t.colors.primary },
            ]}
          >
            <Text
              style={[
                styles.amPmText,
                { color: parsed.period === 'PM' ? t.colors.onPrimary : t.colors.muted },
              ]}
            >
              PM
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Mode Switcher Tabs */}
      <View style={styles.modeTabsRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setMode('hour')}
          style={[
            styles.modeTab,
            mode === 'hour' && { borderBottomColor: t.colors.primary, borderBottomWidth: 2 },
          ]}
        >
          <Text
            style={[
              styles.modeTabText,
              { color: mode === 'hour' ? t.colors.primary : t.colors.muted },
            ]}
          >
            Hour (1–12)
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setMode('minute')}
          style={[
            styles.modeTab,
            mode === 'minute' && { borderBottomColor: t.colors.primary, borderBottomWidth: 2 },
          ]}
        >
          <Text
            style={[
              styles.modeTabText,
              { color: mode === 'minute' ? t.colors.primary : t.colors.muted },
            ]}
          >
            Minute (:00–:55)
          </Text>
        </Pressable>
      </View>

      {/* Grid of numbers — perfectly aligned across all screen densities */}
      <View style={[styles.gridContainer, { backgroundColor: t.colors.background, borderColor: t.colors.border }]}>
        {mode === 'hour' ? (
          HOURS.map((h) => {
            const isSelected = parsed.hour12 === h;
            return (
              <Pressable
                key={h}
                accessibilityRole="button"
                accessibilityLabel={`${h} o'clock`}
                onPress={() => handleHourSelect(h)}
                style={[
                  styles.gridItem,
                  {
                    backgroundColor: isSelected ? t.colors.primary : t.colors.surface,
                    borderColor: isSelected ? t.colors.primary : t.colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.gridItemText,
                    {
                      color: isSelected ? t.colors.onPrimary : t.colors.ink,
                      fontFamily: isSelected ? 'Nunito_700Bold' : 'Inter_400Regular',
                    },
                  ]}
                >
                  {h}
                </Text>
              </Pressable>
            );
          })
        ) : (
          MINUTES.map((m) => {
            const isSelected = parsed.minute === m;
            return (
              <Pressable
                key={m}
                accessibilityRole="button"
                accessibilityLabel={`${m} minutes`}
                onPress={() => handleMinuteSelect(m)}
                style={[
                  styles.gridItem,
                  {
                    backgroundColor: isSelected ? t.colors.primary : t.colors.surface,
                    borderColor: isSelected ? t.colors.primary : t.colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.gridItemText,
                    {
                      color: isSelected ? t.colors.onPrimary : t.colors.ink,
                      fontFamily: isSelected ? 'Nunito_700Bold' : 'Inter_400Regular',
                    },
                  ]}
                >
                  :{m < 10 ? `0${m}` : m}
                </Text>
              </Pressable>
            );
          })
        )}
      </View>

      {/* Confirm Button */}
      {onConfirm && (
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel={confirmLabel}
          onPress={() => onConfirm(to24Hour(parsed.hour12, parsed.minute, parsed.period))}
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

/** Modal wrapper for ClockTimePicker */
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

/** Tappable button showing clock icon and formatted 12h time */
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

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    gap: 12,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
  },
  stepperCol: {
    alignItems: 'center',
  },
  arrowBtn: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeDigitBox: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeDigitText: {
    fontSize: 28,
    fontFamily: 'Nunito_700Bold',
  },
  colonText: {
    fontSize: 26,
    fontFamily: 'Nunito_700Bold',
    marginHorizontal: -2,
    marginTop: 4,
  },
  amPmContainer: {
    flexDirection: 'column',
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
    marginLeft: 4,
  },
  amPmButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amPmText: {
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
  },
  modeTabsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    gap: 20,
    marginTop: 4,
  },
  modeTab: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  modeTabText: {
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    width: '100%',
  },
  gridItem: {
    width: 62,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridItemText: {
    fontSize: 15,
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
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    padding: 16,
    borderWidth: 1,
    gap: 12,
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
    fontSize: 16,
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
});
