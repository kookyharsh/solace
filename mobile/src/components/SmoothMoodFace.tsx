import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../theme';

interface SmoothMoodFaceProps {
  /** Continuous mood score from 1.0 (deep frown) to 5.0 (deep smile) */
  score: number;
  size?: number;
  color?: string;
}

export function SmoothMoodFace({ score, size = 100, color }: SmoothMoodFaceProps) {
  const t = useTheme();
  const faceColor = color || t.colors.ink;

  // Clamped and normalized: -1.0 (very low) -> 0.0 (okay) -> +1.0 (great)
  const clampedScore = Math.max(1, Math.min(5, score));
  const norm = (clampedScore - 3) / 2; // -1 to +1

  // Dynamic mouth coordinates based on sketch in user illustration:
  // t = -1 (frown): endpoints droop down (y=72), control point arches up (cy=42)
  // t = 0 (neutral): endpoints and control point are colinear at y=64 (perfect flat line)
  // t = +1 (smile): endpoints elevate (y=56), control point drops deep down (cy=88)
  const x1 = 28;
  const y1 = 64 - norm * 8;
  const x2 = 72;
  const y2 = 64 - norm * 8;
  const cx = 50;
  const cy = 64 + norm * 24;

  const mouthPath = `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;

  // Slight natural eye responsiveness matching the expression
  const eyeRadius = 6.5 + Math.max(0, norm * 0.8);
  const leftEyeY = 38 - Math.max(0, norm * 2);
  const rightEyeY = 38 - Math.max(0, norm * 2);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Left Eye */}
        <Circle cx="34" cy={leftEyeY} r={eyeRadius} fill={faceColor} />
        {/* Right Eye */}
        <Circle cx="66" cy={rightEyeY} r={eyeRadius} fill={faceColor} />
        {/* Dynamic Mouth Path */}
        <Path
          d={mouthPath}
          stroke={faceColor}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}
