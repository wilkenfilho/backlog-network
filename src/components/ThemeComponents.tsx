/**
 * BACKLOG NETWORK — Componentes de tema reutilizáveis
 * GlassCard: card com glassmorphism (backdrop blur + borda translúcida)
 * ThemedText: texto padronizado com hierarquia tipográfica
 */
import React from 'react';
import { Text, StyleSheet, View, ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors, Fonts, Radius, Spacing } from '../theme';

// ─── GLASS CARD ──────────────────────────────────────────────────────────────
export const GlassCard = ({ children, style }: ViewProps) => (
  <View style={[styles.cardContainer, style]}>
    <BlurView intensity={15} tint="dark" style={styles.blur}>
      {children}
    </BlurView>
  </View>
);

// ─── THEMED TEXT ─────────────────────────────────────────────────────────────
interface ThemedTextProps extends ViewProps {
  type?: 'title' | 'body' | 'bodyBold' | 'mono' | 'monoBold';
  color?: string;
  size?: number;
  numberOfLines?: number;
  children: React.ReactNode;
}

export const ThemedText = ({
  type = 'body',
  color = Colors.text,
  size,
  numberOfLines,
  children,
  style,
}: ThemedTextProps) => {
  const getFamily = () => {
    switch (type) {
      case 'title':    return Fonts.display;    // Bebas Neue — títulos e impacto
      case 'bodyBold': return Fonts.bodyBold;    // DM Sans Bold
      case 'mono':     return Fonts.mono;        // Space Mono — metadados
      case 'monoBold': return Fonts.monoBold;    // Space Mono Bold — labels
      default:         return Fonts.body;        // DM Sans — corpo de texto
    }
  };

  return (
    <Text
      style={[{ fontFamily: getFamily(), color, fontSize: size || 14 }, style]}
      numberOfLines={numberOfLines}
    >
      {children}
    </Text>
  );
};

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    overflow: 'hidden',
  },
  blur: {
    padding: Spacing.md,
  },
});
