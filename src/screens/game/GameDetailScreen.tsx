import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';

import { Colors, Fonts, Spacing, Radius, Shadows } from '../../theme';
import { Button, StarRating, GameCover, Avatar, ProgressBar, EmptyState, StatusBadge } from '../../components';
import type { Game, Review, GameStatus } from '../../types';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── MOCK GAME DATA ───────────────────────────────────────────────────────────
const MOCK_GAME: Game = {
  id: 'g1',
  title: 'Elden Ring',
  developer: 'FromSoftware',
  publisher: 'Bandai Namco',
  genres: ['RPG', 'Action', 'Open World'],
  platforms: ['PS5', 'PS4', 'Xbox Series', 'Xbox One', 'PC'],
  releaseDate: '2022-02-25',
  rating: 96,
  appRating: 9.2,
  reviewsCount: 8431,
  hltbMainStory: 55,
  hltbCompletionist: 133,
  description: 'Elden Ring é um jogo de ação RPG desenvolvido pela FromSoftware em colaboração com George R. R. Martin. Explore o Entre-Terras, um vasto mundo aberto repleto de criaturas místicas, calabouços traiçoeiros e batalhas épicas. Forje sua lenda, colete fragmentos do Anel do Elden e reivindique o trono.',
};

const MOCK_REVIEWS: Review[] = [
  {
    id: 'r1', rating: 10, title: 'Obra de arte', body: 'Simplesmente o melhor jogo que já joguei. A sensação de descoberta é incomparável.', spoiler: false, likesCount: 312, commentsCount: 44, isLiked: false, createdAt: '2025-01-10T10:00:00Z', updatedAt: '', platform: 'PS5', hoursPlayed: 120,
    user: { id: 'u1', username: 'mari_rpg', displayName: 'Mari RPG', level: 37, xp: 14200, followersCount: 891, followingCount: 120, gamesCount: 187, reviewsCount: 84, hoursPlayed: 4100, badges: [], createdAt: '' },
    game: MOCK_GAME,
  },
  {
    id: 'r2', rating: 8.5, body: 'Incrível mas a curva de dificuldade pode frustrar quem não está acostumado. Persista.', spoiler: false, likesCount: 89, commentsCount: 12, isLiked: true, createdAt: '2025-02-03T14:00:00Z', updatedAt: '', platform: 'PC', hoursPlayed: 67,
    user: { id: 'u2', username: 'luca.dev', displayName: 'Luca', level: 18, xp: 5200, followersCount: 213, followingCount: 95, gamesCount: 71, reviewsCount: 22, hoursPlayed: 1800, badges: [], createdAt: '' },
    game: MOCK_GAME,
  },
];

const STATUS_OPTIONS: { status: GameStatus; label: string; emoji: string; color: string }[] = [
  { status: 'playing',  label: 'Jogando agora',  emoji: '▶',  color: Colors.purple },
  { status: 'finished', label: 'Já zerei',        emoji: '✓',  color: Colors.accent },
  { status: 'backlog',  label: 'No backlog',       emoji: '⊟',  color: Colors.red },
  { status: 'dropped',  label: 'Largei',           emoji: '✕',  color: Colors.muted },
  { status: 'wishlist', label: 'Quero jogar',      emoji: '♡',  color: Colors.amber },
];

