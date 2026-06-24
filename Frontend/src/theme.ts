import { Platform } from 'react-native';

/**
 * Design tokens for MyHealthtwin.
 *
 * The palette stays close to the medical-blue language the app already uses,
 * but the tokens below layer in an iOS-grade structure: a SF-style type scale,
 * grouped-background / fill / separator colors (like iOS Settings), spring
 * presets, and multi-layer shadows. Every pre-existing export (`colors`,
 * `spacing`, `radius`, `shadows`) is preserved so existing screens keep working.
 */

export const colors = {
  background: '#EEF6FF',
  backgroundAlt: '#DCEBFF',
  backgroundElement: '#F8FBFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F5FAFF',
  surfaceElevated: '#FFFFFF',
  border: '#CFE0F5',
  borderStrong: '#AFC8E5',
  primary: '#1D5EFF',
  primaryDark: '#0E46D2',
  accent: '#56A6FF',
  accentSoft: '#D7EBFF',
  text: '#0D1B2A',
  textStrong: '#04101F',
  muted: '#5C708A',
  faint: '#8DA4BF',
  danger: '#D92D20',
  warning: '#FF845C',
  success: '#71EEA2',
  inputBg: '#F8FBFF',
  shadow: 'rgba(14, 70, 210, 0.12)',
  shadowStrong: 'rgba(14, 70, 210, 0.18)',

  // ── iOS-grade structural colors ────────────────────────────────────────────
  // Grouped background sits behind grouped table sections (iOS Settings style).
  groupedBackground: '#F2F6FB',
  groupedSecondary: '#FFFFFF',
  // Hairline separators tuned for both light mode screens and the blue wash.
  separator: 'rgba(60, 80, 110, 0.12)',
  separatorOpaque: '#E2EAF4',
  // System "fill" colors used behind tappable rows / selected chips.
  fill: 'rgba(120, 144, 180, 0.10)',
  fillStrong: 'rgba(120, 144, 180, 0.18)',
  // Blue accent used for links / progress / selection, matches iOS system blue.
  systemBlue: '#0A84FF',
  systemGreen: '#34C759',
  systemRed: '#FF3B30',
  systemOrange: '#FF9500',
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
};

export const radius = {
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
};

export const shadows = {
  card: Platform.select({
    web: {
      boxShadow: '0 10px 22px rgba(14, 70, 210, 0.12)',
    },
    default: {
      shadowColor: colors.primaryDark,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 22,
      elevation: 8,
    },
  }),
  glow: Platform.select({
    web: {
      boxShadow: '0 0 18px rgba(86, 166, 255, 0.35)',
    },
    default: {
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 18,
      elevation: 4,
    },
  }),
} as const;

/**
 * SF-inspired type scale. Weights and sizes mirror the iOS Human Interface
 * Guidelines scale (largeTitle → caption). Sizes stay in pt/px so they render
 * consistently on web and Android too; the typeface falls back to the system
 * rounded/sans stack via the constants/theme Fonts token on web.
 */
export const typography = {
  largeTitle: { fontSize: 34, fontWeight: '800' as const, lineHeight: 41, letterSpacing: 0.37 },
  title1: { fontSize: 28, fontWeight: '800' as const, lineHeight: 34, letterSpacing: 0.36 },
  title2: { fontSize: 22, fontWeight: '800' as const, lineHeight: 28, letterSpacing: 0.35 },
  title3: { fontSize: 20, fontWeight: '700' as const, lineHeight: 25, letterSpacing: 0.38 },
  headline: { fontSize: 17, fontWeight: '700' as const, lineHeight: 22, letterSpacing: -0.4 },
  body: { fontSize: 17, fontWeight: '400' as const, lineHeight: 22, letterSpacing: -0.4 },
  callout: { fontSize: 16, fontWeight: '600' as const, lineHeight: 21, letterSpacing: -0.2 },
  subheadline: { fontSize: 15, fontWeight: '400' as const, lineHeight: 20, letterSpacing: -0.2 },
  footnote: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18, letterSpacing: -0.08 },
  caption: { fontSize: 12, fontWeight: '600' as const, lineHeight: 16, letterSpacing: 0.08 },
  caption2: { fontSize: 11, fontWeight: '600' as const, lineHeight: 13, letterSpacing: 0.06 },
} as const;

/**
 * Spring configs tuned to feel native. `smooth` is the default "iOS settle"
 * curve; `gentle` is for ambient/idle motion; `snappy` is for taps / chips;
 * `bouncy` is reserved for playful emphasis (rare).
 */
export const springs = {
  smooth: { stiffness: 280, damping: 26, mass: 0.9 },
  gentle: { stiffness: 120, damping: 20, mass: 1 },
  snappy: { stiffness: 520, damping: 34, mass: 0.8 },
  bouncy: { stiffness: 320, damping: 14, mass: 0.85 },
} as const;

/**
 * Multi-layer iOS shadows. iOS uses two stacked shadows per surface (a tight
 * contact shadow + a soft ambient shadow). The web strings emulate this.
 */
export const iosShadows = {
  // Subtle raised surface (list rows, pills, inputs when focused).
  sm: Platform.select({
    web: { boxShadow: '0 1px 2px rgba(15, 35, 80, 0.06), 0 1px 1px rgba(15, 35, 80, 0.04)' },
    default: {
      shadowColor: '#0F2350',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 1,
    },
  }),
  // Cards and sheets.
  md: Platform.select({
    web: {
      boxShadow:
        '0 1px 1px rgba(15, 35, 80, 0.04), 0 8px 20px rgba(15, 35, 80, 0.08), 0 2px 6px rgba(14, 70, 210, 0.06)',
    },
    default: {
      shadowColor: colors.primaryDark,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 6,
    },
  }),
  // Floating / elevated UI (modals, the launch logo, overlays).
  lg: Platform.select({
    web: {
      boxShadow:
        '0 2px 4px rgba(15, 35, 80, 0.05), 0 18px 40px rgba(14, 70, 210, 0.18), 0 6px 14px rgba(14, 70, 210, 0.08)',
    },
    default: {
      shadowColor: colors.primaryDark,
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.18,
      shadowRadius: 30,
      elevation: 12,
    },
  }),
} as const;

/** Standard motion durations (ms) used across fade/scale transitions. */
export const motion = {
  instant: 90,
  fast: 180,
  normal: 280,
  slow: 420,
} as const;
