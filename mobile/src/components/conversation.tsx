import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from 'heroui-native/button';
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

  if (!outgoing) {
    return (
      <Animated.View
        entering={
          animate
            ? FadeInDown.springify()
                .damping(18)
                .stiffness(140)
                .easing(Easing.out(Easing.cubic))
            : undefined
        }
        style={{
          alignSelf: 'flex-start',
          maxWidth: '96%',
          paddingHorizontal: 4,
          paddingVertical: 4,
          gap: 8,
        }}
      >
        {!!text && (
          <Text
            style={{
              color: colors.ink,
              fontFamily: 'Inter_400Regular',
              fontSize: 16,
              lineHeight: 25,
            }}
          >
            {text}
          </Text>
        )}
        {children}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={
        animate
          ? FadeInDown.springify()
              .damping(18)
              .stiffness(140)
              .easing(Easing.out(Easing.cubic))
          : undefined
      }
      style={{
        alignSelf: 'flex-end',
        maxWidth: '88%',
        borderRadius: 22,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 6,
        backgroundColor: colors.accent,
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

// ── Animated dot-wave thinking indicator ────────────────────────────────────

function ThinkingDot({ delayMs, reduceMotion }: { delayMs: number; reduceMotion: boolean }) {
  const { colors } = useTheme();
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    translateY.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(-5, { duration: 320, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 320, easing: Easing.in(Easing.quad) }),
          // pause at bottom before next cycle
          withTiming(0, { duration: 200 }),
        ),
        -1,
        false,
      ),
    );
    return () => {
      translateY.value = 0;
    };
  }, [delayMs, reduceMotion, translateY]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.muted,
        },
        dotStyle,
      ]}
    />
  );
}

export function ThinkingBubble({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel="Your companion is typing"
      accessibilityLiveRegion="polite"
      style={{
        alignSelf: 'flex-start',
        gap: 6,
        paddingHorizontal: 6,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <ThinkingDot delayMs={0} reduceMotion={reduceMotion} />
      <ThinkingDot delayMs={160} reduceMotion={reduceMotion} />
      <ThinkingDot delayMs={320} reduceMotion={reduceMotion} />
    </View>
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
