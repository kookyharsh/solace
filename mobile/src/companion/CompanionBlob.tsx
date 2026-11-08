import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { BotEngine } from './engine/engine';
import { SHAPE_BY_ID } from './engine/skins';
import { companionStates, type CompanionState } from './companionStates';
import { colorForMood } from './moodTheme';

export function CompanionBlob({
  size = 96,
  state = 'idle',
  moodScore,
  color,
  frozenAt = 0,
}: {
  size?: number;
  state?: CompanionState;
  moodScore?: number;
  color?: string;
  frozenAt?: number;
}) {
  const engine = useMemo(
    () => new BotEngine(100, companionStates[state], SHAPE_BY_ID.get('cercle')?.radii ?? null),
    [state],
  );
  const [frame, setFrame] = useState(() => engine.sample(frozenAt));
  const last = useRef(state);
  useEffect(() => {
    if (last.current !== state) {
      engine.setState(companionStates[state], frozenAt);
      last.current = state;
    }
    setFrame(engine.sample(frozenAt));
  }, [engine, frozenAt, state]);
  const fill = color ?? colorForMood(moodScore);
  return (
    <View accessible accessibilityLabel="Solace companion" style={{ width: size, height: size }}>
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
    </View>
  );
}
