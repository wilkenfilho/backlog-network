import { Platform } from 'react-native';

// ─── COLORS ─────────────────────────────────────────────────────────────────
export const Colors = {
  // Backgrounds
  bg: '#0a0a0f',
  surface: '#13131a',
  surface2: '#1c1c28',
  surface3: '#242433',
  card: '#111118',

  // Borders
  border: 'rgba(255,255,255,0.07)',
  borderFocus: 'rgba(200,241,53,0.4)',

  // Brand
  accent: '#c8f135',      // lime green — primary CTA
  accentDark: '#9ab828',
  purple: '#7b61ff',      // purple — playing status
  red: '#ff5c5c',         // red — dropped / danger
  amber: '#ffaa00',       // amber — reviews / stars
  teal: '#00c896',        // teal — friend online

  // Text
  text: '#e8e8f0',
  textSecondary: 'rgba(232,232,240,0.7)',
  muted: '#6b6b80',
  placeholder: '#3d3d52',

  // Status tags
  statusPlaying: { bg: 'rgba(123,97,255,0.15)', text: '#7b61ff', border: 'rgba(123,97,255,0.3)' },
  statusFinished: { bg: 'rgba(200,241,53,0.1)', text: '#c8f135', border: 'rgba(200,241,53,0.3)' },
  statusBacklog: { bg: 'rgba(255,92,92,0.1)', text: '#ff5c5c', border: 'rgba(255,92,92,0.3)' },
  statusDropped: { bg: 'rgba(107,107,128,0.15)', text: '#6b6b80', border: 'rgba(107,107,128,0.3)' },
  statusReview: { bg: 'rgba(255,170,0,0.1)', text: '#ffaa00', border: 'rgba(255,170,0,0.3)' },

  // Gradients (use with expo-linear-gradient)
  gradientAccent: ['#c8f135', '#7b61ff'] as const,
  gradientPurple: ['#7b61ff', '#c8f135'] as const,
  gradientFire: ['#ff5c5c', '#ff9a00'] as const,
  gradientTeal: ['#00c896', '#00a3ff'] as const,
  gradientDark: ['#1c1c28', '#0a0a0f'] as const,
} as const;

// ─── TYPOGRAPHY ─────────────────────────────────────────────────────────────
// Fonts loaded via expo-font in App.tsx
export const Fonts = {
  display: 'BebasNeue_400Regular',    // títulos grandes
  mono: 'SpaceMono_400Regular',       // badges, códigos, números
  monoBold: 'SpaceMono_700Bold',
  body: 'DMSans_400Regular',          // texto corrido
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
  bodyItalic: 'DMSans_400Regular_Italic',
} as const;

export const Typography = {
  // Display
  displayXL: { fontFamily: Fonts.display, fontSize: 48, letterSpacing: 3, color: Colors.text },
  displayLG: { fontFamily: Fonts.display, fontSize: 36, letterSpacing: 2, color: Colors.text },
  displayMD: { fontFamily: Fonts.display, fontSize: 28, letterSpacing: 2, color: Colors.text },
  displaySM: { fontFamily: Fonts.display, fontSize: 22, letterSpacing: 1.5, color: Colors.text },

  // Body
  bodyLG: { fontFamily: Fonts.body, fontSize: 16, lineHeight: 24, color: Colors.text },
  bodyMD: { fontFamily: Fonts.bodyMedium, fontSize: 14, lineHeight: 20, color: Colors.text },
  bodySM: { fontFamily: Fonts.body, fontSize: 12, lineHeight: 18, color: Colors.muted },
  bodyXS: { fontFamily: Fonts.body, fontSize: 11, lineHeight: 16, color: Colors.muted },

  // Mono
  monoLG: { fontFamily: Fonts.monoBold, fontSize: 14, letterSpacing: 0.5, color: Colors.text },
  monoMD: { fontFamily: Fonts.mono, fontSize: 12, letterSpacing: 0.5, color: Colors.muted },
  monoSM: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 1.5, color: Colors.muted },
  monoLabel: { fontFamily: Fonts.monoBold, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' as const, color: Colors.muted },
} as const;

// ─── SPACING ─────────────────────────────────────────────────────────────────
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 40,
} as const;

// ─── RADIUS ──────────────────────────────────────────────────────────────────
export const Radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
} as const;

// ─── SHADOWS ─────────────────────────────────────────────────────────────────
export const Shadows = {
  card: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
    },
    android: { elevation: 8 },
  }),
  accentGlow: Platform.select({
    ios: {
      shadowColor: Colors.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
    },
    android: { elevation: 12 },
  }),
  navBar: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
    },
    android: { elevation: 16 },
  }),
} as const;

// ─── LAYOUT ──────────────────────────────────────────────────────────────────
export const Layout = {
  tabBarHeight: 82,
  headerHeight: 96,
  statusBarHeight: Platform.OS === 'ios' ? 47 : 24,
} as const;

// ─── ANIMATION ───────────────────────────────────────────────────────────────
export const Animation = {
  fast: 150,
  normal: 250,
  slow: 400,
  spring: { damping: 18, stiffness: 200, mass: 1 },
  springBouncy: { damping: 12, stiffness: 180, mass: 0.8 },
} as const;

const Theme = { Colors, Fonts, Typography, Spacing, Radius, Shadows, Layout, Animation };
export default Theme;
