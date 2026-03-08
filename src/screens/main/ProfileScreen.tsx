import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Colors, Fonts, Spacing, Radius, Shadows } from '../../theme';
import { Share } from 'react-native';
import { Avatar, Button, EmptyState } from '../../components';
import { useAuthStore } from '../../store/authStore';
import { usersService, backlogService, reviewsService } from '../../services/api';

type ProfileTab = 'backlog' | 'reviews' | 'listas';
type BacklogFilter = 'all' | 'playing' | 'finished' | 'backlog' | 'dropped' | 'wishlist';

const STATUS_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  playing:  { label: 'Jogando',  color: Colors.purple, emoji: '🎮' },
  finished: { label: 'Zerado',   color: Colors.accent,  emoji: '✅' },
  backlog:  { label: 'Backlog',  color: Colors.amber,   emoji: '📦' },
  dropped:  { label: 'Largado',  color: Colors.red,     emoji: '💀' },
  wishlist: { label: 'Desejo',   color: Colors.teal,    emoji: '⭐' },
};

function timeAgo(d: string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 86400)  return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / 604800)}sem`;
}

function XPBar({ xp, level }: { xp: number; level: number }) {
  const nextLevelXp = level * 500;
  const progress = Math.min((xp % nextLevelXp) / nextLevelXp, 1);
  return (
    <View style={styles.xpBar}>
      <View style={[styles.xpFill, { width: `${progress * 100}%` as any }]} />
    </View>
  );
}

function BacklogItem({ item, onPress }: { item: any; onPress: () => void }) {
  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.backlog;
  return (
    <TouchableOpacity style={styles.backlogItem} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.backlogCover}>
        <LinearGradient colors={['#1a1628', '#0d0d14']} style={StyleSheet.absoluteFill} />
        <Text style={{ fontSize: 22 }}>🎮</Text>
      </View>
      <View style={styles.backlogInfo}>
        <Text style={styles.backlogTitle} numberOfLines={1}>{item.game_title ?? item.title}</Text>
        <Text style={styles.backlogDev} numberOfLines={1}>{item.developer}</Text>
        {item.status === 'playing' && item.progress > 0 && (
          <View style={styles.progressRow}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${item.progress}%` as any }]} />
            </View>
            <Text style={styles.progressText}>{item.progress}%</Text>
          </View>
        )}
        {item.hours_played > 0 && (
          <Text style={styles.backlogHours}>⏱ {item.hours_played}h</Text>
        )}
      </View>
      <View style={[styles.statusDot, { backgroundColor: cfg.color + '30', borderColor: cfg.color }]}>
        <Text style={{ fontSize: 12 }}>{cfg.emoji}</Text>
      </View>
    </TouchableOpacity>
  );
}

function ReviewItem({ review, onPress }: { review: any; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.reviewCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewCover}>
          <LinearGradient colors={['#1a1628', '#0d0d14']} style={StyleSheet.absoluteFill} />
          <Text style={{ fontSize: 18 }}>🎮</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.reviewGame}>{review.game_title}</Text>
          <View style={styles.starsRow}>
            {Array(10).fill(0).map((_, i) => (
              <Text key={i} style={[styles.star, i < Math.round(review.rating) && styles.starFilled]}>★</Text>
            ))}
            <Text style={styles.ratingNum}>{review.rating}</Text>
          </View>
        </View>
        <Text style={styles.reviewTime}>{timeAgo(review.created_at)}</Text>
      </View>
      <Text style={styles.reviewBody} numberOfLines={3}>{review.body}</Text>
      <Text style={styles.reviewLikes}>♥ {review.likes_count ?? 0}</Text>
    </TouchableOpacity>
  );
}

