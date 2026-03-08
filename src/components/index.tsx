import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  ViewStyle, TextStyle, ImageStyle, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Radius, Spacing, Shadows, Typography } from '../theme';
import type { Game, User, GameStatus } from '../types';

// ─── BUTTON ──────────────────────────────────────────────────────────────────
interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export function Button({ label, onPress, variant = 'primary', size = 'md', loading, disabled, icon, style }: ButtonProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    if (disabled || loading) return;
    scale.value = withSpring(0.95, { damping: 12 }, () => { scale.value = withSpring(1); });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const containerStyle = [
    styles.btn,
    styles[`btn_${size}`],
    styles[`btn_${variant}`],
    (disabled || loading) && styles.btn_disabled,
    style,
  ];

  const textStyle = [styles.btnText, styles[`btnText_${size}`], styles[`btnText_${variant}`]];

  if (variant === 'primary') {
    return (
      <Animated.View style={animStyle}>
        <Pressable onPress={handlePress} style={containerStyle}>
          <LinearGradient
            colors={[Colors.accent, Colors.accentDark]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[StyleSheet.absoluteFill, { borderRadius: Radius.md }]}
          />
          {icon && <View style={styles.btnIcon}>{icon}</View>}
          {loading
            ? <ActivityIndicator color="#0a0a0f" />
            : <Text style={textStyle}>{label}</Text>}
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={animStyle}>
      <Pressable onPress={handlePress} style={containerStyle}>
        {icon && <View style={styles.btnIcon}>{icon}</View>}
        {loading
          ? <ActivityIndicator color={Colors.accent} />
          : <Text style={textStyle}>{label}</Text>}
      </Pressable>
    </Animated.View>
  );
}

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<GameStatus, { label: string; emoji: string; colors: any }> = {
  playing:  { label: 'Jogando',  emoji: '▶',  colors: Colors.statusPlaying },
  finished: { label: 'Zerado',   emoji: '✓',  colors: Colors.statusFinished },
  backlog:  { label: 'Backlog',  emoji: '⊟',  colors: Colors.statusBacklog },
  dropped:  { label: 'Largado',  emoji: '✕',  colors: Colors.statusDropped },
  wishlist: { label: 'Wishlist', emoji: '♡',  colors: Colors.statusReview },
};

export function StatusBadge({ status }: { status: GameStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <View style={[styles.badge, {
      backgroundColor: cfg.colors.bg,
      borderColor: cfg.colors.border,
    }]}>
      <Text style={[styles.badgeEmoji]}>{cfg.emoji}</Text>
      <Text style={[styles.badgeText, { color: cfg.colors.text }]}>{cfg.label.toUpperCase()}</Text>
    </View>
  );
}

// ─── AVATAR ──────────────────────────────────────────────────────────────────
const AVATAR_GRADIENTS = [
  ['#7b61ff', '#c8f135'],
  ['#ff5c5c', '#ff9a00'],
  ['#00c896', '#00a3ff'],
  ['#c8f135', '#7b61ff'],
  ['#ff5c5c', '#7b61ff'],
] as const;

export function Avatar({ user, size = 40, onPress }: { user: Partial<User>; size?: number; onPress?: () => void }) {
  const initials = (user.displayName ?? user.username ?? '?').slice(0, 2).toUpperCase();
  const gradientIdx = (user.id?.charCodeAt(0) ?? 0) % AVATAR_GRADIENTS.length;
  const borderRadius = size * 0.28;

  if (user.avatar) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} disabled={!onPress}>
        <Image
          source={{ uri: user.avatar }}
          style={{ width: size, height: size, borderRadius }}
          contentFit="cover"
          transition={200}
        />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} disabled={!onPress}>
      <LinearGradient
        colors={AVATAR_GRADIENTS[gradientIdx]}
        style={{ width: size, height: size, borderRadius, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ fontFamily: Fonts.monoBold, fontSize: size * 0.33, color: '#0a0a0f' }}>
          {initials}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─── GAME COVER ──────────────────────────────────────────────────────────────
export function GameCover({ game, width = 56, height = 72, borderRadius = Radius.md }: {
  game: Partial<Game>; width?: number; height?: number; borderRadius?: number;
}) {
  const EMOJIS: Record<string, string> = {
    'Action': '⚔️', 'RPG': '🐉', 'Strategy': '♟️', 'Shooter': '🔫',
    'Platformer': '🕹️', 'Horror': '👻', 'Racing': '🏎️', 'Sports': '⚽',
    'Adventure': '🗺️', 'Puzzle': '🧩', 'Simulation': '🏗️', 'Fighting': '🥊',
  };
  const emoji = EMOJIS[game.genres?.[0] ?? ''] ?? '🎮';

  if (game.coverUrl) {
    return (
      <Image
        source={{ uri: game.coverUrl }}
        style={{ width, height, borderRadius }}
        contentFit="cover"
        transition={300}
      />
    );
  }

  return (
    <LinearGradient
      colors={['#1c1c28', '#13131a']}
      style={{ width, height, borderRadius, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ fontSize: width * 0.5 }}>{emoji}</Text>
    </LinearGradient>
  );
}

