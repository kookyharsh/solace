import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { haptics } from '../haptics';
import { useTheme } from '../theme';
import { SymbolIcon } from './ui';

export function useConversationReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState<boolean>();
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => setReduceMotion(false));
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => listener.remove();
  }, []);
  return reduceMotion;
}

export function ConversationBackground({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <View style={{ flex: 1, backgroundColor: colors.bg }}>{children}</View>;
}

export function ConversationBubble({ text, role = 'assistant', animate = false, children }: {
  text?: string;
  role?: 'assistant' | 'user';
  animate?: boolean;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const outgoing = role === 'user';
  return (
    <Animated.View
      entering={animate ? FadeIn.duration(150) : undefined}
      style={{
        alignSelf: outgoing ? 'flex-end' : 'flex-start',
        maxWidth: outgoing ? '88%' : '100%',
        backgroundColor: outgoing ? colors.userBubble : 'transparent',
        borderRadius: outgoing ? 16 : 0,
        paddingHorizontal: outgoing ? 16 : 0,
        paddingVertical: outgoing ? 11 : 4,
        gap: 8,
      }}
    >
      {!!text && <Text style={{ color: colors.text, fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24 }}>{text}</Text>}
      {children}
    </Animated.View>
  );
}

export function ThinkingBubble({ reduceMotion }: { reduceMotion: boolean }) {
  const { colors } = useTheme();
  return <Text accessibilityLiveRegion={reduceMotion ? 'none' : 'polite'} style={{ color: colors.muted, fontSize: 13, paddingVertical: 8 }}>typing…</Text>;
}

export function ConversationIconButton({ label, icon, iconNode, disabled, primary, onPress }: {
  label: string;
  icon?: string;
  iconNode?: ReactNode;
  disabled?: boolean;
  primary?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => { void haptics.tap(); onPress(); }}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: primary ? colors.accent : 'transparent',
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
      })}
    >
      {iconNode ?? <SymbolIcon name={icon ?? 'menu'} size={20} color={primary ? colors.onAccent : colors.text} />}
    </Pressable>
  );
}

export function FlatButton({ children, onPress, variant = 'primary', isDisabled, accessibilityState, size }: {
  children: ReactNode;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'ghost';
  isDisabled?: boolean;
  accessibilityState?: { selected?: boolean };
  size?: 'sm';
}) {
  const { colors } = useTheme();
  const selected = !!accessibilityState?.selected;
  const chip = variant !== 'primary' || selected;
  return <Pressable
    accessibilityRole="button"
    accessibilityState={{ selected, disabled: !!isDisabled }}
    disabled={isDisabled}
    onPress={() => { void haptics.tap(); onPress(); }}
    style={({ pressed }) => ({
      alignSelf: chip ? 'flex-start' : 'stretch',
      minHeight: chip ? size === 'sm' ? 36 : 40 : 48,
      paddingHorizontal: 16,
      paddingVertical: chip ? 8 : 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: chip ? 999 : 12,
      borderWidth: chip ? 1 : 0,
      borderColor: selected ? colors.accent : colors.divider,
      backgroundColor: chip ? 'transparent' : colors.accent,
      opacity: isDisabled ? 0.4 : pressed ? 0.6 : 1,
    })}
  ><Text style={{ color: chip ? selected ? colors.accent : colors.text : colors.onAccent, fontSize: 16, fontFamily: 'Inter_400Regular' }}>{children}</Text></Pressable>;
}

export function FlatInput({ containerClassName, style, ...props }: TextInputProps & { containerClassName?: string }) {
  const { colors } = useTheme();
  return <TextInput
    {...props}
    placeholderTextColor={colors.muted}
    style={[{ flex: containerClassName === 'flex-1' ? 1 : undefined, minHeight: 48, borderRadius: 12, backgroundColor: colors.input, color: colors.text, paddingHorizontal: 16, fontSize: 16 }, style]}
  />;
}