export default function ProfileScreen({ route }: any) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user: authUser, logout } = useAuthStore();
  const queryClient = useQueryClient();

  const routeUserId = route?.params?.userId;
  const isMyProfile = !routeUserId || routeUserId === authUser?.id;
  const userId = isMyProfile ? authUser?.id : routeUserId;

  const [activeTab, setActiveTab] = useState<ProfileTab>('backlog');
  const [backlogFilter, setBacklogFilter] = useState<BacklogFilter>('all');
  const [following, setFollowing] = useState(false);

  React.useEffect(() => {
    if (profileData?.is_following !== undefined) setFollowing(!!profileData.is_following);
  }, [profileData?.is_following]);

  // ─── DATA FETCHING ────────────────────────────────────────────────────────
  const { data: profileData, isLoading: profileLoading, refetch: refetchProfile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => usersService.getProfile(userId!),
    enabled: !!userId,
    select: (res: any) => res.data,
  });

  const { data: backlogData, refetch: refetchBacklog } = useQuery({
    queryKey: ['backlog', userId],
    queryFn: () => backlogService.getBacklog(userId!),
    enabled: !!userId && activeTab === 'backlog',
    select: (res: any) => res.data?.data ?? [],
  });

  const { data: reviewsData, refetch: refetchReviews } = useQuery({
    queryKey: ['reviews', userId],
    queryFn: () => reviewsService.getUserReviews(userId!),
    enabled: !!userId && activeTab === 'reviews',
    select: (res: any) => res.data?.data ?? [],
  });

  const followMutation = useMutation({
    mutationFn: () => following
      ? usersService.unfollow(userId!)
      : usersService.follow(userId!),
    onSuccess: () => {
      setFollowing(!following);
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
  });

  const profile = profileData ?? authUser;
  const backlog = backlogData ?? [];
  const reviews = reviewsData ?? [];

  const filteredBacklog = backlogFilter === 'all'
    ? backlog
    : backlog.filter((b: any) => b.status === backlogFilter);

  const stats = {
    playing:  backlog.filter((b: any) => b.status === 'playing').length,
    finished: backlog.filter((b: any) => b.status === 'finished').length,
    backlog:  backlog.filter((b: any) => b.status === 'backlog').length,
    dropped:  backlog.filter((b: any) => b.status === 'dropped').length,
  };

  const handleRefresh = async () => {
    await Promise.all([refetchProfile(), refetchBacklog(), refetchReviews()]);
  };

  if (profileLoading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: Colors.muted, fontFamily: Fonts.mono }}>Carregando perfil...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={Colors.accent} />
      }
    >
      {/* COVER */}
      <View style={[styles.cover, { paddingTop: insets.top }]}>
        <LinearGradient colors={['#1a1042', Colors.purple + '60', Colors.bg]} style={StyleSheet.absoluteFill} />
        <View style={styles.coverTopRow}>
          {!isMyProfile && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
              <Text style={{ color: Colors.text, fontSize: 20 }}>←</Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }} />
          {isMyProfile && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Settings')}>
              <Text style={{ fontSize: 20 }}>⚙️</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* AVATAR + INFO */}
      <View style={styles.profileInfo}>
        <View style={styles.avatarRow}>
          <Avatar user={{ username: profile?.username, displayName: profile?.display_name, avatarUrl: profile?.avatar_url } as any} size={80} />
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>LVL</Text>
            <Text style={styles.levelNum}>{profile?.level ?? 1}</Text>
          </View>
        </View>

        <Text style={styles.displayName}>{profile?.display_name ?? profile?.username}</Text>
        <Text style={styles.username}>@{profile?.username}</Text>
        {profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}

        <XPBar xp={profile?.xp ?? 0} level={profile?.level ?? 1} />
        <Text style={styles.xpText}>{profile?.xp ?? 0} XP</Text>

        {/* STATS */}
        <View style={styles.statsRow}>
          {[
            { label: 'Seguidores', value: profile?.followers_count ?? 0, onPress: () => navigation.navigate('Followers', { userId }) },
            { label: 'Seguindo',   value: profile?.following_count ?? 0, onPress: () => navigation.navigate('Following', { userId }) },
            { label: 'Jogos',      value: profile?.games_count ?? backlog.length, onPress: () => setActiveTab('backlog') },
            { label: 'Horas',      value: profile?.hours_played ?? 0, onPress: () => {} },
          ].map((s, i) => (
            <TouchableOpacity key={i} style={styles.stat} onPress={s.onPress}>
              <Text style={styles.statNum}>
                {s.value >= 1000 ? `${(s.value / 1000).toFixed(1)}k` : s.value}
              </Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ACTIONS */}
        {isMyProfile ? (
          <View style={styles.actionsRow}>
            <Button
              label="✏️ Editar perfil"
              onPress={() => navigation.navigate('EditProfile')}
              variant="outline"
              style={{ flex: 1 }}
            />
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={() => Share.share({ message: `Confira o perfil de @${profile?.username} no Backlog Network!`, url: `https://backlognetwork.app/u/${profile?.username}` })}
            >
              <Text style={styles.shareIcon}>⬆</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.followAction, following && styles.followActionActive]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); followMutation.mutate(); }}
            >
              <Text style={[styles.followActionText, following && { color: Colors.text }]}>
                {following ? '✓ Seguindo' : '+ Seguir'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.msgAction} onPress={() => navigation.navigate('Messages')}>
              <Text style={{ fontSize: 18 }}>💬</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* QUICK STATS */}
        <View style={styles.quickStats}>
          {Object.entries(stats).map(([status, count]) => {
            const cfg = STATUS_CONFIG[status];
            return (
              <View key={status} style={[styles.quickStat, { borderColor: cfg.color + '40', backgroundColor: cfg.color + '10' }]}>
                <Text style={{ fontSize: 16 }}>{cfg.emoji}</Text>
                <Text style={[styles.quickStatNum, { color: cfg.color }]}>{count}</Text>
                <Text style={styles.quickStatLabel}>{cfg.label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* TABS */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: 8 }}>
        {([
          { key: 'backlog',  label: '🎮 Backlog' },
          { key: 'reviews',  label: '✍️ Reviews' },
          { key: 'listas',   label: '📋 Listas' },
        ] as const).map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabChip, activeTab === t.key && styles.tabChipActive]}
            onPress={() => { Haptics.selectionAsync(); setActiveTab(t.key); }}
          >
            <Text style={[styles.tabChipText, activeTab === t.key && styles.tabChipTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.tabContent}>
        {/* BACKLOG */}
        {activeTab === 'backlog' && (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }} contentContainerStyle={{ gap: 8 }}>
              {(['all', 'playing', 'finished', 'backlog', 'dropped', 'wishlist'] as BacklogFilter[]).map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.filterChip, backlogFilter === s && styles.filterChipActive]}
                  onPress={() => { Haptics.selectionAsync(); setBacklogFilter(s); }}
                >
                  <Text style={[styles.filterChipText, backlogFilter === s && styles.filterChipTextActive]}>
                    {s === 'all' ? 'Todos' : STATUS_CONFIG[s]?.label ?? s}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {filteredBacklog.length === 0
              ? <EmptyState emoji="📦" title="Nada aqui" subtitle="Adicione jogos ao seu backlog!" />
              : filteredBacklog.map((item: any) => (
                  <BacklogItem
                    key={item.id} item={item}
                    onPress={() => navigation.navigate('GameDetail', { gameId: item.game_id })}
                  />
                ))
            }
          </View>
        )}

        {/* REVIEWS */}
        {activeTab === 'reviews' && (
          <View>
            <TouchableOpacity
              style={styles.writeReviewBtn}
              onPress={() => navigation.navigate('ReviewCreate')}
            >
              <LinearGradient colors={[Colors.accent + '20', Colors.accent + '05']} style={styles.writeReviewGradient}>
                <Text style={{ fontSize: 20 }}>✍️</Text>
                <Text style={styles.writeReviewText}>Escrever nova review</Text>
              </LinearGradient>
            </TouchableOpacity>
            {reviews.length === 0
              ? <EmptyState emoji="✍️" title="Sem reviews ainda" subtitle="Escreva sua primeira review!" />
              : reviews.map((rv: any) => (
                  <ReviewItem key={rv.id} review={rv} onPress={() => navigation.navigate('ReviewDetail', { reviewId: rv.id })} />
                ))
            }
          </View>
        )}

        {/* LISTAS */}
        {activeTab === 'listas' && (
          <View>
            <EmptyState emoji="📋" title="Sem listas ainda" subtitle="Crie sua primeira lista de jogos!" />
            <Button label="+ Criar lista" onPress={() => navigation.navigate('CreateList')} style={{ marginTop: Spacing.lg }} />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  cover: { height: 140 },
  coverTopRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingTop: 8 },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  profileInfo: { paddingHorizontal: Spacing.lg, marginTop: -40 },
  avatarRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: Spacing.md },
  levelBadge: { backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: Colors.accent + '50' },
  levelText: { fontFamily: Fonts.monoBold, fontSize: 8, color: Colors.accent, letterSpacing: 2 },
  levelNum: { fontFamily: Fonts.display, fontSize: 24, color: Colors.accent, lineHeight: 26 },
  displayName: { fontFamily: Fonts.display, fontSize: 26, letterSpacing: 0.5, color: Colors.text, marginBottom: 2 },
  username: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted, marginBottom: Spacing.sm },
  bio: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.md },
  xpBar: { height: 4, backgroundColor: Colors.surface, borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  xpFill: { height: 4, backgroundColor: Colors.accent, borderRadius: 2 },
  xpText: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, marginBottom: Spacing.md },
  statsRow: { flexDirection: 'row', borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.xl, overflow: 'hidden', marginBottom: Spacing.md },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRightWidth: 1, borderRightColor: Colors.border },
  statNum: { fontFamily: Fonts.display, fontSize: 20, color: Colors.text },
  statLabel: { fontFamily: Fonts.mono, fontSize: 9, color: Colors.muted, marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.md },
  followAction: { flex: 1, paddingVertical: 12, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.accent, alignItems: 'center' },
  followActionActive: { backgroundColor: Colors.accent + '15' },
  followActionText: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.accent },
  msgAction: { width: 48, height: 48, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  shareBtn: { width: 48, height: 48, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  shareIcon: { fontSize: 16, color: Colors.text, fontWeight: '600' },
  quickStats: { flexDirection: 'row', gap: 8, marginBottom: Spacing.lg, flexWrap: 'wrap' },
  quickStat: { flex: 1, minWidth: 70, alignItems: 'center', paddingVertical: 10, borderRadius: Radius.lg, borderWidth: 1, gap: 2 },
  quickStatNum: { fontFamily: Fonts.display, fontSize: 20 },
  quickStatLabel: { fontFamily: Fonts.mono, fontSize: 9, color: Colors.muted },
  tabsScroll: { marginBottom: Spacing.md },
  tabChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  tabChipActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '15' },
  tabChipText: { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.muted },
  tabChipTextActive: { color: Colors.accent },
  tabContent: { paddingHorizontal: Spacing.lg },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { borderColor: Colors.accent },
  filterChipText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  filterChipTextActive: { color: Colors.accent },
  backlogItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backlogCover: { width: 52, height: 68, borderRadius: Radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  backlogInfo: { flex: 1 },
  backlogTitle: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text, marginBottom: 2 },
  backlogDev: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, marginBottom: 4 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  progressBar: { flex: 1, height: 3, backgroundColor: Colors.surface, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 3, backgroundColor: Colors.purple, borderRadius: 2 },
  progressText: { fontFamily: Fonts.mono, fontSize: 9, color: Colors.purple },
  backlogHours: { fontFamily: Fonts.mono, fontSize: 9, color: Colors.muted },
  statusDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  writeReviewBtn: { borderRadius: Radius.xl, overflow: 'hidden', marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.accent + '40' },
  writeReviewGradient: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.md },
  writeReviewText: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text },
  reviewCard: { backgroundColor: Colors.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, marginBottom: 10, ...Shadows.card },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.sm },
  reviewCover: { width: 44, height: 44, borderRadius: Radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  reviewGame: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text, marginBottom: 4 },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  star: { fontSize: 10, color: Colors.border },
  starFilled: { color: Colors.amber },
  ratingNum: { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.amber, marginLeft: 4 },
  reviewTime: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, marginLeft: 'auto' as any },
  reviewBody: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: Spacing.sm },
  reviewLikes: { fontFamily: Fonts.bodyMedium, fontSize: 12, color: Colors.muted },
});
