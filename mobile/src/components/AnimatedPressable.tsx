/**
 * AnimatedPressable
 *
 * Drop-in replacement for React Native's Pressable that adds a spring
 * scale micro-interaction (0.96 on press-in, back to 1.0 on release).
 * Runs fully on the UI thread via react-native-reanimated worklets.
 * Respects the system "Reduce Motion" setting via reduceMotion prop.
 */
import { type ReactNode, useEffect, useState } from 'react';
import { AccessibilityInfo, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { haptics } from '../haptics';

interface AnimatedPressableProps extends Omit<PressableProps, 'style' | 'children'> {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Override the pressed scale. Default 0.96. */
  pressedScale?: number;
  /** Disable haptic feedback. */
  noHaptics?: boolean;
}

function triggerHaptic() {
  void haptics.tap();
}

export function AnimatedPressable({
  children,
  style,
  onPress,
  disabled,
  pressedScale = 0.96,
  noHaptics = false,
  accessibilityRole,
  accessibilityLabel,
  accessibilityState,
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

  const gesture = Gesture.Tap()
    .onBegin(() => {
      if (!reduceMotion) scale.value = withSpring(pressedScale, { damping: 10, stiffness: 300 });
    })
    .onFinalize((_, success) => {
      scale.value = withSpring(1, { damping: 12, stiffness: 300 });
      if (success && !disabled) {
        if (!noHaptics) runOnJS(triggerHaptic)();
        if (onPress) {
          // Gesture callbacks are worklets on the UI runtime. React callbacks
          // must cross back to JS only after the visual feedback has completed.
          runOnJS(onPress)(undefined as never);
        }
      }
    })
    .enabled(!disabled);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[style, animatedStyle]}
        accessibilityRole={accessibilityRole ?? 'button'}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ ...accessibilityState, disabled: !!disabled }}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
