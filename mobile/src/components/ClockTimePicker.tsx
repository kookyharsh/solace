import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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

interface ClockTimePickerProps {
  value: string; // "HH:MM"
  onChange: (time24: string) => void;
  onConfirm?: (time24: string) => void;
  confirmLabel?: string;
}

const CLOCK_RADIUS = 96;
const CENTER = 118;
const DIAL_SIZE = 236;

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
    // Smooth auto-advance to minute selection
    setTimeout(() => setMode('minute'), 240);
  };

  const handleMinuteSelect = (m: number) => {
    update(parsed.hour12, m, parsed.period);
  };

  const handlePeriodToggle = (p: Period) => {
    if (parsed.period !== p) {
      update(parsed.hour12, parsed.minute, p);
    }
  };

  // Positions for 12 nodes around dial
  const hourNodes = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minuteNodes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  // Calculate hand angle
  const activeValue = mode === 'hour' ? parsed.hour12 % 12 : Math.round(parsed.minute / 5) % 12;
  const handAngleDeg = activeValue * 30; // 360 / 12

  return (
    <View style={[styles.container, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
      {/* 12-Hour Time Display + AM/PM Toggle */}
      <View style={styles.headerRow}>
        <View style={styles.timeBoxContainer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Select hours"
            onPress={() => setMode('hour')}
            style={[
              styles.timeDigitBox,
              {
                backgroundColor: mode === 'hour' ? t.colors.primary : t.colors.background,
                borderColor: t.colors.border,
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

          <Text style={[styles.colonText, { color: t.colors.ink }]}>:</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Select minutes"
            onPress={() => setMode('minute')}
            style={[
              styles.timeDigitBox,
              {
                backgroundColor: mode === 'minute' ? t.colors.primary : t.colors.background,
                borderColor: t.colors.border,
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
        </View>

        {/* AM / PM Toggle */}
        <View style={[styles.amPmContainer, { borderColor: t.colors.border }]}>
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

      {/* Mode hint */}
      <View style={styles.modeHintRow}>
        <Text style={[styles.modeHintText, { color: t.colors.muted }]}>
          {mode === 'hour' ? 'Tap an hour on the clock' : 'Tap a minute on the clock'}
        </Text>
      </View>

      {/* Radial Clock Face */}
      <View style={[styles.clockDial, { backgroundColor: t.colors.background, borderColor: t.colors.border }]}>
        {/* Center dot */}
        <View style={[styles.clockCenter, { backgroundColor: t.colors.primary }]} />

        {/* Clock hand line */}
        <View
          style={[
            styles.clockHand,
            {
              backgroundColor: t.colors.primary,
              transform: [
                { translateX: 0 },
                { translateY: -CLOCK_RADIUS / 2 },
                { rotate: `${handAngleDeg}deg` },
              ],
            },
          ]}
        />

        {/* Circular number nodes */}
        {(mode === 'hour' ? hourNodes : minuteNodes).map((val, idx) => {
          const angleRad = (idx * 30 - 90) * (Math.PI / 180);
          const x = CENTER + CLOCK_RADIUS * Math.cos(angleRad) - 18;
          const y = CENTER + CLOCK_RADIUS * Math.sin(angleRad) - 18;
          const isSelected = mode === 'hour' ? parsed.hour12 === val : parsed.minute === val;

          return (
            <Pressable
              key={val}
              accessibilityRole="button"
              accessibilityLabel={`${val} ${mode}`}
              onPress={() => (mode === 'hour' ? handleHourSelect(val) : handleMinuteSelect(val))}
              style={[
                styles.clockNode,
                {
                  left: x,
                  top: y,
                  backgroundColor: isSelected ? t.colors.primary : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  styles.clockNodeText,
                  {
                    color: isSelected ? t.colors.onPrimary : t.colors.ink,
                    fontFamily: isSelected ? 'Nunito_700Bold' : 'Inter_400Regular',
                  },
                ]}
              >
                {mode === 'minute' && val < 10 ? `0${val}` : val}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Quick minute shortcut chips when in minute mode */}
      {mode === 'minute' && (
        <View style={styles.quickMinutesRow}>
          {[0, 15, 30, 45].map((min) => (
            <Pressable
              key={min}
              onPress={() => handleMinuteSelect(min)}
              style={[
                styles.quickChip,
                {
                  backgroundColor: parsed.minute === min ? t.colors.primary : t.colors.surface,
                  borderColor: t.colors.border,
                },
              ]}
            >
              <Text
                style={{
                  color: parsed.minute === min ? t.colors.onPrimary : t.colors.ink,
                  fontSize: 13,
                  fontFamily: 'Nunito_700Bold',
                }}
              >
                :{min < 10 ? `0${min}` : min}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Optional Confirm Button */}
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

  // Sync initial value when opened
  React.useEffect(() => {
    if (visible) setSelected(value);
  }, [visible, value]);

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
      <Clock size={18} color={t.colors.primary} />
      <Text style={[styles.pickerButtonText, { color: t.colors.ink }]}>
        {formatted}
      </Text>
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
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    width: '100%',
  },
  timeBoxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeDigitBox: {
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    fontSize: 28,
    fontFamily: 'Nunito_700Bold',
    paddingHorizontal: 2,
  },
  amPmContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  amPmButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amPmText: {
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
  },
  modeHintRow: {
    marginTop: -4,
  },
  modeHintText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  clockDial: {
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    borderRadius: DIAL_SIZE / 2,
    borderWidth: 1,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockCenter: {
    width: 10,
    height: 10,
    borderRadius: 5,
    zIndex: 3,
  },
  clockHand: {
    position: 'absolute',
    width: 2,
    height: CLOCK_RADIUS,
    top: CENTER,
    left: CENTER - 1,
    transformOrigin: 'top center',
    zIndex: 1,
  },
  clockNode: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  clockNodeText: {
    fontSize: 15,
  },
  quickMinutesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
    marginTop: 8,
    width: '100%',
  },
  confirmButtonText: {
    fontSize: 15,
    fontFamily: 'Nunito_700Bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
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
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pickerButtonText: {
    fontSize: 16,
    fontFamily: 'Nunito_700Bold',
  },
});
