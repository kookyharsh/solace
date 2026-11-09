import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { BotEngine } from './engine/engine';
import { EXPRESSION_BY_ID } from './engine/expressions';
import { SHAPE_BY_ID } from './engine/skins';
import { companionStates, type CompanionState } from './companionStates';
import { colorForMood } from './moodTheme';

const body = SHAPE_BY_ID.get('cercle')?.radii ?? null;

export function CompanionBlob({
  size = 96,
  state = 'idle',
  expression,
  moodScore,
  color,
  frozenAt = 0,
}: {
  size?: number;
  state?: CompanionState;
  expression?: string;
  moodScore?: number;
  color?: string;
  frozenAt?: number;
}) {
  const preset = companionStates[state] ?? companionStates.idle;
  const face = EXPRESSION_BY_ID.get(expression ?? '') ?? EXPRESSION_BY_ID.get(preset.face) ?? null;
  const [startedAt] = useState(() => performance.now());
  const [engine] = useState(() => new BotEngine(100, preset.pose, body, face));
  const [frame, setFrame] = useState(() => engine.sample(frozenAt));
  const [reduceMotion, setReduceMotion] = useState<boolean>();
  const moving = reduceMotion === false && frozenAt === 0;
  const bounce = useSharedValue(0);
  const bodyMotion = useAnimatedStyle(() => ({ transform: [{ translateY: bounce.value }] }));

  useEffect(() => {
    if (!moving) {
      setFrame(new BotEngine(100, preset.pose, body, face).sample(frozenAt));
      return;
    }
    const now = (performance.now() - startedAt) / 1000;
    engine.setState(preset.pose, now);
    engine.setExpression(face, now);
    setFrame(engine.sample(now));
  }, [engine, face, frozenAt, moving, preset.pose, startedAt]);

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

  useEffect(() => {
    if (!moving) return;
    const timer = setInterval(
      () => setFrame(engine.sample((performance.now() - startedAt) / 1000)),
      33,
    );
    return () => clearInterval(timer);
  }, [engine, moving, startedAt]);

  useEffect(() => {
    bounce.value = 0;
    if (!moving) return;
    const offset =
      state === 'proud' || state === 'happy' ? -size * 0.08 : state === 'caring' ? size * 0.04 : 0;
    if (offset)
      bounce.value = withSequence(
        withTiming(offset, { duration: 180 }),
        withTiming(0, { duration: 280 }),
      );
  }, [bounce, moving, size, state]);

  const fill = color ?? colorForMood(moodScore);
  return (
    <Animated.View
      accessible
      accessibilityLabel={preset.label}
      style={[{ width: size, height: size }, bodyMotion]}
    >
      <Svg width={size} height={size} viewBox="-120 -120 240 240">
        {frame.dots
          .filter(() => frame.dotsBehind)
          .map((dot, index) => (
            <Circle
              key={`behind-${index}`}
              cx={dot.x}
              cy={dot.y}
              r={dot.r}
              fill={fill}
              opacity={dot.opacity}
            />
          ))}
        <Path d={frame.bodyPath} fill={fill} opacity={frame.bodyAlpha} />
        {frame.eyes.map((eye, index) => (
          <Path key={index} d={eye.d} transform={eye.matrix} fill="#FBF7F2" opacity={eye.alpha} />
        ))}
        {frame.dots
          .filter(() => !frame.dotsBehind)
          .map((dot, index) => (
            <Circle
              key={`front-${index}`}
              cx={dot.x}
              cy={dot.y}
              r={dot.r}
              fill={fill}
              opacity={dot.opacity}
            />
          ))}
        {frame.arcs.map((arc) => (
          <Path
            key={arc.id}
            d={arc.front}
            fill="none"
            stroke={fill}
            strokeWidth={arc.width}
            opacity={arc.opacity}
          />
        ))}
      </Svg>
    </Animated.View>
  );
}
