import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewProps,
} from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { haptics } from '../haptics';
import { useTheme } from '../theme';
import { CompanionBlob } from '../companion/CompanionBlob';
import { AnimatedPressable } from './AnimatedPressable';

export function Button({
  label,
  onPress,
  disabled = false,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive';
}) {
  const t = useTheme();
  const isDestructive = variant === 'destructive';
  const backgroundColor = disabled ? t.colors.input : variant === 'primary' ? t.colors.primary : 'transparent';
  const color = disabled ? t.colors.muted : variant === 'primary' ? t.colors.onPrimary : isDestructive ? t.colors.ink : t.colors.primary;
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      noHaptics={false}
      style={{
        backgroundColor,
        borderRadius: 12,
        height: 48,
        justifyContent: 'center',
        paddingHorizontal: t.spacing.md,
        alignItems: 'center',
        borderWidth: 0,
      }}
    >
      <Text
        style={{
          color,
          fontSize: t.typography.body,
          fontFamily: 'Nunito_700Bold',
        }}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}
export function Chip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      pressedScale={0.94}
      style={{
        borderRadius: t.radii.pill,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: selected ? t.colors.primary : t.colors.divider,
        paddingHorizontal: t.spacing.md,
        paddingVertical: t.spacing.sm,
      }}
    >
      <Text
        style={{
          color: selected ? t.colors.primary : t.colors.ink,
          fontFamily: 'Inter_400Regular',
        }}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}
export function Card({ children, ...props }: ViewProps) {
  const t = useTheme();
  return (
    <View
      {...props}
      style={[
        {
          paddingVertical: 20,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: t.colors.divider,
        },
        props.style,
      ]}
    >
      {children}
    </View>
  );
}
export function ScreenBackground({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      {children}
    </View>
  );
}
export function Avatar({ size = 64 }: { size?: number }) {
  return <CompanionBlob size={size} state="idle" frozenAt={1} />;
}
export function Sheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close sheet"
        onPress={onClose}
        style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: t.colors.surface,
            borderTopLeftRadius: t.radii.lg,
            borderTopRightRadius: t.radii.lg,
            padding: t.spacing.lg,
          }}
        >
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
export function Toast({ message, visible }: { message: string; visible: boolean }) {
  const t = useTheme();
  if (!visible) return null;
  return (
    <View
      accessibilityRole="alert"
      style={{
        position: 'absolute',
        bottom: 80,
        alignSelf: 'center',
        padding: t.spacing.md,
        borderRadius: t.radii.md,
        backgroundColor: t.colors.ink,
      }}
    >
      <Text style={{ color: t.colors.surface }}>{message}</Text>
    </View>
  );
}
export function ProgressBar({ value, height = 4 }: { value: number; height?: number }) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.max(0, Math.min(100, value)) }}
      style={{
        height,
        backgroundColor: t.colors.divider,
        borderRadius: t.radii.pill,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          height: '100%',
          backgroundColor: t.colors.primary,
        }}
      />
    </View>
  );
}
export function Skeleton({ width = 120, height = 16 }: { width?: number; height?: number }) {
  const t = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (reduce) {
      opacity.setValue(0.6);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.8, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [reduce, opacity]);
  return (
    <Animated.View
      accessibilityLabel="Loading"
      style={{ width, height, borderRadius: t.radii.sm, backgroundColor: t.colors.muted, opacity }}
    />
  );
}
export function IconButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        void haptics.tap();
        onPress();
      }}
      style={{ padding: t.spacing.sm, borderRadius: t.radii.pill }}
    >
      <SymbolIcon name={icon} size={22} color={t.colors.ink} />
    </Pressable>
  );
}

export function SymbolIcon({
  name,
  size = 22,
  color,
}: {
  name: string;
  size?: number;
  color: string;
}) {
  const normalized =
    (
      { '◷': 'clock', '☰': 'menu', '🎙': 'mic', '■': 'stop', '↑': 'send', '♡': 'heart' } as Record<
        string,
        string
      >
    )[name] ?? name;
  const stroke = {
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {normalized === 'clock' && (
        <>
          <Circle cx="12" cy="12" r="8.5" fill="none" {...stroke} />
          <Line x1="12" y1="7" x2="12" y2="12" {...stroke} />
          <Line x1="12" y1="12" x2="16" y2="14" {...stroke} />
        </>
      )}
      {normalized === 'menu' && (
        <>
          <Line x1="5" y1="7" x2="19" y2="7" {...stroke} />
          <Line x1="5" y1="12" x2="19" y2="12" {...stroke} />
          <Line x1="5" y1="17" x2="19" y2="17" {...stroke} />
        </>
      )}
      {normalized === 'gear' && (
        <>
          <Circle cx="12" cy="12" r="3" fill="none" {...stroke} />
          <Path
            d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"
            fill="none"
            {...stroke}
          />
          <Circle cx="12" cy="12" r="7" fill="none" {...stroke} />
        </>
      )}
      {normalized === 'mic' && (
        <>
          <Rect x="9" y="4" width="6" height="11" rx="3" fill="none" {...stroke} />
          <Path d="M6 12a6 6 0 0 0 12 0M12 18v3M9 21h6" fill="none" {...stroke} />
        </>
      )}
      {normalized === 'stop' && <Rect x="7" y="7" width="10" height="10" rx="2" fill={color} />}
      {normalized === 'send' && <Path d="M4 12 20 4l-4 16-4-7-8-1Z" fill="none" {...stroke} />}
      {normalized === 'heart' && (
        <Path
          d="M20 8.5c0 5-8 10-8 10S4 13.5 4 8.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 8 2.5Z"
          fill="none"
          {...stroke}
        />
      )}
    </Svg>
  );
}
