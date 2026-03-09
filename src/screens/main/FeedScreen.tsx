import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, Animated, Modal, Share, Alert, Image as RNImage,
  Dimensions, Pressable, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';

import { Colors, Fonts, Spacing, Radius, Shadows } from '../../theme';
import { Avatar, StatusBadge, GameCover, StarRating, ProgressBar, EmptyState, GlassCard } from '../../components';
import { feedService, storiesService, uploadService } from '../../services/api';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { timeAgo } from '../../utils/helpers';
import type { Post, GameStatus } from '../../types';

const { width: SW } = Dimensions.get('window');

// ─── HELPERS ──────────────────────────────────────────────────────────────────

// Normalize a raw post from any backend shape
function normalizePost(p: any): Post {
  const u = p.user ?? {};
  return {
    ...p,
    id: String(p.id),
    text: p.content ?? p.text ?? '',
    type: p.type ?? 'status_update',
    user: {
      id: String(p.user_id ?? u.id ?? p.id),
      username: u.username ?? p.username ?? p.user_username ?? '',
      displayName: u.display_name ?? u.displayName ?? p.display_name ?? p.user_display_name ?? u.username ?? p.username ?? 'Usuário',
      display_name: u.display_name ?? p.display_name ?? u.username ?? p.username ?? '',
      avatar: u.avatar_url ?? u.avatar ?? p.avatar_url ?? p.user_avatar_url,
      avatarUrl: u.avatar_url ?? u.avatar ?? p.avatar_url ?? p.user_avatar_url,
      level: u.level ?? p.level ?? p.user_level ?? 1,
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
    createdAt: p.created_at ?? '',
  };
}

// ─── POST MENU MODAL ──────────────────────────────────────────────────────────
function PostMenuModal({ visible, onClose, post, isOwner, onDelete, onReport, onCopyText }: any) {
  if (!post) return null;
  const options = [
    { icon: '📋', label: 'Copiar texto', onPress: onCopyText },
    ...(isOwner
      ? [{ icon: '🗑️', label: 'Excluir post', onPress: onDelete, danger: true }]
      : [{ icon: '🚩', label: 'Denunciar', onPress: onReport }]),
  ];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.menuOverlay} onPress={onClose}>
        <View style={styles.menuSheet}>
          <View style={styles.menuHandle} />
          {options.map((opt, i) => (
            <TouchableOpacity key={i} style={styles.menuItem} onPress={() => { opt.onPress(); onClose(); }}>
              <Text style={styles.menuIcon}>{opt.icon}</Text>
              <Text style={[styles.menuLabel, (opt as any).danger && { color: Colors.red }]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── POST CARD ────────────────────────────────────────────────────────────────
const PostCard = React.memo(function PostCard({ post, onLike, onComment, onShare, onGamePress, onUserPress, onMore }: any) {
  const [liked, setLiked] = useState(post.isLiked ?? false);
  const [likeCount, setLikeCount] = useState(post.likesCount);
  const scale = useRef(new Animated.Value(1)).current;

  // Sync if server data changes (e.g. after refetch)
  React.useEffect(() => {
    setLiked(post.isLiked ?? false);
    setLikeCount(post.likesCount ?? 0);
  }, [post.id]);

  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.35, useNativeDriver: true, speed: 50 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }),
    ]).start();
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount((c: number) => newLiked ? c + 1 : c - 1);
    onLike(post.id, newLiked); // pass new desired state
  };

  const displayName = post.user?.displayName || post.user?.display_name || post.user?.username || 'Usuário';
  const username = post.user?.username || '';

  return (
    <GlassCard style={styles.card}>
      <View style={styles.cardHeader}>
        <Avatar user={post.user} size={40} onPress={() => onUserPress(post.user)} />
        <View style={styles.cardHeaderInfo}>
          <TouchableOpacity onPress={() => onUserPress(post.user)}>
            <Text style={styles.cardDisplayName}>{displayName}</Text>
          </TouchableOpacity>
          <Text style={styles.cardTime}>{username ? `@${username} · ` : ''}{timeAgo(post.createdAt)}</Text>
        </View>
        {post.status && <StatusBadge status={post.status} />}
        <TouchableOpacity style={styles.moreBtn} onPress={() => onMore(post)}>
          <Text style={{ color: Colors.muted, fontSize: 18 }}>···</Text>
        </TouchableOpacity>
      </View>

      {post.game && (
        <TouchableOpacity style={styles.gameBlock} onPress={() => onGamePress(post.game)} activeOpacity={0.8}>
          <GameCover game={post.game} width={72} height={92} borderRadius={0} />
          <View style={styles.gameInfo}>
            <Text style={styles.gameTitle} numberOfLines={2}>{post.game.title}</Text>
            <Text style={styles.gameDev} numberOfLines={1}>{post.game.developer}</Text>
            {post.hoursPlayed != null && (
              <Text style={styles.gameStatText}>⏱ {post.hoursPlayed}h</Text>
            )}
          </View>
        </TouchableOpacity>
      )}

      {!!post.text && <Text style={styles.cardText}>{post.text}</Text>}

      <View style={styles.cardFooter}>
        <Animated.View style={{ transform: [{ scale }] }}>
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
        </TouchableOpacity>
      </View>
    </GlassCard>
  );
});