// ─── STAR RATING ─────────────────────────────────────────────────────────────
export function StarRating({ rating, max = 10, size = 14, interactive = false, onChange }: {
  rating: number; max?: number; size?: number; interactive?: boolean; onChange?: (r: number) => void;
}) {
  const stars = 5;
  const normalized = (rating / max) * stars;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      {Array.from({ length: stars }).map((_, i) => {
        const filled = i < Math.floor(normalized);
        const half = !filled && i < normalized;
        return (
          <TouchableOpacity
            key={i}
            disabled={!interactive}
            onPress={() => onChange?.((i + 1) * (max / stars))}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: size, color: filled || half ? Colors.amber : Colors.surface3 }}>
              {filled ? '★' : half ? '⯨' : '☆'}
            </Text>
          </TouchableOpacity>
        );
      })}
      <Text style={{ fontFamily: Fonts.monoBold, fontSize: size, color: Colors.amber, marginLeft: 4 }}>
        {rating.toFixed(1)}
      </Text>
    </View>
  );
}

// ─── PROGRESS BAR ────────────────────────────────────────────────────────────
export function ProgressBar({ progress, color = Colors.accent, height = 6, label }: {
  progress: number; color?: string; height?: number; label?: string;
}) {
  return (
    <View>
      {label && (
        <View style={styles.progressLabelRow}>
          <Text style={styles.progressLabel}>{label}</Text>
          <Text style={[styles.progressLabel, { color }]}>{progress}%</Text>
        </View>
      )}
      <View style={[styles.progressTrack, { height }]}>
        <Animated.View style={[styles.progressFill, { width: `${progress}%` as any, backgroundColor: color, height }]} />
      </View>
    </View>
  );
}

// ─── SECTION HEADER ──────────────────────────────────────────────────────────
export function SectionHeader({ title, action, onAction }: {
  title: string; action?: string; onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── EMPTY STATE ─────────────────────────────────────────────────────────────
export function EmptyState({ emoji, title, subtitle, action, onAction }: {
  emoji: string; title: string; subtitle?: string; action?: string; onAction?: () => void;
}) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
      {action && onAction && (
        <Button label={action} onPress={onAction} size="sm" style={{ marginTop: Spacing.lg }} />
      )}
    </View>
  );
}

// ─── SKELETON ─────────────────────────────────────────────────────────────────
export function Skeleton({ width, height, borderRadius = Radius.sm, style }: {
  width: number | string; height: number; borderRadius?: number; style?: ViewStyle;
}) {
  const opacity = useSharedValue(0.3);
  React.useEffect(() => {
    opacity.value = withTiming(0.7, { duration: 700 }, () => {
      opacity.value = withTiming(0.3, { duration: 700 });
    });
  }, []);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width: width as any, height, borderRadius, backgroundColor: Colors.surface2 }, animStyle, style]} />;
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Button
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  btn_sm: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.sm },
  btn_md: { paddingHorizontal: 20, paddingVertical: 13, borderRadius: Radius.md },
  btn_lg: { paddingHorizontal: 24, paddingVertical: 16, borderRadius: Radius.lg },
  btn_primary: {},
  btn_secondary: { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.accent },
  btn_ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.border },
  btn_danger: { backgroundColor: Colors.red },
  btn_disabled: { opacity: 0.4 },
  btnText: { fontFamily: Fonts.monoBold, letterSpacing: 0.5 },
  btnText_sm: { fontSize: 11 },
  btnText_md: { fontSize: 13 },
  btnText_lg: { fontSize: 15 },
  btnText_primary: { color: '#0a0a0f' },
  btnText_secondary: { color: Colors.accent },
  btnText_ghost: { color: Colors.text },
  btnText_danger: { color: '#fff' },
  btnIcon: { marginRight: 8 },

  // Badge
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1 },
  badgeEmoji: { fontSize: 10 },
  badgeText: { fontFamily: Fonts.monoBold, fontSize: 10, letterSpacing: 0.5 },

  // Progress
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  progressTrack: { backgroundColor: Colors.surface2, borderRadius: 999, overflow: 'hidden' },
  progressFill: { borderRadius: 999 },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  sectionTitle: { fontFamily: Fonts.monoBold, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: Colors.muted },
  sectionAction: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.accent },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxxl, paddingHorizontal: Spacing.xxl },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.lg },
  emptyTitle: { fontFamily: Fonts.monoBold, fontSize: 16, color: Colors.text, textAlign: 'center', letterSpacing: 0.5 },
  emptySubtitle: { fontFamily: Fonts.body, fontSize: 14, color: Colors.muted, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});
