import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';

import { Colors, Fonts, Spacing, Radius, Shadows } from '../../theme';
import { Share } from 'react-native';
import { Avatar, Button, EmptyState } from '../../components';
import { useAuthStore } from '../../store/authStore';
import { usersService, backlogService, reviewsService, listsService, feedService } from '../../services/api';
import { timeAgo } from '../../utils/helpers';

type ProfileTab = 'posts' | 'backlog' | 'reviews' | 'listas';
type BacklogFilter = 'all' | 'playing' | 'finished' | 'backlog' | 'dropped' | 'wishlist';

const STATUS_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  playing:  { label: 'Jogando',  color: Colors.purple, emoji: '🎮' },
  finished: { label: 'Zerado',   color: Colors.accent,  emoji: '✅' },
  backlog:  { label: 'Backlog',  color: Colors.amber,   emoji: '📦' },
  dropped:  { label: 'Largado',  color: Colors.red,     emoji: '💀' },
  wishlist: { label: 'Desejo',   color: Colors.teal,    emoji: '⭐' },
};


function XPBar({ xp, level }: { xp: number; level: number }) {
  const nextLevelXp = level * 500;
  const progress = Math.min((xp % nextLevelXp) / nextLevelXp, 1);
  return (
    <View style={styles.xpBar}>
      <View style={[styles.xpFill, { width: `${progress * 100}%` as any }]} />
    </View>
  );
}

// ─── POST CARD ────────────────────────────────────────────────────────────────
function PostCard({ post, profile }: { post: any; profile: any }) {
  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <Avatar user={{ username: profile?.username, displayName: profile?.display_name ?? profile?.username, avatarUrl: profile?.avatar_url } as any} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={styles.postName}>{profile?.display_name ?? profile?.username}</Text>
          <Text style={styles.postTime}>@{profile?.username} · {timeAgo(post.created_at)}</Text>
        </View>
      </View>
      {post.content && <Text style={styles.postText}>{post.content}</Text>}
      {post.game_title && (
        <View style={styles.postGameTag}>
          <Text style={styles.postGameTagText}>🎮 {post.game_title}</Text>
          {post.status && <Text style={[styles.postStatusBadge, { color: STATUS_CONFIG[post.status]?.color ?? Colors.muted }]}>{STATUS_CONFIG[post.status]?.label ?? post.status}</Text>}
        </View>
      )}
      <View style={styles.postFooter}>
        <Text style={styles.postAction}>♥ {post.likes_count ?? 0}</Text>
        <Text style={styles.postAction}>💬 {post.comments_count ?? 0}</Text>
      </View>
    </View>
  );
}

// ─── BACKLOG ITEM ─────────────────────────────────────────────────────────────
function BacklogItem({ item, onPress }: { item: any; onPress: () => void }) {
  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.backlog;
  const cover = item.game_cover ?? item.cover_url;
  return (
    <TouchableOpacity style={styles.backlogItem} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.backlogCover}>
        {cover
          ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill as any} contentFit="cover" />
          : <LinearGradient colors={['#1a1628', '#0d0d14']} style={StyleSheet.absoluteFill} />
        }
        <Text style={{ fontSize: 22, position: 'absolute' }}>{!cover ? '🎮' : ''}</Text>
      </View>
      <View style={styles.backlogInfo}>
        <Text style={styles.backlogTitle} numberOfLines={1}>{item.game_title ?? item.title}</Text>
        <Text style={styles.backlogDev} numberOfLines={1}>{item.developer ?? ''}</Text>
        {item.hours_played > 0 && <Text style={styles.backlogHours}>⏱ {item.hours_played}h</Text>}
      </View>
      <View style={[styles.statusDot, { backgroundColor: cfg.color + '30', borderColor: cfg.color }]}>
        <Text style={{ fontSize: 12 }}>{cfg.emoji}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── REVIEW CARD ─────────────────────────────────────────────────────────────
