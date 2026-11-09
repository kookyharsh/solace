/**
 * AnimatedPressable
 *
 * Drop-in replacement for React Native's Pressable that adds a spring
 * scale micro-interaction (0.96 on press-in, back to 1.0 on release).
 * Runs smoothly via Reanimated while using React Native's native Pressable
 * to ensure 100% reliable tap handling inside ScrollViews and lists.
 */
import { type ReactNode, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  type GestureResponderEvent,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { haptics } from '../haptics';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

export interface AnimatedPressableProps extends Omit<PressableProps, 'style' | 'children'> {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Override the pressed scale. Default 0.96. */
  pressedScale?: number;
  /** Disable haptic feedback. */
  noHaptics?: boolean;
}

export function AnimatedPressable({
  children,
  style,
  onPress,
  onPressIn,
  onPressOut,
  disabled,
  pressedScale = 0.96,
  noHaptics = false,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityState,
  ...rest
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: disabled ? 0.5 : 1,
  }));

  const handlePressIn = (event: GestureResponderEvent) => {
    if (!reduceMotion && !disabled) {
      scale.value = withSpring(pressedScale, { damping: 12, stiffness: 350 });
    }
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    scale.value = withSpring(1, { damping: 14, stiffness: 350 });
    onPressOut?.(event);
  };

  const handlePress = (event: GestureResponderEvent) => {
    if (disabled) return;
    if (!noHaptics) void haptics.tap();
    onPress?.(event);
  };

  return (
    <AnimatedPressableBase
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ ...accessibilityState, disabled: !!disabled }}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[style, animatedStyle]}
      {...rest}
    >
      {children}
    </AnimatedPressableBase>
  );
}
