import React, { useState, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Animated, Modal, Pressable, ActivityIndicator, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';

import { Colors, Fonts, Spacing, Radius, Shadows } from '../../theme';
import { Button, StarRating, GameCover, Avatar, EmptyState, StatusBadge } from '../../components';
import type { Game, GameStatus } from '../../types';
import { rawgService, gamesService, reviewsService, backlogService } from '../../services/api';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { timeAgo } from '../../utils/helpers';

const DESC_CHAR_LIMIT = 180;

const STATUS_OPTIONS: { status: GameStatus; label: string; emoji: string; color: string }[] = [
  { status: 'playing',  label: 'Jogando agora',  emoji: '▶',  color: Colors.purple },
  { status: 'finished', label: 'Já zerei',        emoji: '✓',  color: Colors.accent },
  { status: 'backlog',  label: 'No backlog',       emoji: '⊟',  color: Colors.red },
  { status: 'dropped',  label: 'Largei',           emoji: '✕',  color: Colors.muted },
  { status: 'wishlist', label: 'Quero jogar',      emoji: '♡',  color: Colors.amber },
];

// ─── DESCRIPTION MODAL ──────────────────────────────────────────────────────
function DescriptionModal({ visible, onClose, title, description }: {
  visible: boolean; onClose: () => void; title: string; description: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.descOverlay} onPress={onClose}>
        <Pressable style={styles.descSheet} onPress={() => {}}>
          <View style={styles.descHandle} />
          <Text style={styles.descSheetTitle}>{title}</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
            <Text style={styles.descSheetBody}>{description}</Text>
          </ScrollView>
          <TouchableOpacity style={styles.descCloseBtn} onPress={onClose}>
            <Text style={styles.descCloseBtnText}>Fechar</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── REVIEW CARD (interativo) ────────────────────────────────────────────────
function ReviewCard({ review, onUserPress }: { review: any; onUserPress: (userId: string) => void }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(Number(review.likes_count ?? 0));

  const user = review.user ?? {};
  const displayName = user.display_name ?? user.displayName ?? user.username ?? 'Usuário';
  const ratingColor = review.rating >= 8 ? Colors.teal : review.rating >= 6 ? Colors.accent : review.rating >= 4 ? Colors.amber : Colors.red;

  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount(c => newLiked ? c + 1 : c - 1);
    reviewsService.likeReview(review.id).catch(() => {
      setLiked(!newLiked);
      setLikeCount(c => newLiked ? c - 1 : c + 1);
    });
  };

  const handleShare = async () => {
    Haptics.selectionAsync();
    await Share.share({
      message: `${review.title ? `"${review.title}" — ` : ''}Review por ${displayName}: ${(review.body ?? '').slice(0, 200)}… — via BACKLOG NETWORK`,
    });
  };

  return (
    <View style={styles.reviewCard}>
      {/* Rating badge */}
      <View style={[styles.reviewRatingBadge, { borderColor: ratingColor + '40', backgroundColor: ratingColor + '12' }]}>
        <Text style={[styles.reviewRatingText, { color: ratingColor }]}>{Number(review.rating).toFixed(1)}</Text>
      </View>

      <View style={styles.reviewHeader}>
        <TouchableOpacity onPress={() => onUserPress(user.id)}>
          <Avatar user={user} size={36} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <TouchableOpacity onPress={() => onUserPress(user.id)}>
            <Text style={styles.reviewUsername}>{displayName}</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <StarRating rating={review.rating} size={12} />
            {review.platform && (
              <View style={styles.reviewPlatform}>
                <Text style={styles.reviewPlatformText}>{review.platform}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {review.hours_played ? <Text style={styles.reviewHours}>⏱ {review.hours_played}h</Text> : null}
          <Text style={styles.reviewTime}>{timeAgo(review.created_at)}</Text>
        </View>
      </View>

      {review.title && <Text style={styles.reviewTitle}>{review.title}</Text>}
      <Text style={styles.reviewBody} numberOfLines={4}>{review.body}</Text>

      {/* Actions */}
      <View style={styles.reviewFooter}>
        <TouchableOpacity style={styles.reviewActionBtn} onPress={handleLike}>
          <Text style={[styles.reviewActionIcon, liked && { color: Colors.red }]}>{liked ? '♥' : '♡'}</Text>
          {likeCount > 0 && <Text style={[styles.reviewActionCount, liked && { color: Colors.red }]}>{likeCount}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.reviewActionBtn} onPress={handleShare}>
          <Text style={styles.reviewActionIcon}>↗</Text>
          <Text style={styles.reviewActionLabel}>Compartilhar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── STATUS PICKER ──────────────────────────────────────────────────────────
function StatusPicker({ selected, onSelect, onSave, onClose, isSaving }: {
  selected?: GameStatus; onSelect: (s: GameStatus) => void;
  onSave: () => void; onClose: () => void; isSaving?: boolean;
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
        <Button label={isSaving ? 'Salvando...' : 'Salvar'} onPress={onSave} style={{ marginTop: Spacing.lg }} disabled={isSaving} />
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
  const [backlogEntryId, setBacklogEntryId] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'overview' | 'reviews' | 'lists'>('overview');
  const [showFullDesc, setShowFullDesc] = useState(false);

  // ── Persist status to backend ────────────────────────────────────────────
  const addToBacklogMutation = useMutation({
    mutationFn: (status: GameStatus) => {
      const gameIdForBacklog = game.backendId ?? game.id ?? gameId;
      if (backlogEntryId) {
        return backlogService.updateEntry(backlogEntryId, { status });
      }
      return backlogService.addGame({ game_id: String(gameIdForBacklog), status });
    },
    onSuccess: (res: any) => {
      const entryId = res?.id ?? res?.entry_id ?? res?.data?.id;
      if (entryId) setBacklogEntryId(entryId);
      setShowPicker(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('✓ Salvo!', `Jogo adicionado ao status "${STATUS_OPTIONS.find(o => o.status === myStatus)?.label}".`);
    },
    onError: () => Alert.alert('Erro', 'Não foi possível salvar o status. Tente novamente.'),
  });

  const handleSaveStatus = () => {
    if (!myStatus) return;
    addToBacklogMutation.mutate(myStatus);
  };

  const route = useRoute<any>();
  const routeGame = route.params?.game;
  const gameId = route.params?.gameId ?? routeGame?.rawg_id ?? routeGame?.id;

  // Fetch full game details from RAWG
  const { data: rawgGame } = useQuery({
    queryKey: ['game-detail-rawg', gameId],
    queryFn: () => rawgService.getGame(String(gameId)),
    enabled: !!gameId,
  });

  // Fetch game from backend (caches it from RAWG, gives us backend UUID)
  const { data: backendGame } = useQuery({
    queryKey: ['game-detail-backend', gameId],
    queryFn: () => gamesService.getGame(String(gameId)),
    enabled: !!gameId,
    retry: false,
  });

  // Merge all game sources
  const game = useMemo(() => {
    const base = routeGame ?? {};
    const rawg = rawgGame ?? {};
    const backend = backendGame ?? {};
    return {
      ...base,
      ...rawg,
      ...backend,
      id: backend.id ?? base.id ?? rawg.id,
      backendId: backend.id,
      title: rawg.title ?? backend.title ?? base.title ?? '',
      developer: rawg.developer ?? backend.developer ?? base.developer ?? '',
      publisher: rawg.publisher ?? backend.publisher ?? base.publisher ?? '',
      description: rawg.description ?? backend.description ?? base.description ?? '',
      genres: rawg.genres?.length ? rawg.genres : (backend.genres?.length ? backend.genres : (base.genres ?? [])),
      platforms: rawg.platforms?.length ? rawg.platforms : (backend.platforms?.length ? backend.platforms : (base.platforms ?? [])),
      coverUrl: rawg.coverUrl ?? rawg.cover_url ?? backend.cover_url ?? base.coverUrl ?? base.cover_url,
      rating: rawg.metacritic ?? rawg.rating ?? backend.rawg_rating ?? base.rating ?? 0,
      appRating: Number(backend['backlog-network_rating'] ?? base.appRating ?? 0),
      reviewsCount: Number(backend.reviews_count ?? base.reviewsCount ?? 0),
      releaseDate: rawg.released ?? backend.release_date ?? base.releaseDate ?? base.released,
    };
  }, [routeGame, rawgGame, backendGame]);

  // ID para buscar reviews: preferir backend UUID, senão ID original
  const reviewGameId = game.backendId ?? game.id ?? gameId;

  // Fetch reviews do backend (só quando a aba reviews está ativa)
  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ['game-reviews', reviewGameId],
    queryFn: () => gamesService.getReviews(String(reviewGameId)),
    select: (res: any) => {
      const raw = res?.data ?? res ?? [];
      return Array.isArray(raw) ? raw : [];
    },
    enabled: !!reviewGameId && activeTab === 'reviews',
  });

  const reviews = reviewsData ?? [];

  const headerOpacity = scrollY.interpolate({
    inputRange: [200, 260], outputRange: [0, 1], extrapolate: 'clamp',
  });

  // Description truncation
  const fullDesc = game.description ?? '';
  const needsTruncation = fullDesc.length > DESC_CHAR_LIMIT;
  const truncatedDesc = needsTruncation ? fullDesc.slice(0, DESC_CHAR_LIMIT).trimEnd() + '…' : fullDesc;

  return (
    <View style={styles.container}>
      {/* FLOATING HEADER */}
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
          {game.coverUrl ? (
            <Image source={{ uri: game.coverUrl }} style={styles.heroBg} contentFit="cover" blurRadius={30} />
          ) : null}
          <LinearGradient colors={['transparent', Colors.bg + 'cc', Colors.bg]} style={StyleSheet.absoluteFill} />
          <View style={styles.heroContent}>
            <View style={{ paddingTop: insets.top + 8, paddingHorizontal: Spacing.lg }}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.heroBackBtn}>
                <BlurView intensity={40} tint="dark" style={styles.heroBackBlur}>
                  <Text style={{ color: Colors.text, fontSize: 18 }}>←</Text>
                </BlurView>
              </TouchableOpacity>
            </View>
            <View style={styles.heroMain}>
              <GameCover game={game} width={110} height={145} borderRadius={Radius.lg} />
              <View style={styles.heroInfo}>
                <Text style={styles.heroTitle}>{game.title}</Text>
                <Text style={styles.heroDev}>{game.developer}</Text>
                {game.releaseDate ? <Text style={styles.heroYear}>{new Date(game.releaseDate).getFullYear()}</Text> : null}
                <View style={styles.heroGenres}>
                  {(game.genres ?? []).slice(0, 3).map((g: string) => (
                    <View key={g} style={styles.genreChip}><Text style={styles.genreText}>{g}</Text></View>
                  ))}
                </View>
                <View style={styles.heroRatings}>
                  {game.appRating > 0 && (
                    <>
                      <View style={styles.heroRatingItem}>
                        <Text style={styles.heroRatingNum}>{game.appRating.toFixed(1)}</Text>
                        <Text style={styles.heroRatingLabel}>BACKLOG NET</Text>
                      </View>
                      <View style={styles.heroRatingDivider} />
                    </>
                  )}
                  {game.rating > 0 && (
                    <View style={styles.heroRatingItem}>
                      <Text style={[styles.heroRatingNum, { color: Colors.amber }]}>
                        {typeof game.rating === 'number' && game.rating <= 10 ? game.rating.toFixed(1) : game.rating}
                      </Text>
                      <Text style={styles.heroRatingLabel}>RAWG</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* CTA ROW */}
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
          <TouchableOpacity style={styles.ctaSecondary} onPress={() => navigation.navigate('ReviewCreate', { gameId: reviewGameId, game })}>
            <Text style={{ color: Colors.accent, fontSize: 18 }}>⭐</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctaSecondary} onPress={() => Share.share({ message: `Confira ${game.title} no BACKLOG NETWORK!` })}>
            <Text style={{ color: Colors.muted, fontSize: 18 }}>↗</Text>
          </TouchableOpacity>
        </View>

        {/* TABS */}
        <View style={styles.tabsContainer}>
          {(['overview', 'reviews', 'lists'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.gameTab, activeTab === tab && styles.gameTabActive]}
              onPress={() => { Haptics.selectionAsync(); setActiveTab(tab); }}
            >
              <Text style={[styles.gameTabText, activeTab === tab && styles.gameTabTextActive]}>
                {tab === 'overview' ? 'Visão Geral' : tab === 'reviews' ? `Reviews${game.reviewsCount > 0 ? ` (${game.reviewsCount})` : ''}` : 'Listas'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* TAB CONTENT */}
        <View style={{ paddingHorizontal: Spacing.lg, paddingBottom: 120 }}>

          {/* ── OVERVIEW ── */}
          {activeTab === 'overview' && (
            <View>
              {fullDesc.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Sobre o jogo</Text>
                  <Text style={styles.description}>{truncatedDesc}</Text>
                  {needsTruncation && (
                    <TouchableOpacity onPress={() => setShowFullDesc(true)} style={styles.readMoreBtn}>
                      <Text style={styles.readMoreText}>Leia mais</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
              {(game.platforms ?? []).length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: Spacing.xxl }]}>Plataformas</Text>
                  <View style={styles.platformsGrid}>
                    {game.platforms.map((p: string) => (
                      <View key={p} style={styles.platformCard}>
                        <Text style={styles.platformCardText}>{p}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}

          {/* ── REVIEWS ── */}
          {activeTab === 'reviews' && (
            <View>
              {game.appRating > 0 && (
                <View style={styles.ratingOverview}>
                  <View style={styles.ratingBig}>
                    <Text style={styles.ratingBigNum}>{game.appRating.toFixed(1)}</Text>
                    <StarRating rating={game.appRating} size={16} />
                    <Text style={styles.ratingBigLabel}>{game.reviewsCount} reviews</Text>
                  </View>
                </View>
              )}
              <TouchableOpacity
                style={styles.writeReviewBtn}
                onPress={() => navigation.navigate('ReviewCreate', { gameId: reviewGameId, game })}
              >
                <Text style={styles.writeReviewText}>✍️  Escrever review</Text>
              </TouchableOpacity>
              {reviewsLoading ? (
                <ActivityIndicator color={Colors.accent} style={{ marginVertical: 30 }} />
              ) : reviews.length > 0 ? (
                reviews.map((r: any) => (
                  <ReviewCard key={r.id} review={r} onUserPress={(uid) => navigation.navigate('UserProfile', { userId: uid })} />
                ))
              ) : (
                <EmptyState emoji="✍️" title="Sem reviews ainda" subtitle="Seja o primeiro a avaliar este jogo!" action="Escrever review" onAction={() => navigation.navigate('ReviewCreate', { gameId: reviewGameId, game })} />
              )}
            </View>
          )}

          {/* ── LISTS ── */}
          {activeTab === 'lists' && (
            <EmptyState emoji="📋" title="Sem listas ainda" subtitle="Seja o primeiro a adicionar esse jogo a uma lista" action="Criar lista" onAction={() => {}} />
          )}
        </View>
      </Animated.ScrollView>

      {/* MODALS */}
      <DescriptionModal visible={showFullDesc} onClose={() => setShowFullDesc(false)} title={game.title} description={fullDesc} />
      {showPicker && <StatusPicker selected={myStatus} onSelect={setMyStatus} onSave={handleSaveStatus} onClose={() => setShowPicker(false)} isSaving={addToBacklogMutation.isPending} />}
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
  tabsContainer: { flexDirection: 'row', paddingHorizontal: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, marginBottom: Spacing.lg },
  gameTab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  gameTabActive: { borderBottomColor: Colors.accent },
  gameTabText: { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.muted, letterSpacing: 0.5 },
  gameTabTextActive: { color: Colors.accent },
  sectionTitle: { fontFamily: Fonts.monoBold, fontSize: 10, letterSpacing: 2, color: Colors.muted, textTransform: 'uppercase', marginBottom: Spacing.md },
  description: { fontFamily: Fonts.body, fontSize: 14, lineHeight: 22, color: Colors.textSecondary },
  readMoreBtn: { marginTop: 8 },
  readMoreText: { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.accent },
  platformsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  platformCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  platformCardText: { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.text },
  ratingOverview: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  ratingBig: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  ratingBigNum: { fontFamily: Fonts.display, fontSize: 48, color: Colors.accent, lineHeight: 52 },
  ratingBigLabel: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  writeReviewBtn: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, paddingVertical: 14, alignItems: 'center', marginBottom: Spacing.lg },
  writeReviewText: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.accent },
  reviewCard: { backgroundColor: Colors.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, marginBottom: Spacing.md, ...Shadows.card },
  reviewHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: Spacing.md },
  reviewUsername: { fontFamily: Fonts.bodyBold, fontSize: 13, color: Colors.text },
  reviewPlatform: { backgroundColor: Colors.surface2, borderRadius: Radius.xs, paddingHorizontal: 6, paddingVertical: 2 },
  reviewPlatformText: { fontFamily: Fonts.mono, fontSize: 9, color: Colors.muted },
  reviewHours: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  reviewTime: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, marginTop: 2 },
  reviewTitle: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text, marginBottom: 6 },
  reviewBody: { fontFamily: Fonts.body, fontSize: 13, lineHeight: 20, color: Colors.textSecondary, marginBottom: Spacing.md },
  reviewRatingBadge: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.sm, borderWidth: 1, zIndex: 2 },
  reviewRatingText: { fontFamily: Fonts.display, fontSize: 18 },
  reviewFooter: { flexDirection: 'row', gap: 16, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  reviewActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  reviewActionIcon: { fontSize: 16, color: Colors.muted },
  reviewActionCount: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted },
  reviewActionLabel: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  descOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  descSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: Spacing.xxl, paddingBottom: 40, maxHeight: '80%' },
  descHandle: { width: 36, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.lg },
  descSheetTitle: { fontFamily: Fonts.display, fontSize: 24, letterSpacing: 1, color: Colors.text, marginBottom: Spacing.lg },
  descSheetBody: { fontFamily: Fonts.body, fontSize: 15, lineHeight: 24, color: Colors.textSecondary },
  descCloseBtn: { marginTop: Spacing.lg, alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 10, borderRadius: Radius.full, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border },
  descCloseBtnText: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.text },
  pickerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end', zIndex: 999 },
  pickerSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: Spacing.xxl, paddingBottom: 40, borderTopWidth: 1, borderTopColor: Colors.border },
  pickerHandle: { width: 36, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.lg },
  pickerTitle: { fontFamily: Fonts.display, fontSize: 22, letterSpacing: 1.5, color: Colors.text, marginBottom: Spacing.lg },
  pickerOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickerOptionActive: {},
  pickerDot: { width: 8, height: 8, borderRadius: 4 },
  pickerLabel: { flex: 1, fontFamily: Fonts.bodyMedium, fontSize: 15 },
});
