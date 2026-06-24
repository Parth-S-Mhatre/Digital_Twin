import { Platform } from 'react-native';

/**
 * theme.ts
 *
 * Medical-grade dark dashboard theme. All component colors derive from here
 * to keep the design language consistent.
 */

export const COLORS = {
  // ── Backgrounds
  bg_deep: "#050C17",      // deepest background
  bg_card: "#0A1220",      // card surfaces
  bg_input: "#0D1829",     // input / metric tile
  bg_header: "#070E1A",    // top bar / nav

  // ── Borders / dividers
  border_dim: "#1A2D4A",
  border_mid: "#1E3A5F",
  border_bright: "#2A5080",

  // ── Text
  text_primary: "#D0E8FF",
  text_secondary: "#A0BCDA",
  text_muted: "#4A7090",
  text_faint: "#2A4A6A",

  // ── Accent – healthy
  teal: "#00E5CC",
  teal_dim: "#00E5CC18",
  teal_mid: "#00E5CC44",

  // ── Accent – warning
  amber: "#FFB300",
  amber_dim: "#FFB30018",

  // ── Accent – critical
  red: "#FF3B5C",
  red_dim: "#FF3B5C18",

  // ── Skeleton / structural
  bone: "#4A90D9",
  bone_dim: "#1E3A5F",
} as const;

export const RADII = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 24,
} as const;

export const FONTS = {
  mono: "Courier New",
  sans: "System",
} as const;

export const SHADOWS = {
  card: Platform.select({
    web: {
      boxShadow: '0 6px 16px rgba(0, 0, 0, 0.35)',
    },
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 10,
    },
  }),
  glow_teal: Platform.select({
    web: {
      boxShadow: '0 0 14px rgba(0, 229, 204, 0.3)',
    },
    default: {
      shadowColor: "#00E5CC",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 14,
      elevation: 8,
    },
  }),
} as const;
