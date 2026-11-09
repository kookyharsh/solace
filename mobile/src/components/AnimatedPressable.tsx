/**
 * AnimatedPressable
 *
 * Shared press feedback: opacity only, with a light haptic on tap.
 */
import { type ReactNode } from 'react';
import {
  type GestureResponderEvent,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { haptics } from '../haptics';


export interface AnimatedPressableProps extends Omit<PressableProps, 'style' | 'children'> {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Kept for callers that still pass the old prop; scale is intentionally disabled. */
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
  void pressedScale;
  const handlePressIn = (event: GestureResponderEvent) => {
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    onPressOut?.(event);
  };

  const handlePress = (event: GestureResponderEvent) => {
    if (disabled) return;
    if (!noHaptics) void haptics.tap();
    onPress?.(event);
  };

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ ...accessibilityState, disabled: !!disabled }}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={({ pressed }) => [style, { opacity: pressed ? 0.6 : 1 }]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}