// ─── REVIEW CARD ──────────────────────────────────────────────────────────────
function ReviewCard({ review, onPress }: { review: Review; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.reviewCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.reviewHeader}>
        <Avatar user={review.user} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={styles.reviewUsername}>{review.user.displayName}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <StarRating rating={review.rating} size={12} />
            {review.platform && (
              <View style={styles.reviewPlatform}>
                <Text style={styles.reviewPlatformText}>{review.platform}</Text>
              </View>
            )}
          </View>
        </View>
        {review.hoursPlayed && (
          <Text style={styles.reviewHours}>⏱ {review.hoursPlayed}h</Text>
        )}
      </View>
      {review.title && <Text style={styles.reviewTitle}>{review.title}</Text>}
      <Text style={styles.reviewBody} numberOfLines={3}>{review.body}</Text>
      <View style={styles.reviewFooter}>
        <Text style={styles.reviewLike}>♡ {review.likesCount}</Text>
        <Text style={styles.reviewComment}>💬 {review.commentsCount}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── STATUS PICKER MODAL ──────────────────────────────────────────────────────
function StatusPicker({ selected, onSelect, onClose }: {
  selected?: GameStatus; onSelect: (s: GameStatus) => void; onClose: () => void;
}) {
  return (
    <View style={styles.pickerOverlay}>
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.pickerSheet}>
        <View style={styles.pickerHandle} />
        <Text style={styles.pickerTitle}>Adicionar à biblioteca</Text>
        {STATUS_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.status}
            style={[styles.pickerOption, selected === opt.status && styles.pickerOptionActive]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelect(opt.status); }}
          >
            <View style={[styles.pickerDot, { backgroundColor: opt.color }]} />
            <Text style={[styles.pickerLabel, { color: selected === opt.status ? opt.color : Colors.text }]}>
              {opt.emoji} {opt.label}
            </Text>
            {selected === opt.status && <Text style={{ color: opt.color }}>✓</Text>}
          </TouchableOpacity>
        ))}
        <Button label="Salvar" onPress={onClose} style={{ marginTop: Spacing.lg }} />
      </View>
    </View>
  );
}

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function GameDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [showPicker, setShowPicker] = useState(false);
  const [myStatus, setMyStatus] = useState<GameStatus | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'overview' | 'reviews' | 'lists'>('overview');

  const game = MOCK_GAME;

  const headerOpacity = scrollY.interpolate({
    inputRange: [200, 260],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      {/* FLOATING BACK HEADER */}
      <Animated.View style={[styles.floatingHeader, { opacity: headerOpacity, paddingTop: insets.top }]}>
        <BlurView intensity={80} tint="dark" style={styles.floatingHeaderBlur}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={{ color: Colors.text, fontSize: 18 }}>←</Text>
          </TouchableOpacity>
          <Text style={styles.floatingTitle} numberOfLines={1}>{game.title}</Text>
          <View style={{ width: 36 }} />
        </BlurView>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        {/* HERO */}
        <View style={styles.hero}>
          <LinearGradient
            colors={['#1a1628', '#7b61ff33', '#0a0a0f']}
            style={styles.heroBg}
          />
          <View style={styles.heroContent}>
            {/* Back button overlay */}
            <View style={{ paddingTop: insets.top + 8, paddingHorizontal: Spacing.lg }}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.heroBackBtn}>
                <BlurView intensity={40} tint="dark" style={styles.heroBackBlur}>
                  <Text style={{ color: Colors.text, fontSize: 18 }}>←</Text>
                </BlurView>
              </TouchableOpacity>
            </View>

            {/* Game cover + info */}
            <View style={styles.heroMain}>
              <GameCover game={game} width={110} height={145} borderRadius={Radius.lg} />
              <View style={styles.heroInfo}>
                <Text style={styles.heroTitle}>{game.title}</Text>
                <Text style={styles.heroDev}>{game.developer}</Text>
                {game.releaseDate && (
                  <Text style={styles.heroYear}>{new Date(game.releaseDate).getFullYear()}</Text>
                )}
                <View style={styles.heroGenres}>
                  {game.genres.slice(0, 3).map(g => (
                    <View key={g} style={styles.genreChip}>
                      <Text style={styles.genreText}>{g}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.heroRatings}>
                  <View style={styles.heroRatingItem}>
                    <Text style={styles.heroRatingNum}>{game.appRating?.toFixed(1)}</Text>
                    <Text style={styles.heroRatingLabel}>BACKLOG NETWORK</Text>
                  </View>
                  <View style={styles.heroRatingDivider} />
                  <View style={styles.heroRatingItem}>
                    <Text style={[styles.heroRatingNum, { color: Colors.amber }]}>{game.rating}</Text>
                    <Text style={styles.heroRatingLabel}>RAWG</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ADD TO BACKLOG CTA */}
        <View style={styles.ctaRow}>
          <TouchableOpacity
            style={[styles.ctaMain, myStatus && styles.ctaMainSet]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowPicker(true); }}
          >
            {myStatus ? (
              <StatusBadge status={myStatus} />
            ) : (
              <LinearGradient colors={[Colors.accent, Colors.accentDark]} style={styles.ctaGradient}>
                <Text style={styles.ctaText}>+ Adicionar à biblioteca</Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctaSecondary} onPress={() => navigation.navigate('ReviewCreate', { gameId: game.id, game })}>
            <Text style={{ color: Colors.accent, fontSize: 18 }}>⭐</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctaSecondary}>
            <Text style={{ color: Colors.muted, fontSize: 18 }}>↗</Text>
          </TouchableOpacity>
        </View>

        {/* HLTB ROW */}
        {(game.hltbMainStory || game.hltbCompletionist) && (
          <View style={styles.hltbRow}>
            <View style={styles.hltbItem}>
              <Text style={styles.hltbHours}>{game.hltbMainStory}h</Text>
              <Text style={styles.hltbLabel}>História principal</Text>
            </View>
            <View style={styles.hltbDivider} />
            <View style={styles.hltbItem}>
              <Text style={[styles.hltbHours, { color: Colors.purple }]}>{game.hltbCompletionist}h</Text>
              <Text style={styles.hltbLabel}>100% / Platina</Text>
            </View>
            <View style={styles.hltbDivider} />
            <View style={styles.hltbItem}>
              <Text style={[styles.hltbHours, { color: Colors.amber }]}>{game.reviewsCount?.toLocaleString()}</Text>
              <Text style={styles.hltbLabel}>Reviews</Text>
            </View>
          </View>
        )}

        {/* TABS */}
        <View style={styles.tabsContainer}>
          {(['overview', 'reviews', 'lists'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.gameTab, activeTab === tab && styles.gameTabActive]}
              onPress={() => { Haptics.selectionAsync(); setActiveTab(tab); }}
            >
              <Text style={[styles.gameTabText, activeTab === tab && styles.gameTabTextActive]}>
                {tab === 'overview' ? 'Visão Geral' : tab === 'reviews' ? 'Reviews' : 'Listas'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* TAB CONTENT */}
        <View style={{ paddingHorizontal: Spacing.lg, paddingBottom: 120 }}>
          {activeTab === 'overview' && (
            <View>
              <Text style={styles.sectionTitle}>Sobre o jogo</Text>
              <Text style={styles.description}>{game.description}</Text>

              <Text style={[styles.sectionTitle, { marginTop: Spacing.xxl }]}>Plataformas</Text>
              <View style={styles.platformsGrid}>
                {game.platforms.map(p => (
                  <View key={p} style={styles.platformCard}>
                    <Text style={styles.platformCardText}>{p}</Text>
                  </View>
                ))}
              </View>

              <Text style={[styles.sectionTitle, { marginTop: Spacing.xxl }]}>Atividade dos amigos</Text>
              {[
                { user: { id: 'u1', username: 'gabs', displayName: 'Gabs' }, status: 'finished', hours: 84 },
                { user: { id: 'u2', username: 'rodrigao', displayName: 'Rodrigão' }, status: 'playing', hours: 22 },
              ].map((f, i) => (
                <View key={i} style={styles.friendActivity}>
                  <Avatar user={f.user as any} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.friendName}>{f.user.displayName}</Text>
                    <Text style={styles.friendStatus}>{f.status === 'finished' ? '✓ Zerou' : '▶ Jogando'} · {f.hours}h</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {activeTab === 'reviews' && (
            <View>
              {/* Rating breakdown */}
              <View style={styles.ratingOverview}>
                <View style={styles.ratingBig}>
                  <Text style={styles.ratingBigNum}>{game.appRating?.toFixed(1)}</Text>
                  <StarRating rating={game.appRating ?? 0} size={16} />
                  <Text style={styles.ratingBigLabel}>{game.reviewsCount?.toLocaleString()} reviews</Text>
                </View>
                <View style={styles.ratingBars}>
                  {[10, 8, 6, 4, 2].map(score => (
                    <View key={score} style={styles.ratingBarRow}>
                      <Text style={styles.ratingBarLabel}>{score}</Text>
                      <View style={styles.ratingBarTrack}>
                        <View style={[styles.ratingBarFill, {
                          width: `${score === 10 ? 45 : score === 8 ? 30 : score === 6 ? 15 : score === 4 ? 7 : 3}%`
                        }]} />
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* Write review CTA */}
              <TouchableOpacity
                style={styles.writeReviewBtn}
                onPress={() => navigation.navigate('ReviewCreate', { gameId: game.id, game })}
              >
                <Text style={styles.writeReviewText}>✍️  Escrever review</Text>
              </TouchableOpacity>

              {/* Reviews list */}
              {MOCK_REVIEWS.map(r => (
                <ReviewCard key={r.id} review={r} onPress={() => navigation.navigate('ReviewDetail', { reviewId: r.id })} />
              ))}
            </View>
          )}

          {activeTab === 'lists' && (
            <EmptyState emoji="📋" title="Sem listas ainda" subtitle="Seja o primeiro a adicionar esse jogo a uma lista" action="Criar lista" onAction={() => {}} />
          )}
        </View>
      </Animated.ScrollView>

      {/* STATUS PICKER */}
      {showPicker && (
        <StatusPicker
          selected={myStatus}
          onSelect={(s) => setMyStatus(s)}
          onClose={() => setShowPicker(false)}
        />
      )}
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  floatingHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 99 },
  floatingHeaderBlur: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  floatingTitle: { flex: 1, fontFamily: Fonts.bodyBold, fontSize: 16, color: Colors.text, textAlign: 'center' },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  hero: { height: 300, position: 'relative', overflow: 'hidden' },
  heroBg: { ...StyleSheet.absoluteFillObject },
  heroContent: { flex: 1 },
  heroBackBtn: { width: 36, height: 36, borderRadius: Radius.sm, overflow: 'hidden' },
  heroBackBlur: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  heroMain: { flexDirection: 'row', gap: Spacing.lg, paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  heroInfo: { flex: 1, justifyContent: 'flex-end' },
  heroTitle: { fontFamily: Fonts.display, fontSize: 28, letterSpacing: 1, color: Colors.text, lineHeight: 32 },
  heroDev: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.muted, marginTop: 4 },
  heroYear: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted, marginTop: 2 },
  heroGenres: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 10 },
  genreChip: { backgroundColor: Colors.surface2, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border },
  genreText: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  heroRatings: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 16 },
  heroRatingItem: { alignItems: 'center' },
  heroRatingNum: { fontFamily: Fonts.display, fontSize: 24, color: Colors.accent },
  heroRatingLabel: { fontFamily: Fonts.mono, fontSize: 9, color: Colors.muted, letterSpacing: 1.5 },
  heroRatingDivider: { width: 1, height: 28, backgroundColor: Colors.border },

  ctaRow: { flexDirection: 'row', gap: 10, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  ctaMain: { flex: 1, borderRadius: Radius.md, overflow: 'hidden', height: 44 },
  ctaMainSet: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  ctaGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: Fonts.monoBold, fontSize: 12, color: '#0a0a0f' },
  ctaSecondary: { width: 44, height: 44, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },

  hltbRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  hltbItem: { flex: 1, alignItems: 'center' },
  hltbHours: { fontFamily: Fonts.display, fontSize: 22, color: Colors.accent },
  hltbLabel: { fontFamily: Fonts.mono, fontSize: 9, color: Colors.muted, marginTop: 3, textAlign: 'center', letterSpacing: 0.5 },
  hltbDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },

  tabsContainer: { flexDirection: 'row', paddingHorizontal: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, marginBottom: Spacing.lg },
  gameTab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  gameTabActive: { borderBottomColor: Colors.accent },
  gameTabText: { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.muted, letterSpacing: 0.5 },
  gameTabTextActive: { color: Colors.accent },

  sectionTitle: { fontFamily: Fonts.monoBold, fontSize: 10, letterSpacing: 2, color: Colors.muted, textTransform: 'uppercase', marginBottom: Spacing.md },
  description: { fontFamily: Fonts.body, fontSize: 14, lineHeight: 22, color: Colors.textSecondary },
  platformsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  platformCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  platformCardText: { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.text },

  friendActivity: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  friendName: { fontFamily: Fonts.bodyBold, fontSize: 13, color: Colors.text },
  friendStatus: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted, marginTop: 2 },

  ratingOverview: { flexDirection: 'row', gap: 20, backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  ratingBig: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  ratingBigNum: { fontFamily: Fonts.display, fontSize: 48, color: Colors.accent, lineHeight: 52 },
  ratingBigLabel: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  ratingBars: { flex: 1, gap: 5, justifyContent: 'center' },
  ratingBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingBarLabel: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, width: 14, textAlign: 'right' },
  ratingBarTrack: { flex: 1, height: 5, backgroundColor: Colors.surface2, borderRadius: 3, overflow: 'hidden' },
  ratingBarFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: 3 },

  writeReviewBtn: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, paddingVertical: 14, alignItems: 'center', marginBottom: Spacing.lg },
  writeReviewText: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.accent },

  reviewCard: { backgroundColor: Colors.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, marginBottom: Spacing.md, ...Shadows.card },
  reviewHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: Spacing.md },
  reviewUsername: { fontFamily: Fonts.bodyBold, fontSize: 13, color: Colors.text },
  reviewPlatform: { backgroundColor: Colors.surface2, borderRadius: Radius.xs, paddingHorizontal: 6, paddingVertical: 2 },
  reviewPlatformText: { fontFamily: Fonts.mono, fontSize: 9, color: Colors.muted },
  reviewHours: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  reviewTitle: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text, marginBottom: 6 },
  reviewBody: { fontFamily: Fonts.body, fontSize: 13, lineHeight: 20, color: Colors.textSecondary, marginBottom: Spacing.md },
  reviewFooter: { flexDirection: 'row', gap: 16 },
  reviewLike: { fontFamily: Fonts.body, fontSize: 13, color: Colors.muted },
  reviewComment: { fontFamily: Fonts.body, fontSize: 13, color: Colors.muted },

  pickerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end', zIndex: 999 },
  pickerSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: Spacing.xxl, paddingBottom: 40, borderTopWidth: 1, borderTopColor: Colors.border },
  pickerHandle: { width: 36, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.lg },
  pickerTitle: { fontFamily: Fonts.display, fontSize: 22, letterSpacing: 1.5, color: Colors.text, marginBottom: Spacing.lg },
  pickerOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickerOptionActive: { },
  pickerDot: { width: 8, height: 8, borderRadius: 4 },
  pickerLabel: { flex: 1, fontFamily: Fonts.bodyMedium, fontSize: 15 },
});
