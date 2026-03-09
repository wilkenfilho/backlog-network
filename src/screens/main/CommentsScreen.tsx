import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Animated,
  ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Colors, Fonts, Spacing, Radius } from '../../theme';
import { Avatar } from '../../components';
import { feedService } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { timeAgo } from '../../utils/helpers';

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface CommentItem {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  text: string;
  created_at: string;
  likes_count: number;
  liked_by_me: boolean;
  parent_id?: string | null;
  replies?: CommentItem[];
  depth: number;
}

// ─── COMMENT CARD ─────────────────────────────────────────────────────────────
function CommentCard({
  comment,
  onReply,
  onLike,
  onUserPress,
}: {
  comment: CommentItem;
  onReply: (comment: CommentItem) => void;
  onLike: (id: string) => void;
  onUserPress: (userId: string) => void;
}) {
  const [liked, setLiked] = useState(comment.liked_by_me);
  const [likeCount, setLikeCount] = useState(comment.likes_count);
  const [collapsed, setCollapsed] = useState(false);

  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLiked(!liked);
    setLikeCount(c => liked ? c - 1 : c + 1);
    onLike(comment.id);
  };

  const indent = Math.min(comment.depth, 4) * 16;
  const DEPTH_COLORS = [Colors.accent, Colors.purple, Colors.teal, Colors.amber, Colors.red];
  const threadColor = DEPTH_COLORS[comment.depth % DEPTH_COLORS.length];

  return (
    <View style={{ paddingLeft: indent }}>
      {/* Thread line */}
      {comment.depth > 0 && (
        <View style={[styles.threadLine, { backgroundColor: threadColor + '30', left: indent - 12 }]} />
      )}

      <View style={[styles.commentCard, collapsed && styles.commentCollapsed]}>
        {/* Header */}
        <TouchableOpacity
          style={styles.commentHeader}
          onPress={() => comment.replies?.length ? setCollapsed(!collapsed) : null}
          activeOpacity={0.8}
        >
          <Avatar
            user={{ id: comment.user_id, username: comment.username, displayName: comment.display_name, avatar: comment.avatar_url } as any}
            size={28}
            onPress={() => onUserPress(comment.user_id)}
          />
          <TouchableOpacity onPress={() => onUserPress(comment.user_id)}>
            <Text style={styles.commentUsername}>{comment.display_name || comment.username}</Text>
          </TouchableOpacity>
          <Text style={styles.commentTime}>· {timeAgo(comment.created_at)}</Text>
          {comment.replies && comment.replies.length > 0 && (
            <Text style={styles.collapseIcon}>{collapsed ? '▸' : '▾'}</Text>
          )}
        </TouchableOpacity>

        {/* Body */}
        {!collapsed && (
          <>
            <Text style={styles.commentText}>{comment.text}</Text>

            {/* Actions */}
            <View style={styles.commentActions}>
              <TouchableOpacity style={styles.commentActionBtn} onPress={handleLike}>
                <Text style={[styles.commentActionIcon, liked && { color: Colors.red }]}>
                  {liked ? '♥' : '♡'}
                </Text>
                {likeCount > 0 && (
                  <Text style={[styles.commentActionCount, liked && { color: Colors.red }]}>
                    {likeCount}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.commentActionBtn} onPress={() => onReply(comment)}>
                <Text style={styles.commentActionIcon}>↩</Text>
                <Text style={styles.commentActionText}>Responder</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Collapsed summary */}
        {collapsed && comment.replies && comment.replies.length > 0 && (
          <TouchableOpacity onPress={() => setCollapsed(false)}>
            <Text style={styles.collapsedText}>
              ▸ {comment.replies.length} resposta{comment.replies.length > 1 ? 's' : ''} oculta{comment.replies.length > 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Nested replies */}
      {!collapsed && comment.replies?.map(reply => (
        <CommentCard
          key={reply.id}
          comment={reply}
          onReply={onReply}
          onLike={onLike}
          onUserPress={onUserPress}
        />
      ))}
    </View>
  );
}

// ─── BUILD TREE ───────────────────────────────────────────────────────────────
function buildCommentTree(flat: any[]): CommentItem[] {
  const map: Record<string, CommentItem> = {};
  const roots: CommentItem[] = [];

  // First pass: create all nodes
  flat.forEach(c => {
    map[c.id] = {
      ...c,
      text: c.text ?? c.body ?? c.content ?? '',
      replies: [],
      depth: 0,
    };
  });

  // Second pass: build tree
  flat.forEach(c => {
    const node = map[c.id];
    if (c.parent_id && map[c.parent_id]) {
      node.depth = map[c.parent_id].depth + 1;
      map[c.parent_id].replies!.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

// ─── COMMENTS SCREEN ──────────────────────────────────────────────────────────
export default function CommentsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const inputRef = useRef<TextInput>(null);

  const postId = route.params?.postId;

  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<CommentItem | null>(null);

  // Fetch comments
  const { data: commentsData, isLoading, refetch } = useQuery({
    queryKey: ['comments', postId],
    queryFn: () => feedService.getComments(postId),
    select: (res: any) => {
      const raw = res.data ?? res ?? [];
      return Array.isArray(raw) ? raw : [];
    },
    enabled: !!postId,
  });

  const commentTree = buildCommentTree(commentsData ?? []);

  // Post comment
  const postMutation = useMutation({
    mutationFn: ({ text, parentId }: { text: string; parentId?: string }) =>
      feedService.addComment(postId, text, parentId),
    onSuccess: () => {
      setCommentText('');
      setReplyingTo(null);
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Alert.alert('Erro', 'Não foi possível enviar o comentário.');
    },
  });

  const handleSubmit = () => {
    const text = commentText.trim();
    if (!text) return;
    postMutation.mutate({ text, parentId: replyingTo?.id });
  };

  const handleReply = (comment: CommentItem) => {
    setReplyingTo(comment);
    inputRef.current?.focus();
  };

  const handleLikeComment = (commentId: string) => {
    // TODO: API call for liking comments
  };

  const handleUserPress = (userId: string) => {
    navigation.navigate('UserProfile', { userId });
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ color: Colors.text, fontSize: 18 }}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>COMENTÁRIOS</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Comments list */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={commentTree}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <CommentCard
              comment={item}
              onReply={handleReply}
              onLike={handleLikeComment}
              onUserPress={handleUserPress}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>Sem comentários ainda</Text>
              <Text style={styles.emptySubtitle}>Seja o primeiro a comentar!</Text>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
        />
      )}

      {/* Reply indicator */}
      {replyingTo && (
        <View style={styles.replyIndicator}>
          <Text style={styles.replyText} numberOfLines={1}>
            ↩ Respondendo a <Text style={{ color: Colors.accent }}>{replyingTo.display_name || replyingTo.username}</Text>
          </Text>
          <TouchableOpacity onPress={cancelReply}>
            <Text style={styles.replyCancelBtn}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 8 }]}>
        <Avatar
          user={user as any ?? { username: '?' }}
          size={32}
        />
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={commentText}
          onChangeText={setCommentText}
          placeholder={replyingTo ? `Responder ${replyingTo.display_name || replyingTo.username}...` : 'Escrever comentário...'}
          placeholderTextColor={Colors.muted}
          multiline={false}
          returnKeyType="send"
          onSubmitEditing={handleSubmit}
          blurOnSubmit={false}
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !commentText.trim() && styles.sendBtnDisabled]}
          onPress={handleSubmit}
          disabled={!commentText.trim() || postMutation.isPending}
        >
          {postMutation.isPending ? (
            <ActivityIndicator color="#0a0a0f" size="small" />
          ) : (
            <Text style={styles.sendBtnText}>↑</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.display, fontSize: 18, letterSpacing: 3, color: Colors.text },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  listContent: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: 20 },

  // Comment card
  commentCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  commentCollapsed: { opacity: 0.6 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  commentUsername: { fontFamily: Fonts.bodyBold, fontSize: 13, color: Colors.text },
  commentTime: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  collapseIcon: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted, marginLeft: 'auto' },
  commentText: { fontFamily: Fonts.body, fontSize: 14, lineHeight: 21, color: Colors.textSecondary, marginBottom: 8 },

  // Thread line
  threadLine: {
    position: 'absolute', top: 0, bottom: 0, width: 2, borderRadius: 1,
  },

  // Comment actions
  commentActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  commentActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  commentActionIcon: { fontSize: 14, color: Colors.muted },
  commentActionCount: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  commentActionText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },

  // Collapsed
  collapsedText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.accent, paddingVertical: 4 },

  // Empty state
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontFamily: Fonts.bodyBold, fontSize: 16, color: Colors.text, marginBottom: 6 },
  emptySubtitle: { fontFamily: Fonts.body, fontSize: 14, color: Colors.muted },

  // Reply indicator
  replyIndicator: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: 8,
    backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  replyText: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted, flex: 1 },
  replyCancelBtn: { color: Colors.muted, fontSize: 16, paddingLeft: 12 },

  // Input
  inputContainer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: Spacing.lg, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  input: {
    flex: 1, fontFamily: Fonts.body, fontSize: 14, color: Colors.text,
    backgroundColor: Colors.bg, borderRadius: Radius.xl,
    paddingHorizontal: 14, paddingVertical: 10,
    maxHeight: 100, borderWidth: 1, borderColor: Colors.border,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  sendBtnDisabled: { opacity: 0.3 },
  sendBtnText: { fontFamily: Fonts.monoBold, fontSize: 18, color: '#0a0a0f' },
});
