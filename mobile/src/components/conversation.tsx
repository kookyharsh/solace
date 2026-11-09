import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from 'heroui-native/button';
import { Skeleton } from 'heroui-native/skeleton';
import { useTheme } from '../theme';
import { SymbolIcon } from './ui';

export function useConversationReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState<boolean>();
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (value) => {
        if (active) setReduceMotion(value);
      },
      () => {
        if (active) setReduceMotion(false);
      },
    );
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      listener.remove();
    };
  }, []);
  return reduceMotion;
}

export function ConversationBackground({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <LinearGradient
      colors={[colors.wash, colors.background, colors.background]}
      locations={[0, 0.55, 1]}
      style={{ flex: 1 }}
    >
      {children}
    </LinearGradient>
  );
}

export function ConversationBubble({
  text,
  role = 'assistant',
  animate = false,
  children,
}: {
  text?: string;
  role?: 'assistant' | 'user';
  animate?: boolean;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const outgoing = role === 'user';
  return (
    <Animated.View
      entering={animate ? FadeInDown.duration(200) : undefined}
      style={{
        alignSelf: outgoing ? 'flex-end' : 'flex-start',
        maxWidth: outgoing ? '88%' : '94%',
        borderRadius: 22,
        borderTopLeftRadius: outgoing ? 22 : 6,
        borderTopRightRadius: outgoing ? 6 : 22,
        borderWidth: outgoing ? 0 : 1,
        borderColor: colors.border,
        backgroundColor: outgoing ? colors.accent : colors.surface,
        paddingHorizontal: 16,
        paddingVertical: 11,
        gap: 8,
      }}
    >
      {!!text && (
        <Text
          style={{
            color: colors.ink,
            fontFamily: 'Inter_400Regular',
            fontSize: 16,
            lineHeight: 24,
          }}
        >
          {text}
        </Text>
      )}
      {children}
    </Animated.View>
  );
}

export function ThinkingBubble({ reduceMotion }: { reduceMotion: boolean }) {
  const { colors } = useTheme();
  const variant = reduceMotion ? 'none' : 'shimmer';
  return (
    <ConversationBubble>
      <View
        accessible
        accessibilityLabel="Your companion is typing"
        accessibilityLiveRegion="polite"
        style={{ gap: 8, paddingVertical: 3 }}
      >
        <Skeleton
          variant={variant}
          style={{ width: 116, height: 8, borderRadius: 4, backgroundColor: colors.wash }}
        />
        <Skeleton
          variant={variant}
          style={{ width: 76, height: 8, borderRadius: 4, backgroundColor: colors.wash }}
        />
      </View>
    </ConversationBubble>
  );
}

export function ConversationIconButton({
  label,
  icon,
  iconNode,
  disabled,
  primary,
  onPress,
}: {
  label: string;
  icon?: string;
  iconNode?: ReactNode;
  disabled?: boolean;
  primary?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Button
      isIconOnly
      isDisabled={disabled}
      variant={primary ? 'primary' : 'ghost'}
      accessibilityLabel={label}
      style={{ minWidth: 44, minHeight: 44 }}
      onPress={onPress}
    >
      {iconNode ?? (
        <SymbolIcon
          name={icon ?? 'menu'}
          size={20}
          color={primary ? colors.onPrimary : colors.ink}
        />
      )}
    </Button>
  );
}