// ─── STORIES VIEWER ──────────────────────────────────────────────────────────
function StoriesViewer({ stories, startIdx, onClose }: { stories: any[]; startIdx: number; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [current, setCurrent] = useState(startIdx);
  const [reply, setReply] = useState('');
  const prog = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    prog.setValue(0);
    Animated.timing(prog, { toValue: 1, duration: 5000, useNativeDriver: false }).start(({ finished }) => {
      if (finished) next();
    });
  }, [current]);

  const next = () => { if (current < stories.length - 1) setCurrent(c => c + 1); else onClose(); };
  const prev = () => { if (current > 0) setCurrent(c => c - 1); };

  const story = stories[current];
  if (!story) return null;

  const isMe = String(story.user_id) === String((user as any)?.id);
  const expiresAt = new Date(story.created_at).getTime() + 24 * 60 * 60 * 1000;
  const expired = Date.now() > expiresAt;

  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* Progress bar */}
        <View style={[styles.storyProgressRow, { paddingTop: insets.top + 8 }]}>
          {stories.map((_, i) => (
            <View key={i} style={styles.storyProgressTrack}>
              <Animated.View style={[styles.storyProgressFill, {
                width: i < current ? '100%' : i === current ? prog.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) : '0%',
              }]} />
            </View>
          ))}
        </View>

        {/* Story user */}
        <View style={styles.storyUserRow}>
          <Avatar user={{ username: story.username, displayName: story.display_name, avatarUrl: story.avatar_url } as any} size={36} />
          <Text style={styles.storyViewerName}>{story.display_name ?? story.username}</Text>
          <Text style={styles.storyViewerTime}>{timeAgo(story.created_at)}</Text>
          {isMe && <Text style={styles.storyViewerViews}>👁 {story.views_count ?? 0}</Text>}
          <TouchableOpacity onPress={onClose} style={{ marginLeft: 'auto' as any }}>
            <Text style={{ color: '#fff', fontSize: 22 }}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Story image */}
        <Pressable style={{ flex: 1 }} onPress={next}>
          <View style={styles.storyTouchSplit}>
            <Pressable style={{ flex: 1 }} onPress={prev} />
            <Pressable style={{ flex: 3 }} onPress={next} />
          </View>
          {story.image_url ? (
            <Image source={{ uri: story.image_url }} style={StyleSheet.absoluteFill as any} contentFit="contain" />
          ) : (
            <LinearGradient colors={[Colors.purple + 'aa', Colors.bg + 'aa']} style={StyleSheet.absoluteFill}>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 60 }}>📸</Text>
              </View>
            </LinearGradient>
          )}
          {expired && (
            <View style={styles.storyExpiredBanner}>
              <Text style={styles.storyExpiredText}>Esta story expirou</Text>
            </View>
          )}
        </Pressable>

        {/* Reactions */}
        <View style={[styles.storyBottom, { paddingBottom: insets.bottom + 12 }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            {['❤️', '🔥', '😂', '😱', '👏', '🎮'].map(emoji => (
              <TouchableOpacity key={emoji} style={styles.storyReactionBtn}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                <Text style={{ fontSize: 22 }}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.storyReplyRow}>
            <View style={styles.storyReplyInput}>
              <Text style={{ color: Colors.muted, fontFamily: Fonts.body }}>Responder...</Text>
            </View>
            <TouchableOpacity style={styles.storyReplyBtn} onPress={() => { Haptics.selectionAsync(); }}>
              <Text style={{ color: Colors.accent, fontSize: 16 }}>↑</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── STORIES ROW ──────────────────────────────────────────────────────────────
function StoriesRow() {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);
  const [flatStories, setFlatStories] = useState<any[]>([]);

  const { data: storiesData } = useQuery({
    queryKey: ['stories'],
    queryFn: async () => {
      try { return (await api.get('/stories')).data; } catch { return []; }
    },
    select: (res: any) => {
      const arr = res?.data ?? (Array.isArray(res) ? res : []);
      // Filter to 24h stories only
      const now = Date.now();
      return arr.filter((s: any) => {
        const age = now - new Date(s.created_at).getTime();
        return age < 24 * 60 * 60 * 1000;
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (imageUri: string) => {
      // In React Native, use expo-file-system to read base64, NOT FileReader
      let imageUrl = imageUri;
      try {
        const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: FileSystem.EncodingType.Base64 });
        const up = await uploadService.uploadImage(base64);
        imageUrl = up?.url ?? up?.image_url ?? imageUri;
      } catch {
        // If upload fails, use local URI directly (won't persist but shows for current session)
      }
      return storiesService.createStory({ image_url: imageUrl, duration: 5 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e: any) => Alert.alert('Erro', e?.message ?? 'Não foi possível publicar a story.'),
  });

  const handleAddStory = async () => {
    Haptics.selectionAsync();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permissão necessária', 'Permita acesso às fotos nas configurações.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, base64: false });
    if (!result.canceled && result.assets[0]) {
      uploadMutation.mutate(result.assets[0].uri);
    }
  };

  // Group by user
  const grouped = Object.values(
    (storiesData ?? []).reduce((acc: any, s: any) => {
      if (!acc[s.user_id]) acc[s.user_id] = { ...s, stories: [s] };
      else acc[s.user_id].stories.push(s);
      return acc;
    }, {})
  ) as any[];

  const openStories = (groupIdx: number) => {
    const all = grouped.flatMap((g: any) => g.stories);
    setFlatStories(all);
    let offset = 0;
    for (let i = 0; i < groupIdx; i++) offset += grouped[i].stories.length;
    setViewerIdx(offset);
  };

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesContainer}>
        {/* Add story button */}
        <TouchableOpacity style={styles.storyItem} activeOpacity={0.8} onPress={handleAddStory}>
          <View style={styles.storyAddRing}>
            {uploadMutation.isPending
              ? <Text style={{ color: Colors.accent, fontSize: 18 }}>⏳</Text>
              : (user as any)?.avatar_url || (user as any)?.avatarUrl
                ? <Image source={{ uri: (user as any).avatar_url ?? (user as any).avatarUrl }} style={styles.storyAddImg} contentFit="cover" />
                : <Text style={{ color: Colors.muted, fontSize: 26 }}>+</Text>
            }
            <View style={styles.storyAddPlus}><Text style={{ color: '#0a0a0f', fontSize: 12, fontWeight: '700' }}>+</Text></View>
          </View>
          <Text style={styles.storyName}>Sua story</Text>
        </TouchableOpacity>

        {grouped.map((group: any, gIdx: number) => {
          const hasNew = group.stories.some((s: any) => !s.viewed_by_me);
          return (
            <TouchableOpacity key={group.user_id} style={styles.storyItem} activeOpacity={0.8} onPress={() => openStories(gIdx)}>
              <LinearGradient
                colors={hasNew ? [Colors.accent, Colors.purple] : [Colors.border, Colors.border]}
                style={styles.storyRing}
              >
                <View style={styles.storyImgWrapper}>
                  {group.image_url
                    ? <Image source={{ uri: group.image_url }} style={styles.storyImg} contentFit="cover" />
                    : <Avatar user={{ username: group.username, displayName: group.display_name, avatarUrl: group.avatar_url } as any} size={50} />
                  }
                </View>
              </LinearGradient>
              <Text style={styles.storyName} numberOfLines={1}>{group.display_name ?? group.username}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {viewerIdx !== null && flatStories.length > 0 && (
        <StoriesViewer stories={flatStories} startIdx={viewerIdx} onClose={() => setViewerIdx(null)} />
      )}
    </>
  );
}

// ─── COMPOSER STRIP ──────────────────────────────────────────────────────────
function ComposerStrip({ user, onPostPress, onReviewPress, onStatusPress }: any) {
  return (
    <View style={styles.composerWrapper}>
      <TouchableOpacity style={styles.composerMain} onPress={onPostPress} activeOpacity={0.85}>
        <Avatar user={user} size={36} />
        <View style={styles.composerInput}>
          <Text style={styles.composerPlaceholder}>No que você está pensando?</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.composerActions}>
        <TouchableOpacity style={styles.composerActionBtn} onPress={onReviewPress}>
          <Text style={styles.composerActionText}>✍️ Review</Text>
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
  const [menuPost, setMenuPost] = useState<Post | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);

  const {
    data: feedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['feed', activeTab],
    queryFn: ({ pageParam = 1 }) => feedService.getFeed({ filter: activeTab, page: pageParam }),
    getNextPageParam: (lastPage: any) => {
      const d = lastPage?.data ?? lastPage;
      return d?.nextPage ?? null;
    },
    initialPageParam: 1,
  });

  // Flatten pages into a single list of normalized posts
  const posts = (feedData?.pages ?? []).flatMap((page: any) => {
    const raw = page?.data?.data ?? page?.data ?? [];
    return (Array.isArray(raw) ? raw : []).map(normalizePost);
  });

  const handleLike = useCallback((postId: string, nowLiked: boolean) => {
    // Fire API call
    if (nowLiked) {
      feedService.likePost(postId).catch(() => {
        queryClient.invalidateQueries({ queryKey: ['feed', activeTab] });
      });
    } else {
      feedService.unlikePost(postId).catch(() => {
        queryClient.invalidateQueries({ queryKey: ['feed', activeTab] });
      });
    }
  }, [activeTab, queryClient]);

  const handleDeletePost = async () => {
    if (!menuPost) return;
    try {
      await api.delete(`/posts/${menuPost.id}`);
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    } catch { Alert.alert('Erro', 'Não foi possível excluir.'); }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <BlurView intensity={80} tint="dark" style={styles.header}>
        <Text style={styles.headerTitle}>FEED</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Messages')}>
            <Text style={{ fontSize: 20 }}>💬</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Notifications')}>
            <Text style={{ fontSize: 20 }}>🔔</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Search')}>
            <Text style={{ fontSize: 20 }}>🔍</Text>
          </TouchableOpacity>
        </View>
      </BlurView>

      <FlatList
        data={posts}
        keyExtractor={(item: any) => item.id}
        renderItem={({ item }) => (
          <PostCard post={item}
            onLike={handleLike}
            onComment={(id: string) => navigation.navigate('Comments', { postId: id })}
            onShare={async (post: Post) => {
              const name = post.user?.displayName || post.user?.username || '';
              await Share.share({ message: `${name}: "${post.text ?? ''}" — via BACKLOG NETWORK` });
            }}
            onGamePress={(game: any) => navigation.navigate('GameDetail', { gameId: game.id, game })}
            onUserPress={(u: any) => navigation.navigate('UserProfile', { userId: u.id, username: u.username })}
            onMore={(p: Post) => { setMenuPost(p); setMenuVisible(true); }}
          />
        )}
        ListHeaderComponent={() => (
          <View>
            <StoriesRow />
            <ComposerStrip
              user={user}
              onPostPress={() => navigation.navigate('CreatePost')}
              onReviewPress={() => navigation.navigate('ReviewCreate')}
              onStatusPress={() => navigation.navigate('CreatePost', { mode: 'status' })}
            />
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
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.accent} colors={[Colors.accent]} />}
        ListEmptyComponent={() => <EmptyState emoji="📝" title="Nenhum post ainda" subtitle="Publique algo ou siga outros gamers!" action="Criar post" onAction={() => navigation.navigate('CreatePost')} />}
        ListFooterComponent={() =>
          isFetchingNextPage ? (
            <ActivityIndicator color={Colors.accent} style={{ marginVertical: 20 }} />
          ) : null
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />

      <PostMenuModal visible={menuVisible} onClose={() => setMenuVisible(false)} post={menuPost}
        isOwner={menuPost?.user?.id === String((user as any)?.id)}
        onDelete={handleDeletePost}
        onReport={() => Alert.alert('Denúncia enviada', 'Obrigado!')}
        onCopyText={() => { if (menuPost?.text) Alert.alert('Copiado', menuPost.text.slice(0, 200)); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontFamily: Fonts.display, fontSize: 28, letterSpacing: 3, color: Colors.text },
  headerRight: { flexDirection: 'row', gap: 4 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },

  // Stories
  storiesContainer: { paddingVertical: 12, paddingHorizontal: Spacing.lg, gap: 14 },
  storyItem: { alignItems: 'center', gap: 5 },
  storyRing: { width: 64, height: 64, borderRadius: 20, padding: 2, alignItems: 'center', justifyContent: 'center' },
  storyImgWrapper: { width: 58, height: 58, borderRadius: 18, overflow: 'hidden', backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.bg },
  storyImg: { width: '100%', height: '100%' },
  storyAddRing: { width: 64, height: 64, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  storyAddImg: { width: 60, height: 60, borderRadius: 18 },
  storyAddPlus: { position: 'absolute', bottom: -4, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.bg },
  storyName: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, maxWidth: 64, textAlign: 'center' },

  // Story viewer
  storyProgressRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 12, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  storyProgressTrack: { flex: 1, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  storyProgressFill: { height: 2, borderRadius: 1, backgroundColor: '#fff' },
  storyUserRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9 },
  storyViewerName: { fontFamily: Fonts.bodyBold, fontSize: 13, color: '#fff' },
  storyViewerTime: { fontFamily: Fonts.mono, fontSize: 10, color: 'rgba(255,255,255,0.7)' },
  storyViewerViews: { fontFamily: Fonts.mono, fontSize: 10, color: 'rgba(255,255,255,0.7)' },
  storyTouchSplit: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', zIndex: 1 },
  storyBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10 },
  storyReactionBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  storyReplyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  storyReplyInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  storyReplyBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  storyExpiredBanner: { position: 'absolute', top: '50%', left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', padding: 12, alignItems: 'center' },
  storyExpiredText: { color: '#fff', fontFamily: Fonts.mono, fontSize: 12 },

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
  tabText: { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.muted },
  tabTextActive: { color: '#0a0a0f' },

  // Post card
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.xl, overflow: 'hidden', ...Shadows.card },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: Spacing.lg, paddingBottom: Spacing.md },
  cardHeaderInfo: { flex: 1 },
  cardDisplayName: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text },
  cardTime: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, marginTop: 2 },
  moreBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  gameBlock: { flexDirection: 'row', backgroundColor: Colors.surface, marginHorizontal: Spacing.lg, marginBottom: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  gameInfo: { flex: 1, padding: Spacing.md },
  gameTitle: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text, marginBottom: 3 },
  gameDev: { fontFamily: Fonts.body, fontSize: 12, color: Colors.muted, marginBottom: 4 },
  gameStatText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  cardText: { fontFamily: Fonts.body, fontSize: 14, lineHeight: 21, color: Colors.textSecondary, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: Radius.sm },
  actionIcon: { fontSize: 18, color: Colors.muted },
  actionCount: { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.muted },

  // Post menu modal
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  menuSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, paddingBottom: 40, paddingTop: 12 },
  menuHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: Spacing.lg, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  menuIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  menuLabel: { fontFamily: Fonts.bodyMedium, fontSize: 15, color: Colors.text },
});
