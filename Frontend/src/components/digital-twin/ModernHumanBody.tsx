import { memo, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Circle,
  Defs,
  Ellipse,
  Line,
  LinearGradient,
  Path,
  Pattern,
  Rect,
  Stop,
  Svg,
  type SvgProps,
} from 'react-native-svg';

import { HEALTH_STATUS_COLORS, ORGAN_BASE_COLORS, type OrganHealth } from '@/constants/health';

export type HealthStatus = OrganHealth['status'];
export type OrganKey = keyof typeof organPositions;

type OrganPosition = {
  key: string;
  label: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
};

const organPositions = {
  brain: { key: 'brain', label: 'Brain', cx: 210, cy: 74, rx: 22, ry: 18 },
  heart: { key: 'heart', label: 'Heart', cx: 200, cy: 182, rx: 20, ry: 18 },
  lungs: { key: 'lungs', label: 'Lungs', cx: 200, cy: 150, rx: 42, ry: 30 },
  liver: { key: 'liver', label: 'Liver', cx: 238, cy: 228, rx: 38, ry: 24 },
  kidneys: { key: 'kidneys', label: 'Kidneys', cx: 200, cy: 268, rx: 52, ry: 22 },
  digestive: { key: 'digestive', label: 'Digestive', cx: 200, cy: 336, rx: 42, ry: 26 },
} as const;

function getOrganColor(organs: Record<string, OrganHealth>, key: OrganKey) {
  const organ = organs[key as string];
  if (organ?.color) return organ.color;
  if (organ?.status && organ.status !== 'healthy') {
    return HEALTH_STATUS_COLORS[organ.status];
  }
  return ORGAN_BASE_COLORS[key] ?? HEALTH_STATUS_COLORS.healthy;
}

type Props = {
  organs: Record<string, OrganHealth>;
  scale?: number;
  maxWidth?: number;
  selectedOrgan?: string | null;
  onOrganPress?: (organ: string) => void;
  showLabels?: boolean;
  interactive?: boolean;
} & Omit<SvgProps, 'onPress'>;

