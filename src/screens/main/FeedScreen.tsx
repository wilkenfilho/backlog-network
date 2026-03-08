import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, Pressable, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';

import { Colors, Fonts, Spacing, Radius, Shadows, Typography } from '../../theme';
import { Avatar, StatusBadge, GameCover, StarRating, ProgressBar, EmptyState, Skeleton } from '../../components';
import { feedService } from '../../services/api';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import type { Post, GameStatus } from '../../types';

// ─── MOCK DATA (substituir com API real) ──────────────────────────────────────
const MOCK_POSTS: Post[] = [
  {
    id: '1',
    type: 'status_update',
    status: 'finished' as GameStatus,
    user: { id: 'u1', username: 'gabrielsousa', displayName: 'Gabriel Sousa', level: 24, xp: 8400, followersCount: 312, followingCount: 88, gamesCount: 94, reviewsCount: 31, hoursPlayed: 1240, badges: [], createdAt: '', isFollowing: false },
    game: { id: 'g1', title: 'Elden Ring', developer: 'FromSoftware', genres: ['RPG', 'Action'], platforms: ['PS5', 'PC'] },
    text: 'Finalmente! Depois de 96 horas e 3 builds diferentes, os Anéis estão quebrados 🔥 Malenia foi a boss mais desafiadora que já enfrentei.',
    progress: 78,
    hoursPlayed: 96,
    likesCount: 247, commentsCount: 38, sharesCount: 12, isLiked: true,
    createdAt: new Date(Date.now() - 23 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    type: 'review',
    status: 'finished' as GameStatus,
    user: { id: 'u2', username: 'mari_rpg', displayName: 'Mari RPG', level: 37, xp: 14200, followersCount: 891, followingCount: 120, gamesCount: 187, reviewsCount: 84, hoursPlayed: 4100, badges: [], createdAt: '', isFollowing: true },
    game: { id: 'g2', title: 'Hollow Knight: Silksong', developer: 'Team Cherry', genres: ['Platformer', 'Action'], platforms: ['PC', 'Nintendo Switch'] },
    review: { id: 'r1', rating: 10, body: 'Silksong entregou tudo que esperava e mais. A evolução de Hornet é deliciosa.', spoiler: false, likesCount: 183, commentsCount: 54, isLiked: false, createdAt: '', updatedAt: '', user: {} as any, game: {} as any },
    text: 'Se você gosta de metroidvania, esse é o jogo da geração. A trilha sonora é absolutamente perfeita.',
    likesCount: 183, commentsCount: 54, sharesCount: 29, isLiked: false,
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    type: 'status_update',
    status: 'playing' as GameStatus,
    user: { id: 'u3', username: 'thalita_gamer', displayName: 'Thalita', level: 12, xp: 3100, followersCount: 145, followingCount: 67, gamesCount: 43, reviewsCount: 9, hoursPlayed: 680, badges: [], createdAt: '', isFollowing: true },
    game: { id: 'g3', title: "Baldur's Gate 3", developer: 'Larian Studios', genres: ['RPG'], platforms: ['PC'] },
    text: 'Acabei de terminar o Ato 1. Shadowheart com Warlock? Build insana 😂 Alguém tem dica pra Underdark sem spoiler?',
    progress: 22,
    hoursPlayed: 34,
    likesCount: 92, commentsCount: 21, sharesCount: 7, isLiked: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  return `há ${Math.floor(diff / 86400)}d`;
}

// ─── POST CARD ────────────────────────────────────────────────────────────────
function PostCard({ post, onLike, onComment, onShare, onGamePress, onUserPress }: {
  post: Post;
  onLike: (id: string) => void;
  onComment: (id: string) => void;
  onShare: (id: string) => void;
  onGamePress: (game: any) => void;
  onUserPress: (user: any) => void;
}) {
  const [liked, setLiked] = useState(post.isLiked ?? false);
  const [likeCount, setLikeCount] = useState(post.likesCount);
  const likeScale = useRef(new Animated.Value(1)).current;

  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.spring(likeScale, { toValue: 1.35, useNativeDriver: true, speed: 50 }),
      Animated.spring(likeScale, { toValue: 1, useNativeDriver: true, speed: 30 }),
    ]).start();
    setLiked(!liked);
    setLikeCount(c => liked ? c - 1 : c + 1);
    onLike(post.id);
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <Avatar user={post.user} size={40} onPress={() => onUserPress(post.user)} />
        <View style={styles.cardHeaderInfo}>
          <TouchableOpacity onPress={() => onUserPress(post.user)}>
            <Text style={styles.cardUsername}>{post.user.displayName}</Text>
          </TouchableOpacity>
          <Text style={styles.cardTime}>{timeAgo(post.createdAt)}</Text>
        </View>
        <StatusBadge status={post.status ?? 'playing'} />
        <TouchableOpacity style={styles.moreBtn}>
          <Text style={{ color: Colors.muted, fontSize: 18, lineHeight: 18 }}>···</Text>
        </TouchableOpacity>
      </View>

      {/* Game block */}
      {post.game && (
        <TouchableOpacity
          style={styles.gameBlock}
          onPress={() => onGamePress(post.game)}
          activeOpacity={0.8}
        >
          <GameCover game={post.game} width={72} height={92} borderRadius={0} />
          <View style={styles.gameInfo}>
            <Text style={styles.gameTitle} numberOfLines={2}>{post.game.title}</Text>
            <Text style={styles.gameDev} numberOfLines={1}>{post.game.developer}</Text>
            {post.hoursPlayed != null && (
              <View style={styles.gameStat}>
                <Text style={styles.gameStatText}>⏱ {post.hoursPlayed}h jogadas</Text>
              </View>
            )}
            {post.type === 'review' && post.review && (
              <StarRating rating={post.review.rating} />
            )}
            <View style={styles.platformRow}>
              {post.game.platforms?.slice(0, 3).map(p => (
                <View key={p} style={styles.platformBadge}>
                  <Text style={styles.platformText}>{p}</Text>
                </View>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Text */}
      {post.text && (
        <Text style={styles.cardText}>{post.text}</Text>
      )}

      {/* Progress bar */}
      {post.progress != null && post.status === 'finished' && (
        <View style={styles.progressBlock}>
          <ProgressBar
            progress={post.progress}
            label="Progresso da platina"
            color={Colors.accent}
          />
        </View>
      )}
      {post.progress != null && post.status === 'playing' && (
        <View style={styles.progressBlock}>
          <ProgressBar
            progress={post.progress}
            label="Progresso"
            color={Colors.purple}
          />
        </View>
      )}

      {/* Footer actions */}
      <View style={styles.cardFooter}>
        <Animated.View style={{ transform: [{ scale: likeScale }] }}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
            <Text style={[styles.actionIcon, liked && { color: Colors.red }]}>
              {liked ? '♥' : '♡'}
            </Text>
            <Text style={[styles.actionCount, liked && { color: Colors.red }]}>
              {likeCount}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity style={styles.actionBtn} onPress={() => onComment(post.id)}>
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionCount}>{post.commentsCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => onShare(post.id)}>
          <Text style={styles.actionIcon}>↗</Text>
          <Text style={styles.actionCount}>{post.sharesCount}</Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <TouchableOpacity style={styles.bookmarkBtn}>
          <Text style={{ color: Colors.muted, fontSize: 18 }}>🔖</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── STORIES ──────────────────────────────────────────────────────────────────
function StoriesRow() {
  const navigation = useNavigation<any>();
  const { data: storiesData } = useQuery({
    queryKey: ['stories'],
    queryFn: async () => {
      try { return (await api.get('/stories')).data; } catch { return { data: [] }; }
    },
    select: (res: any) => res.data ?? [],
  });
  const stories = storiesData ?? [];

  // Group by user
  const userStories: Record<string, any> = {};
  stories.forEach((s: any) => {
    if (!userStories[s.user_id]) userStories[s.user_id] = { ...s, count: 1 };
    else userStories[s.user_id].count++;
  });
  const grouped = Object.values(userStories);

  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={grouped}
      keyExtractor={(item: any) => item.id}
      contentContainerStyle={styles.storiesContainer}
      ListHeaderComponent={() => (
        <TouchableOpacity style={styles.storyItem} activeOpacity={0.8} onPress={() => navigation.navigate('CreatePost')}>
          <View style={[styles.storyRing, { borderColor: Colors.border, borderWidth: 2, borderStyle: 'dashed' }]}>
            <View style={styles.storyAvatarPlaceholder}>
              <Text style={{ color: Colors.muted, fontSize: 22 }}>+</Text>
            </View>
          </View>
          <Text style={styles.storyName}>Você</Text>
        </TouchableOpacity>
      )}
      renderItem={({ item }: any) => (
        <TouchableOpacity style={styles.storyItem} activeOpacity={0.8}>
          <LinearGradient colors={[Colors.accent, Colors.purple]} style={styles.storyRing}>
            <Avatar user={{ username: item.username, displayName: item.display_name, avatarUrl: item.avatar_url } as any} size={50} />
          </LinearGradient>
          <Text style={styles.storyName} numberOfLines={1}>{item.display_name ?? item.username}</Text>
        </TouchableOpacity>
      )}
      ListEmptyComponent={null}
    />
  );
}

// ─── COMPOSER STRIP ──────────────────────────────────────────────────────────
function ComposerStrip({ user, onPostPress, onReviewPress, onStatusPress }: { user: any; onPostPress: () => void; onReviewPress: () => void; onStatusPress: () => void }) {
  return (
    <View style={styles.composerWrapper}>
      <TouchableOpacity style={styles.composerMain} onPress={onPostPress} activeOpacity={0.85}>
        <Avatar user={user} size={36} />
        <View style={styles.composerInput}>
          <Text style={styles.composerPlaceholder}>O que você tá jogando?</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.composerActions}>
        <TouchableOpacity style={styles.composerActionBtn} onPress={onReviewPress}>
          <Text style={styles.composerActionText}>✍️ Escrever review</Text>
        </TouchableOpacity>
        <View style={styles.composerDivider} />
        <TouchableOpacity style={styles.composerActionBtn} onPress={onStatusPress}>
          <Text style={styles.composerActionText}>🎮 Status de jogo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── FEED SCREEN ─────────────────────────────────────────────────────────────
export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'friends' | 'global' | 'following'>('friends');
  const [refreshing, setRefreshing] = useState(false);

  const { data: feedData, refetch, isRefetching } = useQuery({
    queryKey: ['feed', activeTab],
    queryFn: () => feedService.getFeed({ filter: activeTab }),
    select: (res: any) => {
      const raw = res.data?.data ?? res.data ?? [];
      return raw.map((p: any) => ({
        ...p,
        id: p.id,
        text: p.content ?? p.text,
        user: {
          id: p.user_id,
          username: p.username,
          displayName: p.display_name,
          avatarUrl: p.avatar_url,
          level: p.level ?? 1,
        },
        game: p.game_id ? {
          id: p.game_id,
          title: p.game_title ?? p.game_name,
          developer: p.game_dev,
          coverUrl: p.game_cover,
        } : null,
        isLiked: !!p.liked_by_me,
        likesCount: p.likes_count ?? 0,
        commentsCount: p.comments_count ?? 0,
        sharesCount: 0,
        createdAt: p.created_at,
      }));
    },
  });

  const posts = feedData ?? MOCK_POSTS;

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleLike = (postId: string) => {
    feedService.likePost(postId);
  };

  const handleComment = (postId: string) => {
    navigation.navigate('Comments', { postId });
  };

  const handleShare = (postId: string) => {
    // Share.share(...)
  };

  const handleGamePress = (game: any) => {
    navigation.navigate('GameDetail', { gameId: game.id, game });
  };

  const handleUserPress = (postUser: any) => {
    navigation.navigate('UserProfile', { userId: postUser.id, username: postUser.username });
  };

  const ListHeader = () => (
    <View>
      {/* Stories */}
      <StoriesRow />

      {/* Composer */}
      <ComposerStrip
        user={user ?? { username: 'WP', displayName: 'Wilken P.' }}
        onPostPress={() => navigation.navigate('CreatePost')}
        onReviewPress={() => navigation.navigate('ReviewCreate')}
        onStatusPress={() => navigation.navigate('CreatePost', { mode: 'status' })}
      />

      {/* Feed tabs */}
      <View style={styles.tabsRow}>
        {(['friends', 'global', 'following'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab(tab);
            }}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'friends' ? 'Amigos' : tab === 'global' ? 'Global' : 'Seguindo'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <BlurView intensity={60} tint="dark" style={styles.header}>
        <Text style={styles.headerTitle}>FEED</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Text style={{ fontSize: 20 }}>🔔</Text>
            <View style={styles.notifDot} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.navigate('Search')}
          >
            <Text style={{ fontSize: 20 }}>🔍</Text>
          </TouchableOpacity>
        </View>
      </BlurView>

      {/* Feed list */}
      <FlatList
        data={posts}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onLike={handleLike}
            onComment={handleComment}
            onShare={handleShare}
            onGamePress={handleGamePress}
            onUserPress={handleUserPress}
          />
        )}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontFamily: Fonts.display, fontSize: 28, letterSpacing: 3, color: Colors.text },
  headerRight: { flexDirection: 'row', gap: 4 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md, position: 'relative' },
  notifDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.red, borderWidth: 2, borderColor: Colors.bg },

  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },

  // Stories
  storiesContainer: { paddingVertical: Spacing.md, gap: 14 },
  storyItem: { alignItems: 'center', gap: 6 },
  storyRing: { width: 62, height: 62, borderRadius: 18, padding: 2, alignItems: 'center', justifyContent: 'center' },
  storyAvatarPlaceholder: { width: 58, height: 58, borderRadius: 16, backgroundColor: Colors.surface2, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.bg },
  storyName: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, maxWidth: 60, textAlign: 'center' },

  // Composer
  composerWrapper: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.xl, marginBottom: 16, overflow: 'hidden' },
  composerMain: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  composerInput: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  composerPlaceholder: { fontFamily: Fonts.body, fontSize: 14, color: Colors.muted },
  composerActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border },
  composerActionBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  composerActionText: { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.muted },
  composerDivider: { width: 1, backgroundColor: Colors.border },

  // Tabs
  tabsRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  tabBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  tabText: { fontFamily: Fonts.monoBold, fontSize: 11, letterSpacing: 0.5, color: Colors.muted },
  tabTextActive: { color: '#0a0a0f' },

  // Card
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.xl, overflow: 'hidden',
    ...Shadows.card,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: Spacing.lg, paddingBottom: Spacing.md },
  cardHeaderInfo: { flex: 1 },
  cardUsername: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text },
  cardTime: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, marginTop: 2 },
  moreBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  // Game block
  gameBlock: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  gameInfo: { flex: 1, padding: Spacing.md, justifyContent: 'space-between' },
  gameTitle: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text, lineHeight: 19, marginBottom: 3 },
  gameDev: { fontFamily: Fonts.body, fontSize: 12, color: Colors.muted, marginBottom: 8 },
  gameStat: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  gameStatText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  platformRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginTop: 6 },
  platformBadge: { backgroundColor: Colors.surface2, borderRadius: Radius.xs, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: Colors.border },
  platformText: { fontFamily: Fonts.monoBold, fontSize: 9, color: Colors.muted },

  // Card text + progress
  cardText: { fontFamily: Fonts.body, fontSize: 14, lineHeight: 21, color: Colors.textSecondary, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  progressBlock: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },

  // Footer
  cardFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: Radius.sm },
  actionIcon: { fontSize: 18, color: Colors.muted },
  actionCount: { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.muted },
  bookmarkBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