function ReviewCard({ review, onPress }: { review: any; onPress: () => void }) {
  const cover = review.game_cover ?? review.cover_url;
  return (
    <TouchableOpacity style={styles.reviewCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.reviewCoverSquare}>
        {cover
          ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill as any} contentFit="cover" />
          : <LinearGradient colors={['#1a1628', '#0d0d14']} style={StyleSheet.absoluteFill}><Text style={styles.reviewCoverEmoji}>🎮</Text></LinearGradient>
        }
      </View>
      <View style={styles.reviewInfo}>
        <Text style={styles.reviewGame} numberOfLines={2}>{review.game_title ?? review.game?.title}</Text>
        {review.title && <Text style={styles.reviewTitle} numberOfLines={1}>{review.title}</Text>}
        <View style={styles.starsRow}>
          {Array(10).fill(0).map((_, i) => (
            <Text key={i} style={[styles.star, i < Math.round(review.rating) && styles.starFilled]}>★</Text>
          ))}
          <Text style={styles.ratingNum}>{review.rating}</Text>
        </View>
        <Text style={styles.reviewBody} numberOfLines={2}>{review.body}</Text>
        <View style={styles.reviewFooter}>
          <Text style={styles.reviewLikes}>♥ {review.likes_count ?? 0}</Text>
          <Text style={styles.reviewTime}>{timeAgo(review.created_at)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── LIST CARD ────────────────────────────────────────────────────────────────
function ListCard({ list, onPress }: { list: any; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.listCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.listIcon}><Text style={{ fontSize: 22 }}>📋</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.listTitle}>{list.title}</Text>
        {list.description && <Text style={styles.listDesc} numberOfLines={1}>{list.description}</Text>}
        <Text style={styles.listMeta}>{list.items_count ?? 0} jogos · {list.is_public ? '🌍 Pública' : '🔒 Privada'}</Text>
      </View>
      <Text style={styles.listArrow}>›</Text>
    </TouchableOpacity>
  );
}

