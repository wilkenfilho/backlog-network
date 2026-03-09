import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, Pressable, Animated, Modal, Share, Alert,
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

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  return `há ${Math.floor(diff / 86400)}d`;
}

// ─── POST MENU MODAL ──────────────────────────────────────────────────────────
function PostMenuModal({
  visible, onClose, post, isOwner,
  onDelete, onEdit, onReport, onCopyText,
}: {
  visible: boolean; onClose: () => void; post: Post | null; isOwner: boolean;
  onDelete: () => void; onEdit: () => void; onReport: () => void; onCopyText: () => void;
}) {
  if (!post) return null;

  const options = [
    { icon: '📋', label: 'Copiar texto', onPress: onCopyText },
    ...(isOwner ? [
      { icon: '✏️', label: 'Editar post', onPress: onEdit },
      { icon: '🗑️', label: 'Excluir post', onPress: onDelete, danger: true },
    ] : [
      { icon: '🚩', label: 'Denunciar', onPress: onReport },
    ]),
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={menuStyles.overlay} onPress={onClose}>
        <View style={menuStyles.sheet}>
          <View style={menuStyles.handle} />
          {options.map((opt, i) => (
            <TouchableOpacity
              key={i}
              style={menuStyles.option}
              onPress={() => { onClose(); opt.onPress(); }}
              activeOpacity={0.7}
            >
              <Text style={menuStyles.optionIcon}>{opt.icon}</Text>
              <Text style={[menuStyles.optionLabel, (opt as any).danger && menuStyles.optionDanger]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={menuStyles.cancelBtn} onPress={onClose}>
            <Text style={menuStyles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

const menuStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.lg, paddingBottom: 40, paddingTop: Spacing.md,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 20 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  optionIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  optionLabel: { fontFamily: Fonts.bodyMedium, fontSize: 15, color: Colors.text },
  optionDanger: { color: Colors.red },
  cancelBtn: { marginTop: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: Colors.bg, borderRadius: Radius.lg },
  cancelText: { fontFamily: Fonts.bodyBold, fontSize: 15, color: Colors.muted },
});

// ─── POST CARD ────────────────────────────────────────────────────────────────
function PostCard({ post, onLike, onComment, onShare, onGamePress, onUserPress, onMore }: {
  post: Post;
  onLike: (id: string) => void;
  onComment: (id: string) => void;
  onShare: (post: Post) => void;
  onGamePress: (game: any) => void;
  onUserPress: (user: any) => void;
  onMore: (post: Post) => void;
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

  const displayName = (post.user as any)?.displayName || (post.user as any)?.display_name || post.user?.username || '?';
  const username = post.user?.username || '?';

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <Avatar user={post.user} size={40} onPress={() => onUserPress(post.user)} />
        <View style={styles.cardHeaderInfo}>
          <TouchableOpacity onPress={() => onUserPress(post.user)}>
            <Text style={styles.cardDisplayName}>{displayName}</Text>
          </TouchableOpacity>
          <Text style={styles.cardTime}>@{username} · {timeAgo(post.createdAt)}</Text>
        </View>
        {post.status && <StatusBadge status={post.status} />}
        <TouchableOpacity style={styles.moreBtn} onPress={() => onMore(post)}>
          <Text style={{ color: Colors.muted, fontSize: 18, lineHeight: 18 }}>···</Text>
        </TouchableOpacity>
      </View>

      {post.game && (
        <TouchableOpacity style={styles.gameBlock} onPress={() => onGamePress(post.game)} activeOpacity={0.8}>
          <GameCover game={post.game} width={72} height={92} borderRadius={0} />
          <View style={styles.gameInfo}>
            <Text style={styles.gameTitle} numberOfLines={2}>{post.game.title}</Text>
            <Text style={styles.gameDev} numberOfLines={1}>{post.game.developer}</Text>
            {post.hoursPlayed != null && (
              <View style={styles.gameStat}><Text style={styles.gameStatText}>⏱ {post.hoursPlayed}h jogadas</Text></View>
            )}
            {post.type === 'review' && post.review && <StarRating rating={post.review.rating} />}
            <View style={styles.platformRow}>
              {post.game.platforms?.slice(0, 3).map(p => (
                <View key={p} style={styles.platformBadge}><Text style={styles.platformText}>{p}</Text></View>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      )}

      {post.text && <Text style={styles.cardText}>{post.text}</Text>}

      {post.progress != null && post.status === 'finished' && (
        <View style={styles.progressBlock}><ProgressBar progress={post.progress} label="Progresso da platina" color={Colors.accent} /></View>
      )}
      {post.progress != null && post.status === 'playing' && (
        <View style={styles.progressBlock}><ProgressBar progress={post.progress} label="Progresso" color={Colors.purple} /></View>
      )}

      <View style={styles.cardFooter}>
        <Animated.View style={{ transform: [{ scale: likeScale }] }}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
            <Text style={[styles.actionIcon, liked && { color: Colors.red }]}>{liked ? '♥' : '♡'}</Text>
            <Text style={[styles.actionCount, liked && { color: Colors.red }]}>{likeCount}</Text>
          </TouchableOpacity>
        </Animated.View>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onComment(post.id)}>
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionCount}>{post.commentsCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onShare(post)}>
          <Text style={styles.actionIcon}>↗</Text>
          <Text style={styles.actionCount}>{post.sharesCount}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.bookmarkBtn}><Text style={{ color: Colors.muted, fontSize: 18 }}>🔖</Text></TouchableOpacity>
      </View>
    </View>
  );
}

// ─── STORIES ──────────────────────────────────────────────────────────────────
function StoriesRow() {
  const navigation = useNavigation<any>();
  const { data: storiesData } = useQuery({
    queryKey: ['stories'],
    queryFn: async () => { try { return (await api.get('/stories')).data; } catch { return { data: [] }; } },
    select: (res: any) => res.data ?? [],
  });
  const grouped = Object.values(
    (storiesData ?? []).reduce((acc: any, s: any) => {
      if (!acc[s.user_id]) acc[s.user_id] = { ...s, count: 1 };
      else acc[s.user_id].count++;
      return acc;
    }, {})
  );

  return (
    <FlatList
      horizontal showsHorizontalScrollIndicator={false}
      data={grouped} keyExtractor={(item: any) => item.id}
      contentContainerStyle={styles.storiesContainer}
      ListHeaderComponent={() => (
        <TouchableOpacity style={styles.storyItem} activeOpacity={0.8} onPress={() => navigation.navigate('CreatePost')}>
          <View style={[styles.storyRing, { borderColor: Colors.border, borderWidth: 2, borderStyle: 'dashed' }]}>
            <View style={styles.storyAvatarPlaceholder}><Text style={{ color: Colors.muted, fontSize: 22 }}>+</Text></View>
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
        <View style={styles.composerInput}><Text style={styles.composerPlaceholder}>O que você tá jogando?</Text></View>
      </TouchableOpacity>
      <View style={styles.composerActions}>
        <TouchableOpacity style={styles.composerActionBtn} onPress={onReviewPress}><Text style={styles.composerActionText}>✍️ Escrever review</Text></TouchableOpacity>
        <View style={styles.composerDivider} />
        <TouchableOpacity style={styles.composerActionBtn} onPress={onStatusPress}><Text style={styles.composerActionText}>🎮 Status de jogo</Text></TouchableOpacity>
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
  const [menuPost, setMenuPost] = useState<Post | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);

  const { data: feedData, refetch, isRefetching } = useQuery({
    queryKey: ['feed', activeTab],
    queryFn: () => feedService.getFeed({ filter: activeTab }),
    select: (res: any) => {
      const raw = res.data?.data ?? res.data ?? [];
      return raw.map((p: any) => ({
        ...p,
        id: String(p.id),
        text: p.content ?? p.text,
        type: p.type ?? 'status_update',
        user: {
          id: String(p.user_id),
          username: p.username ?? '',
          displayName: p.display_name ?? p.username ?? '',
          display_name: p.display_name ?? p.username ?? '',
          avatar: p.avatar_url,
          avatarUrl: p.avatar_url,
          level: p.level ?? 1,
        },
        game: p.game_id ? {
          id: String(p.game_id),
          title: p.game_title ?? p.game_name ?? '',
          developer: p.game_dev ?? '',
          coverUrl: p.game_cover,
        } : null,
        status: p.status ?? (p.game_id ? 'playing' : undefined),
        isLiked: !!p.liked_by_me,
        likesCount: Number(p.likes_count ?? 0),
        commentsCount: Number(p.comments_count ?? 0),
        sharesCount: 0,
        progress: p.progress ? Number(p.progress) : undefined,
        hoursPlayed: p.hours_played ? Number(p.hours_played) : undefined,
        createdAt: p.created_at,
      }));
    },
  });

  const posts = feedData && feedData.length > 0 ? feedData : [];

  const handleRefresh = useCallback(async () => { await refetch(); }, [refetch]);

  const handleLike = (postId: string) => {
    const post = posts.find((p: any) => p.id === postId);
    if (post?.isLiked) feedService.unlikePost(postId).catch(() => {});
    else feedService.likePost(postId).catch(() => {});
  };

  const handleComment = (postId: string) => { navigation.navigate('Comments', { postId }); };

  const handleShare = async (post: Post) => {
    try {
      const gameText = post.game ? ` sobre ${post.game.title}` : '';
      const userName = (post.user as any)?.displayName || post.user?.username || '';
      await Share.share({ message: `${userName}${gameText}: "${post.text ?? ''}" — via BACKLOG NETWORK` });
    } catch {}
  };

  const handleMore = (post: Post) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMenuPost(post);
    setMenuVisible(true);
  };

  const handleDeletePost = () => {
    if (!menuPost) return;
    Alert.alert('Excluir post', 'Tem certeza? Essa ação é irreversível.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/posts/${menuPost.id}`);
          queryClient.invalidateQueries({ queryKey: ['feed'] });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch { Alert.alert('Erro', 'Não foi possível excluir o post.'); }
      }},
    ]);
  };

  const handleGamePress = (game: any) => { navigation.navigate('GameDetail', { gameId: game.id, game }); };
  const handleUserPress = (postUser: any) => { navigation.navigate('UserProfile', { userId: postUser.id, username: postUser.username }); };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <BlurView intensity={60} tint="dark" style={styles.header}>
        <Text style={styles.headerTitle}>FEED</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Messages')}>
            <Text style={{ fontSize: 20 }}>💬</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Notifications')}>
            <Text style={{ fontSize: 20 }}>🔔</Text><View style={styles.notifDot} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Search')}>
            <Text style={{ fontSize: 20 }}>🔍</Text>
          </TouchableOpacity>
        </View>
      </BlurView>

      <FlatList
        data={posts} keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <PostCard post={item} onLike={handleLike} onComment={handleComment} onShare={handleShare}
            onGamePress={handleGamePress} onUserPress={handleUserPress} onMore={handleMore} />
        )}
        ListHeaderComponent={() => (
          <View>
            <StoriesRow />
            <ComposerStrip user={user ?? { username: 'WP', displayName: 'Wilken P.' }}
              onPostPress={() => navigation.navigate('CreatePost')}
              onReviewPress={() => navigation.navigate('ReviewCreate')}
              onStatusPress={() => navigation.navigate('CreatePost', { mode: 'status' })} />
            <View style={styles.tabsRow}>
              {(['friends', 'global', 'following'] as const).map(tab => (
                <TouchableOpacity key={tab} style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                  onPress={() => { Haptics.selectionAsync(); setActiveTab(tab); }}>
                  <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                    {tab === 'friends' ? 'Amigos' : tab === 'global' ? 'Global' : 'Seguindo'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor={Colors.accent} colors={[Colors.accent]} />}
        ListEmptyComponent={() => <EmptyState emoji="📝" title="Nenhum post ainda" subtitle="Publique algo ou siga outros gamers!" action="Criar post" onAction={() => navigation.navigate('CreatePost')} />}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />

      <PostMenuModal visible={menuVisible} onClose={() => setMenuVisible(false)} post={menuPost}
        isOwner={menuPost?.user?.id === String((user as any)?.id)}
        onDelete={handleDeletePost}
        onEdit={() => Alert.alert('Em breve', 'Edição de posts em breve.')}
        onReport={() => Alert.alert('Denúncia enviada', 'Obrigado por ajudar a manter a comunidade segura.')}
        onCopyText={() => { if (menuPost?.text) Alert.alert('Texto copiado', menuPost.text.slice(0, 200)); }}
      />
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontFamily: Fonts.display, fontSize: 28, letterSpacing: 3, color: Colors.text },
  headerRight: { flexDirection: 'row', gap: 4 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md, position: 'relative' },
  notifDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.red, borderWidth: 2, borderColor: Colors.bg },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
  storiesContainer: { paddingVertical: Spacing.md, gap: 14 },
  storyItem: { alignItems: 'center', gap: 6 },
  storyRing: { width: 62, height: 62, borderRadius: 18, padding: 2, alignItems: 'center', justifyContent: 'center' },
  storyAvatarPlaceholder: { width: 58, height: 58, borderRadius: 16, backgroundColor: Colors.surface2, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.bg },
  storyName: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, maxWidth: 60, textAlign: 'center' },
  composerWrapper: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.xl, marginBottom: 16, overflow: 'hidden' },
  composerMain: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  composerInput: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  composerPlaceholder: { fontFamily: Fonts.body, fontSize: 14, color: Colors.muted },
  composerActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border },
  composerActionBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  composerActionText: { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.muted },
  composerDivider: { width: 1, backgroundColor: Colors.border },
  tabsRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  tabBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  tabText: { fontFamily: Fonts.monoBold, fontSize: 11, letterSpacing: 0.5, color: Colors.muted },
  tabTextActive: { color: '#0a0a0f' },
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.xl, overflow: 'hidden', ...Shadows.card },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: Spacing.lg, paddingBottom: Spacing.md },
  cardHeaderInfo: { flex: 1 },
  cardDisplayName: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text },
  cardTime: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, marginTop: 2 },
  moreBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  gameBlock: { flexDirection: 'row', backgroundColor: Colors.surface, marginHorizontal: Spacing.lg, marginBottom: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  gameInfo: { flex: 1, padding: Spacing.md, justifyContent: 'space-between' },
  gameTitle: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text, lineHeight: 19, marginBottom: 3 },
  gameDev: { fontFamily: Fonts.body, fontSize: 12, color: Colors.muted, marginBottom: 8 },
  gameStat: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  gameStatText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  platformRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginTop: 6 },
  platformBadge: { backgroundColor: Colors.surface2, borderRadius: Radius.xs, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: Colors.border },
  platformText: { fontFamily: Fonts.monoBold, fontSize: 9, color: Colors.muted },
  cardText: { fontFamily: Fonts.body, fontSize: 14, lineHeight: 21, color: Colors.textSecondary, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  progressBlock: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: Radius.sm },
  actionIcon: { fontSize: 18, color: Colors.muted },
  actionCount: { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.muted },
  bookmarkBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
