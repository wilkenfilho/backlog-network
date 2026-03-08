import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

import { Colors, Fonts, Spacing, Radius } from '../../theme';
import { useAuthStore } from '../../store/authStore';

const { width: W, height: H } = Dimensions.get('window');

const FEATURES = [
  { emoji: '🎮', title: 'Seu backlog organizado', desc: 'Nunca mais esqueça qual jogo tá na fila' },
  { emoji: '⭐', title: 'Reviews reais', desc: 'Notas e análises dos seus amigos gamers' },
  { emoji: '👾', title: 'Feed social', desc: 'Veja o que seus amigos estão jogando agora' },
  { emoji: '🔍', title: 'Descubra jogos', desc: 'Explore com base no seu gosto' },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { loginWithApple, loginWithGoogle } = useAuthStore();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
    // Pulse dot
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleApple = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // TODO: expo-apple-authentication
    // For demo, navigate to login
    navigation.navigate('Login');
  };

  const handleGoogle = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // TODO: expo-auth-session Google
    navigation.navigate('Login');
  };

  return (
    <View style={styles.container}>
      {/* ANIMATED BG GRID */}
      <View style={styles.bgGrid}>
        {Array.from({ length: 12 }).map((_, i) => (
          <Animated.View
            key={i}
            style={[styles.bgLine, {
              opacity: dotAnim.interpolate({ inputRange: [0, 1], outputRange: [0.03, 0.08] }),
              top: `${(i / 12) * 100}%`,
            }]}
          />
        ))}
      </View>

      {/* ACCENT GLOW */}
      <View style={styles.accentGlow} />

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {/* LOGO */}
        <View style={[styles.logoArea, { paddingTop: insets.top + 32 }]}>
          <Text style={styles.logoMark}>BACKLOG NETWORK</Text>
          <Text style={styles.logoTagline}>sua biblioteca gamer. social.</Text>
        </View>

        {/* FEATURES LIST */}
        <View style={styles.features}>
          {FEATURES.map((f, i) => (
            <Animated.View
              key={i}
              style={[styles.feature, {
                opacity: fadeAnim,
                transform: [{ translateX: slideAnim.interpolate({ inputRange: [0, 40], outputRange: [0, i * 10] }) }],
              }]}
            >
              <View style={styles.featureEmoji}>
                <Text style={{ fontSize: 22 }}>{f.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </Animated.View>
          ))}
        </View>

        {/* COMMUNITY PROOF */}
        <View style={styles.proof}>
          <View style={styles.proofAvatars}>
            {['#7b61ff', '#ff5c5c', '#00c896', '#ffaa00'].map((c, i) => (
              <View key={i} style={[styles.proofAvatar, { backgroundColor: c, marginLeft: i > 0 ? -10 : 0, zIndex: 4 - i }]} />
            ))}
          </View>
          <Text style={styles.proofText}>
            <Text style={{ color: Colors.accent }}>12.400+</Text> gamers já no BACKLOG NETWORK
          </Text>
        </View>
      </Animated.View>

      {/* AUTH BUTTONS */}
      <Animated.View style={[styles.authArea, { paddingBottom: insets.bottom + 20, opacity: fadeAnim }]}>
        {/* Apple Sign In */}
        <TouchableOpacity style={styles.appleBtn} onPress={handleApple} activeOpacity={0.85}>
          <Text style={styles.appleBtnIcon}></Text>
          <Text style={styles.appleBtnText}>Continuar com Apple</Text>
        </TouchableOpacity>

        {/* Google Sign In */}
        <TouchableOpacity style={styles.googleBtn} onPress={handleGoogle} activeOpacity={0.85}>
          <Text style={styles.googleIcon}>G</Text>
          <Text style={styles.googleBtnText}>Continuar com Google</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email */}
        <TouchableOpacity style={styles.emailBtn} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.emailBtnText}>Entrar com email</Text>
        </TouchableOpacity>

        {/* Register link */}
        <View style={styles.registerRow}>
          <Text style={styles.registerLabel}>Não tem conta? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.registerLink}>Criar agora</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.legal}>
          Ao continuar você aceita nossos{' '}
          <Text style={{ color: Colors.accent }}>Termos de Uso</Text>
          {' '}e{' '}
          <Text style={{ color: Colors.accent }}>Política de Privacidade</Text>
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  bgGrid: { ...StyleSheet.absoluteFillObject },
  bgLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: Colors.accent },
  accentGlow: {
    position: 'absolute',
    top: -100, left: W * 0.1,
    width: W * 0.8, height: 400,
    backgroundColor: Colors.purple,
    borderRadius: 999,
    opacity: 0.07,
    transform: [{ scaleX: 2 }],
  },

  content: { flex: 1, paddingHorizontal: Spacing.xxl },
  logoArea: { alignItems: 'flex-start', marginBottom: 48 },
  logoMark: { fontFamily: Fonts.display, fontSize: 64, letterSpacing: 6, color: Colors.text, lineHeight: 64 },
  logoTagline: { fontFamily: Fonts.mono, fontSize: 13, color: Colors.muted, letterSpacing: 1, marginTop: 6 },

  features: { gap: 20 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  featureEmoji: {
    width: 52, height: 52, borderRadius: Radius.lg,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  featureTitle: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text },
  featureDesc: { fontFamily: Fonts.body, fontSize: 13, color: Colors.muted, marginTop: 2 },

  proof: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 36 },
  proofAvatars: { flexDirection: 'row' },
  proofAvatar: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: Colors.bg },
  proofText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.muted },

  authArea: { paddingHorizontal: Spacing.xxl, gap: 10 },

  appleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: Radius.lg, paddingVertical: 15,
  },
  appleBtnIcon: { fontSize: 20, color: '#000' },
  appleBtnText: { fontFamily: Fonts.bodyBold, fontSize: 15, color: '#000' },

  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingVertical: 15,
    borderWidth: 1, borderColor: Colors.border,
  },
  googleIcon: { fontFamily: Fonts.monoBold, fontSize: 16, color: '#4285F4' },
  googleBtnText: { fontFamily: Fonts.bodyBold, fontSize: 15, color: Colors.text },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },

  emailBtn: {
    backgroundColor: 'transparent', borderRadius: Radius.lg, paddingVertical: 13,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  emailBtnText: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.text },

  registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
  registerLabel: { fontFamily: Fonts.body, fontSize: 13, color: Colors.muted },
  registerLink: { fontFamily: Fonts.bodyBold, fontSize: 13, color: Colors.accent },

  legal: { fontFamily: Fonts.body, fontSize: 11, color: Colors.muted, textAlign: 'center', lineHeight: 16, marginTop: 4 },
});