function ModernHumanBodyBase({
  organs,
  scale: scaleProp = 1,
  maxWidth,
  selectedOrgan = null,
  onOrganPress,
  showLabels = false,
  interactive = true,
  ...svgProps
}: Props) {
  const { width: windowWidth } = useWindowDimensions();

  // Optimized scale for Android 10+ and iOS, covering common screen sizes
  const effectiveScale = useMemo(() => {
    let responsiveCap = 0.85; // Perfect for 6.43-6.89 inch displays
    if (windowWidth < 360) responsiveCap = 0.66;
    else if (windowWidth < 420) responsiveCap = 0.85; // Target range optimized
    else if (windowWidth < 520) responsiveCap = 0.9;
    else responsiveCap = 1;

    const base = Math.min(scaleProp, responsiveCap);
    if (maxWidth != null && maxWidth > 0) {
      const maxScale = (maxWidth - 16) / 420;
      return Math.min(base, maxScale);
    }
    return base;
  }, [scaleProp, maxWidth, windowWidth]);

  const size = 420 * effectiveScale;
  const height = 560 * effectiveScale;
  const tapBoost = effectiveScale < 0.7 ? 1.45 : 1;

  const makeOrgan = (position: OrganPosition) => {
    const organ = organs[position.key as string];
    const color = getOrganColor(organs, position.key as OrganKey);
    const selected = selectedOrgan === position.key;
    const status = organ?.status ?? 'healthy';

    return (
      <>
        <Ellipse
          key={`${position.key}-glow`}
          cx={position.cx}
          cy={position.cy}
          rx={position.rx + 8}
          ry={position.ry + 8}
          fill={color}
          opacity={selected ? 0.35 : 0.2}
        />
        <Ellipse
          key={`${position.key}-organ`}
          cx={position.cx}
          cy={position.cy}
          rx={position.rx}
          ry={position.ry}
          fill={color}
          opacity={0.95}
          stroke={selected ? '#FFFFFF' : color}
          strokeWidth={selected ? 3 : 1}
        />
        {(status === 'warning' || status === 'critical') && (
          <Circle
            key={`${position.key}-alert`}
            cx={position.cx + position.rx - 4}
            cy={position.cy - position.ry + 4}
            r={5}
            fill={HEALTH_STATUS_COLORS[status]}
            stroke="#FFFFFF"
            strokeWidth={1.5}
          />
        )}
      </>
    );
  };

  return (
    <View style={[styles.container, maxWidth != null && styles.containerResponsive, { maxWidth }]}>
      <Svg width={size} height={height} viewBox="0 0 420 560" style={[styles.svg, svgProps.style]} {...svgProps}>
        <Defs>
          <LinearGradient id="modernBodyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#F8FAFC" stopOpacity="0.95" />
            <Stop offset="50%" stopColor="#F1F5F9" stopOpacity="0.9" />
            <Stop offset="100%" stopColor="#E2E8F0" stopOpacity="0.88" />
          </LinearGradient>

          <Pattern id="subtleGrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <Path d="M 20 0 L 0 0 0 20" fill="none" stroke="#CBD5E1" strokeWidth="0.4" opacity="0.35" />
          </Pattern>

          <LinearGradient id="accentGlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#3B82F6" stopOpacity="0.12" />
            <Stop offset="50%" stopColor="#60A5FA" stopOpacity="0.38" />
            <Stop offset="100%" stopColor="#3B82F6" stopOpacity="0.12" />
          </LinearGradient>

          <LinearGradient id="warmAccent" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#EF4444" stopOpacity="0.1" />
            <Stop offset="100%" stopColor="#F97316" stopOpacity="0.15" />
          </LinearGradient>
        </Defs>

        {/* Warm accent glow behind body */}
        <Ellipse cx={210} cy={280} rx={140} ry={200} fill="url(#warmAccent)" opacity={0.4} />

        {/* Platform */}
        <Ellipse cx={210} cy={500} rx={130} ry={26} fill="url(#accentGlow)" opacity={0.6} />
        <Ellipse cx={210} cy={500} rx={110} ry={20} fill="none" stroke="#3B82F6" strokeWidth={1.4} opacity={0.45} />
        <Ellipse cx={210} cy={500} rx={80} ry={12} fill="none" stroke="#60A5FA" strokeWidth={1} opacity={0.3} />

        {/* Head */}
        <Path
          d="M182 42C182 29, 192 20, 205 20H215C228 20, 238 29, 238 42V88C238 101, 228 110, 215 110H205C192 110, 182 101, 182 88Z"
          fill="url(#modernBodyGradient)"
          stroke="#CBD5E1"
          strokeWidth={1.2}
        />
        <Ellipse cx={210} cy={92} rx={56} ry={50} fill="url(#modernBodyGradient)" stroke="#CBD5E1" strokeWidth={1.2} />
        
        {/* Arms */}
        <Path
          d="M164 100C150 118, 136 144, 128 178C123 198, 112 214, 100 228C87 242, 83 262, 91 276C98 289, 113 293, 129 285L154 268C164 260, 170 249, 174 237V100Z"
          fill="url(#modernBodyGradient)"
          stroke="#CBD5E1"
          strokeWidth={1.1}
        />
        <Path
          d="M256 100C270 118, 284 144, 292 178C297 198, 308 214, 320 228C333 242, 337 262, 329 276C322 289, 307 293, 291 285L266 268C256 260, 250 249, 246 237V100Z"
          fill="url(#modernBodyGradient)"
          stroke="#CBD5E1"
          strokeWidth={1.1}
        />
        
        {/* Legs */}
        <Path
          d="M160 120C148 150, 144 188, 147 228C150 268, 146 314, 130 375C124 398, 126 422, 137 440C149 459, 169 466, 186 461L198 458V120Z"
          fill="url(#modernBodyGradient)"
          stroke="#CBD5E1"
          strokeWidth={1.2}
        />
        <Path
          d="M260 120C272 150, 276 188, 273 228C270 268, 274 314, 290 375C296 398, 294 422, 283 440C271 459, 251 466, 234 461L222 458V120Z"
          fill="url(#modernBodyGradient)"
          stroke="#CBD5E1"
          strokeWidth={1.2}
        />
        
        {/* Torso */}
        <Path
          d="M176 110C180 166, 181 196, 181 236C181 280, 176 325, 166 362C159 389, 160 417, 168 440C176 462, 194 475, 210 475C226 475, 244 462, 252 440C260 417, 261 389, 254 362C244 325, 239 280, 239 236C239 196, 240 166, 244 110Z"
          fill="url(#modernBodyGradient)"
          stroke="#CBD5E1"
          strokeWidth={1.2}
        />

        {/* Subtle grid overlay */}
        <Path
          d="M176 110C180 166, 181 196, 181 236C181 280, 176 325, 166 362C159 389, 160 417, 168 440C176 462, 194 475, 210 475C226 475, 244 462, 252 440C260 417, 261 389, 254 362C244 325, 239 280, 239 236C239 196, 240 166, 244 110Z"
          fill="url(#subtleGrid)"
          opacity={0.25}
        />
        
        {/* Center line */}
        <Line x1={210} y1={120} x2={210} y2={444} stroke="#94A3B8" strokeWidth={0.7} strokeDasharray="5 7" opacity={0.3} />

        {/* Organs */}
        {makeOrgan(organPositions.brain)}
        {makeOrgan(organPositions.lungs)}
        {makeOrgan(organPositions.heart)}
        {makeOrgan(organPositions.liver)}
        {makeOrgan(organPositions.kidneys)}
        {makeOrgan(organPositions.digestive)}

        {/* Base platform */}
        <Rect x={154} y={488} width={112} height={44} rx={22} fill="url(#modernBodyGradient)" stroke="#CBD5E1" strokeWidth={1.1} />
      </Svg>

      {interactive &&
        onOrganPress &&
        Object.values(organPositions).map((position) => (
          <Pressable
            key={`hit-${position.key}`}
            accessibilityRole="button"
            accessibilityLabel={`Select ${position.label}`}
            onPress={() => onOrganPress(position.key)}
            hitSlop={effectiveScale < 0.7 ? 14 : 8}
            style={[
              styles.hitTarget,
              {
                left: position.cx - (position.rx + 16) * effectiveScale * tapBoost,
                top: position.cy - (position.ry + 16) * effectiveScale * tapBoost,
                width: (position.rx + 16) * 2 * effectiveScale * tapBoost,
                height: (position.ry + 16) * 2 * effectiveScale * tapBoost,
                borderRadius: (position.rx + 16) * effectiveScale * tapBoost,
              },
            ]}
          />
        ))}

    </View>
  );
}

export const ModernHumanBody = memo(ModernHumanBodyBase);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  containerResponsive: {
    width: '100%',
    alignSelf: 'center',
  },
  svg: {
    pointerEvents: 'none',
  },
  hitTarget: {
    position: 'absolute',
    backgroundColor: 'transparent',
    zIndex: 5,
  },
});