// ─── PROFILE SCREEN ──────────────────────────────────────────────────────────
export default function ProfileScreen({ route }: any) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user: authUser, logout } = useAuthStore();
  const queryClient = useQueryClient();

  const routeUserId = route?.params?.userId;
  const isMyProfile = !routeUserId || String(routeUserId) === String(authUser?.id);
  const userId = isMyProfile ? String(authUser?.id) : String(routeUserId);

  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [backlogFilter, setBacklogFilter] = useState<BacklogFilter>('all');
  const [following, setFollowing] = useState(false);

  const { data: profileData, isLoading: profileLoading, refetch: refetchProfile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => usersService.getProfile(userId!),
    enabled: !!userId,
    select: (res: any) => res.data ?? res,
  });

  React.useEffect(() => {
    if (profileData?.is_following !== undefined) setFollowing(!!profileData.is_following);
  }, [profileData?.is_following]);

  // Posts with infinite scroll
  const {
    data: postsData,
    fetchNextPage: fetchNextPosts,
    hasNextPage: hasMorePosts,
    isFetchingNextPage: loadingMorePosts,
    isLoading: postsLoading,
  } = useInfiniteQuery({
    queryKey: ['user-posts', userId],
    queryFn: ({ pageParam = 1 }) => usersService.getUserPosts(userId!, pageParam as number),
    getNextPageParam: (last: any, pages) => {
      const hasMore = last?.has_more ?? last?.meta?.last_page > pages.length;
      return hasMore ? pages.length + 1 : undefined;
    },
    enabled: !!userId && activeTab === 'posts',
    initialPageParam: 1,
  });

  const posts = postsData?.pages.flatMap((p: any) => {
    const raw = p?.data ?? p ?? [];
    return Array.isArray(raw) ? raw : [];
  }) ?? [];

  const { data: backlogData, refetch: refetchBacklog } = useQuery({
    queryKey: ['backlog', userId],
    queryFn: () => backlogService.getBacklog(userId!),
    enabled: !!userId && activeTab === 'backlog',
    select: (res: any) => res.data?.data ?? res.data ?? [],
  });

  const { data: reviewsData, refetch: refetchReviews } = useQuery({
    queryKey: ['reviews', userId],
    queryFn: () => isMyProfile
      ? reviewsService.getMyReviews()
      : reviewsService.getUserReviews(userId!),
    enabled: !!userId && activeTab === 'reviews',
    select: (res: any) => res.data?.data ?? res.data ?? [],
  });

  const { data: listsData, refetch: refetchLists } = useQuery({
    queryKey: ['user-lists', userId],
    queryFn: () => listsService.getUserLists(userId!),
    enabled: !!userId && activeTab === 'listas',
    select: (res: any) => res.data?.data ?? res.data ?? [],
  });

  const followMutation = useMutation({
    mutationFn: () => following ? usersService.unfollow(userId!) : usersService.follow(userId!),
    onSuccess: () => {
      setFollowing(!following);
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
  });

  const profile = profileData ?? authUser;
  const backlog = backlogData ?? [];
  const reviews = reviewsData ?? [];
  const lists = listsData ?? [];

  const filteredBacklog = backlogFilter === 'all' ? backlog : backlog.filter((b: any) => b.status === backlogFilter);
  const stats = {
    playing:  backlog.filter((b: any) => b.status === 'playing').length,
    finished: backlog.filter((b: any) => b.status === 'finished').length,
    backlog:  backlog.filter((b: any) => b.status === 'backlog').length,
    dropped:  backlog.filter((b: any) => b.status === 'dropped').length,
  };

  const handleRefresh = async () => {
    await Promise.all([refetchProfile(), refetchBacklog(), refetchReviews(), refetchLists()]);
  };

  // ─── HEADER component (shared for FlatList) ────────────────────────────
  const ListHeader = () => (
    <View>
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
          <Avatar user={{ username: profile?.username, displayName: profile?.display_name ?? profile?.username, avatarUrl: profile?.avatar_url } as any} size={80} />
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

        <View style={styles.statsRow}>
          {[
            { label: 'Seguidores', value: profile?.followers_count ?? 0 },
            { label: 'Seguindo',   value: profile?.following_count ?? 0 },
            { label: 'Jogos',      value: profile?.games_count ?? backlog.length },
            { label: 'Horas',      value: profile?.hours_played ?? 0 },
          ].map((s, i) => (
            <View key={i} style={styles.stat}>
              <Text style={styles.statNum}>{s.value >= 1000 ? `${(s.value / 1000).toFixed(1)}k` : s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {isMyProfile ? (
          <View style={styles.actionsRow}>
            <Button label="✏️ Editar perfil" onPress={() => navigation.navigate('EditProfile')} variant="outline" style={{ flex: 1 }} />
            <TouchableOpacity style={styles.shareBtn} onPress={() => Share.share({ message: `Confira @${profile?.username} no Backlog Network!` })}>
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
          { key: 'posts',   label: '📝 Posts' },
          { key: 'backlog', label: '🎮 Backlog' },
          { key: 'reviews', label: '✍️ Reviews' },
          { key: 'listas',  label: '📋 Listas' },
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

      {/* BACKLOG FILTERS */}
      {activeTab === 'backlog' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.md }} contentContainerStyle={{ gap: 8 }}>
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
      )}

      {/* REVIEWS WRITE BUTTON */}
      {activeTab === 'reviews' && (
        <TouchableOpacity style={[styles.writeReviewBtn, { marginHorizontal: Spacing.lg }]} onPress={() => navigation.navigate('ReviewCreate')}>
          <LinearGradient colors={[Colors.accent + '20', Colors.accent + '05']} style={styles.writeReviewGradient}>
            <Text style={{ fontSize: 20 }}>✍️</Text>
            <Text style={styles.writeReviewText}>Escrever nova review</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* LISTAS CREATE BUTTON */}
      {activeTab === 'listas' && (
        <TouchableOpacity style={[styles.writeReviewBtn, { marginHorizontal: Spacing.lg }]} onPress={() => navigation.navigate('CreateList')}>
          <LinearGradient colors={[Colors.teal + '20', Colors.teal + '05']} style={styles.writeReviewGradient}>
            <Text style={{ fontSize: 20 }}>📋</Text>
            <Text style={styles.writeReviewText}>Criar nova lista</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );

  // ─── ITEMS ────────────────────────────────────────────────────────────────
  const getItems = () => {
    if (activeTab === 'posts') return posts;
    if (activeTab === 'backlog') return filteredBacklog;
    if (activeTab === 'reviews') return reviews;
    if (activeTab === 'listas') return lists;
    return [];
  };

  const renderItem = ({ item }: { item: any }) => {
    if (activeTab === 'posts') return <PostCard post={item} profile={profile} />;
    if (activeTab === 'backlog') return <BacklogItem item={item} onPress={() => navigation.navigate('GameDetail', { gameId: item.game_id })} />;
    if (activeTab === 'reviews') return <ReviewCard review={item} onPress={() => navigation.navigate('ReviewDetail', { reviewId: item.id })} />;
    if (activeTab === 'listas') return <ListCard list={item} onPress={() => navigation.navigate('ListDetail', { listId: item.id, list: item })} />;
    return null;
  };

  const getEmptyState = () => {
    if (activeTab === 'posts') return <EmptyState emoji="📝" title="Sem posts ainda" subtitle="Publique algo no feed!" />;
    if (activeTab === 'backlog') return <EmptyState emoji="📦" title="Backlog vazio" subtitle="Adicione jogos ao seu backlog!" />;
    if (activeTab === 'reviews') return <EmptyState emoji="✍️" title="Sem reviews ainda" subtitle="Escreva sua primeira review!" />;
    if (activeTab === 'listas') return <EmptyState emoji="📋" title="Sem listas" subtitle="Crie sua primeira lista de jogos!" />;
    return null;
  };

  if (profileLoading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={getItems()}
      keyExtractor={(item: any, i) => String(item?.id ?? i)}
      renderItem={renderItem}
      ListHeaderComponent={<ListHeader />}
      ListEmptyComponent={getEmptyState}
      ListFooterComponent={
        activeTab === 'posts' && hasMorePosts ? (
          <TouchableOpacity style={styles.loadMoreBtn} onPress={() => fetchNextPosts()}>
            {loadingMorePosts
              ? <ActivityIndicator color={Colors.accent} size="small" />
              : <Text style={styles.loadMoreText}>Carregar mais posts</Text>
            }
          </TouchableOpacity>
        ) : null
      }
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={Colors.accent} />}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  cover: { height: 140 },
  coverTopRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingTop: 8 },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  profileInfo: { paddingHorizontal: Spacing.lg, marginTop: -40, paddingBottom: Spacing.md },
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
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { borderColor: Colors.accent },
  filterChipText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  filterChipTextActive: { color: Colors.accent },

  // Posts
  postCard: { marginHorizontal: Spacing.lg, backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.sm },
  postName: { fontFamily: Fonts.bodyBold, fontSize: 13, color: Colors.text },
  postTime: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  postText: { fontFamily: Fonts.body, fontSize: 14, color: Colors.text, lineHeight: 20, marginBottom: Spacing.sm },
  postGameTag: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 6, marginBottom: Spacing.sm, alignSelf: 'flex-start' },
  postGameTagText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.text },
  postStatusBadge: { fontFamily: Fonts.monoBold, fontSize: 10 },
  postFooter: { flexDirection: 'row', gap: 16 },
  postAction: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted },

  // Backlog
  backlogItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backlogCover: { width: 52, height: 68, borderRadius: Radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },
  backlogInfo: { flex: 1 },
  backlogTitle: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text, marginBottom: 2 },
  backlogDev: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, marginBottom: 4 },
  backlogHours: { fontFamily: Fonts.mono, fontSize: 9, color: Colors.muted },
  statusDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },

  // Reviews
  reviewCard: { flexDirection: 'row', marginHorizontal: Spacing.lg, backgroundColor: Colors.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  reviewCoverSquare: { width: 90, alignSelf: 'stretch', backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  reviewCoverEmoji: { fontSize: 28, position: 'absolute' },
  reviewInfo: { flex: 1, padding: Spacing.md },
  reviewGame: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text, marginBottom: 2 },
  reviewTitle: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textSecondary, marginBottom: 4, fontStyle: 'italic' },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 1, marginBottom: 4 },
  star: { fontSize: 10, color: Colors.border },
  starFilled: { color: Colors.amber },
  ratingNum: { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.amber, marginLeft: 4 },
  reviewBody: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  reviewFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  reviewLikes: { fontFamily: Fonts.bodyMedium, fontSize: 11, color: Colors.muted },
  reviewTime: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },

  // Lists
  listCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.lg, gap: 12, backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  listIcon: { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  listTitle: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text, marginBottom: 2 },
  listDesc: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, marginBottom: 2 },
  listMeta: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  listArrow: { fontFamily: Fonts.mono, fontSize: 20, color: Colors.muted },

  writeReviewBtn: { borderRadius: Radius.xl, overflow: 'hidden', marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.accent + '40' },
  writeReviewGradient: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.md },
  writeReviewText: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text },

  loadMoreBtn: { alignSelf: 'center', marginVertical: 16, paddingHorizontal: 28, paddingVertical: 12, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.accent },
  loadMoreText: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.accent },
});
