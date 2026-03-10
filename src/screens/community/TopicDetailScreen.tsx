import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Colors, Fonts, Spacing, Radius, Shadows } from '../../theme';
import { Avatar, Button } from '../../components';
import { useAuthStore } from '../../store/authStore';
import { timeAgo } from '../../utils/helpers';
import { topicsService } from '../../services/api';

interface Reply {
  id: string; user_id: string; username: string;
  display_name: string; avatar_url?: string;
  user_role?: string; body: string;
  likes_count: number; is_liked: boolean;
  parent_id: string | null; created_at: string;
  is_removed: boolean; replies?: Reply[];
}

const ROLE_COLORS: Record<string, string> = {
  owner: '#ff5c5c', admin: '#ffaa00', mod: Colors.purple,
};
const ROLE_LABELS: Record<string, string> = {
  owner: '👑 Dono', admin: '⚡ Admin', mod: '🛡️ Mod',
};

// ─── REPLY CARD ──────────────────────────────────────────────────────────────
function ReplyCard({ reply, isNested = false, myRole, onReply, onLike, onModerate }: {
  reply: Reply; isNested?: boolean; myRole?: string;
  onReply: (reply: Reply) => void;
  onLike: (id: string, liked: boolean) => void;
  onModerate: (id: string) => void;
}) {
  const [liked, setLiked] = useState(reply.is_liked);
  const [likes, setLikes] = useState(reply.likes_count);
  const isMod = myRole && ['mod', 'admin', 'owner'].includes(myRole);
  const roleColor = reply.user_role ? ROLE_COLORS[reply.user_role] : null;

  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newLiked = !liked;
    setLiked(newLiked); setLikes(c => newLiked ? c + 1 : c - 1);
    onLike(reply.id, newLiked);
  };

  if (reply.is_removed) {
    return (
      <View style={[styles.replyCard, isNested && styles.replyNested, { opacity: 0.5 }]}>
        {isNested && <View style={styles.nestedLine} />}
        <Text style={styles.removedText}>🚫 Resposta removida pela moderação</Text>
      </View>
    );
  }

  return (
    <View style={[styles.replyCard, isNested && styles.replyNested]}>
      {isNested && <View style={styles.nestedLine} />}
      <View style={styles.replyHeader}>
        <Avatar user={{ id: reply.user_id, username: reply.username, displayName: reply.display_name } as any} size={32} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.replyAuthor}>{reply.display_name}</Text>
            {reply.user_role && ROLE_LABELS[reply.user_role] && (
              <View style={[styles.replyRoleBadge, { borderColor: roleColor + '50', backgroundColor: roleColor + '15' }]}>
                <Text style={[styles.replyRoleText, { color: roleColor! }]}>{ROLE_LABELS[reply.user_role]}</Text>
              </View>
            )}
          </View>
          <Text style={styles.replyTime}>{timeAgo(reply.created_at)}</Text>
        </View>
        {isMod && (
          <TouchableOpacity onPress={() => onModerate(reply.id)}>
            <Text style={{ color: Colors.muted, fontSize: 18 }}>⋯</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.replyBody}>{reply.body}</Text>

      <View style={styles.replyFooter}>
        <TouchableOpacity style={styles.replyAction} onPress={handleLike}>
          <Text style={[styles.replyActionIcon, liked && { color: Colors.red }]}>{liked ? '♥' : '♡'}</Text>
          <Text style={[styles.replyActionCount, liked && { color: Colors.red }]}>{likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.replyAction} onPress={() => onReply(reply)}>
          <Text style={styles.replyActionIcon}>↩</Text>
          <Text style={styles.replyActionCount}>Responder</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── TOPIC DETAIL SCREEN ─────────────────────────────────────────────────────
export default function TopicDetailScreen() {
  const insets   = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const { topicId } = route.params ?? {};

  const [replyingTo, setReplyingTo] = useState<Reply | null>(null);
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);

  // ── Fetch topic + replies ────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['topic', topicId],
    queryFn: () => topicsService.get(topicId),
    enabled: !!topicId,
  });

  const topic = data?.topic ?? data?.data ?? data ?? null;
  const rawReplies: Reply[] = data?.replies ?? data?.data?.replies ?? [];

  const [localLikedTopic, setLocalLikedTopic] = useState<boolean | null>(null);
  const topicLiked = localLikedTopic ?? !!topic?.is_liked;
  const topicLikes = topic?.likes_count ?? 0;

  const myRole: string = topic?.my_role ?? user?.role ?? 'member';

  // ── Replies state (para mutações otimistas) ──────────────────────────────
  const [replyOverrides, setReplyOverrides] = useState<Record<string, Partial<Reply>>>({});
  const replies = rawReplies.map(r => ({ ...r, ...(replyOverrides[r.id] ?? {}) }));

  const rootReplies = replies.filter(r => !r.parent_id);
  const childrenOf = (id: string) => replies.filter(r => r.parent_id === id);

  // ── Send reply mutation ──────────────────────────────────────────────────
  const replyMutation = useMutation({
    mutationFn: ({ body, parentId }: { body: string; parentId?: string }) =>
      topicsService.reply(topicId, body, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topic', topicId] });
      setText(''); setReplyingTo(null);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 300);
    },
    onError: () => Alert.alert('Erro', 'Não foi possível enviar a resposta.'),
  });

  const handleSend = () => {
    if (!text.trim() || replyMutation.isPending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    replyMutation.mutate({ body: text.trim(), parentId: replyingTo?.id });
  };

  // ── Like reply ───────────────────────────────────────────────────────────
  const handleLikeReply = (id: string, liked: boolean) => {
    if (liked) topicsService.likeReply(id).catch(() => {});
    else topicsService.unlikeReply(id).catch(() => {});
  };

  // ── Like topic ────────────────────────────────────────────────────────────
  const handleLikeTopic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newLiked = !topicLiked;
    setLocalLikedTopic(newLiked);
    if (newLiked) topicsService.like(topicId).catch(() => setLocalLikedTopic(!newLiked));
    else topicsService.unlike(topicId).catch(() => setLocalLikedTopic(!newLiked));
  };

  // ── Moderate reply ───────────────────────────────────────────────────────
  const handleModerate = (replyId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Moderação', 'O que deseja fazer com esta resposta?', [
      { text: 'Remover', style: 'destructive', onPress: async () => {
        setReplyOverrides(prev => ({ ...prev, [replyId]: { is_removed: true } }));
        await topicsService.removeReply(replyId).catch(() => {
          setReplyOverrides(prev => { const n = { ...prev }; delete n[replyId]; return n; });
        });
      }},
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  if (!topic) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: 32 }]}>
        <Text style={{ color: Colors.muted, fontFamily: Fonts.mono, textAlign: 'center' }}>Tópico não encontrado.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          <Text style={{ color: Colors.accent, fontFamily: Fonts.bodyBold }}>← Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const ListHeader = () => (
    <View>
      {/* Back + community */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ color: Colors.text, fontSize: 20 }}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.communityChip}>
          <Text style={styles.communityChipText}>{topic.community_name ?? 'Comunidade'}</Text>
        </TouchableOpacity>
        {myRole && ['mod','admin','owner'].includes(myRole) && (
          <TouchableOpacity onPress={() => Alert.alert('Tópico', 'Ações', [
            { text: topic.is_pinned ? 'Desafixar' : 'Fixar 📌', onPress: () => topicsService.pin(topicId).then(() => queryClient.invalidateQueries({ queryKey: ['topic', topicId] })).catch(() => {}) },
            { text: 'Remover tópico', style: 'destructive', onPress: () => topicsService.remove(topicId, 'inappropriate').then(() => navigation.goBack()).catch(() => {}) },
            { text: 'Cancelar', style: 'cancel' },
          ])}>
            <Text style={{ color: Colors.muted, fontSize: 20 }}>⋯</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Topic body */}
      <View style={styles.topicBlock}>
        <View style={styles.topicAuthorRow}>
          <Avatar user={{ id: topic.user_id, username: topic.username, displayName: topic.display_name } as any} size={40} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.topicAuthorName}>{topic.display_name}</Text>
              {topic.user_role && ROLE_LABELS[topic.user_role] && (
                <View style={[styles.replyRoleBadge, { borderColor: ROLE_COLORS[topic.user_role] + '50', backgroundColor: ROLE_COLORS[topic.user_role] + '15' }]}>
                  <Text style={[styles.replyRoleText, { color: ROLE_COLORS[topic.user_role] }]}>{ROLE_LABELS[topic.user_role]}</Text>
                </View>
              )}
            </View>
            <Text style={styles.topicAuthorTime}>{timeAgo(topic.created_at)}</Text>
          </View>
        </View>

        <Text style={styles.topicTitle}>{topic.title}</Text>
        <Text style={styles.topicBody}>{topic.body}</Text>

        <View style={styles.topicStats}>
          <TouchableOpacity style={styles.topicAction} onPress={handleLikeTopic}>
            <Text style={[styles.topicActionIcon, topicLiked && { color: Colors.red }]}>{topicLiked ? '♥' : '♡'}</Text>
            <Text style={[styles.topicActionCount, topicLiked && { color: Colors.red }]}>{topicLikes}</Text>
          </TouchableOpacity>
          <View style={styles.topicAction}>
            <Text style={styles.topicActionIcon}>💬</Text>
            <Text style={styles.topicActionCount}>{replies.length} respostas</Text>
          </View>
          <View style={styles.topicAction}>
            <Text style={styles.topicActionIcon}>👁</Text>
            <Text style={styles.topicActionCount}>{(topic.views_count ?? 0).toLocaleString()}</Text>
          </View>
        </View>
      </View>

      <View style={styles.repliesHeader}>
        <Text style={styles.repliesHeaderText}>💬 {replies.length} RESPOSTAS</Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        ref={listRef}
        data={rootReplies}
        keyExtractor={item => item.id}
        ListHeaderComponent={ListHeader}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <View>
            <ReplyCard
              reply={item} myRole={myRole}
              onReply={setReplyingTo}
              onLike={handleLikeReply}
              onModerate={handleModerate}
            />
            {childrenOf(item.id).map(child => (
              <ReplyCard
                key={child.id} reply={child}
                isNested myRole={myRole}
                onReply={setReplyingTo}
                onLike={handleLikeReply}
                onModerate={handleModerate}
              />
            ))}
          </View>
        )}
      />

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        {replyingTo && (
          <View style={styles.replyingBanner}>
            <Text style={styles.replyingText}>↩ Respondendo <Text style={{ color: Colors.accent }}>{replyingTo.display_name}</Text></Text>
            <TouchableOpacity onPress={() => setReplyingTo(null)}>
              <Text style={{ color: Colors.muted, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputRow}>
          <Avatar user={{ id: 'me', username: user?.username ?? '', displayName: user?.displayName ?? '' } as any} size={32} />
          <TextInput
            style={styles.inputField}
            value={text}
            onChangeText={setText}
            placeholder={replyingTo ? `Responder ${replyingTo.display_name}...` : 'Adicionar resposta...'}
            placeholderTextColor={Colors.muted}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || replyMutation.isPending) && styles.sendBtnDisabled]}
            onPress={handleSend} disabled={!text.trim() || replyMutation.isPending}
          >
            <LinearGradient colors={[Colors.accent, Colors.accentDark]} style={styles.sendBtnGradient}>
              <Text style={{ color: '#0a0a0f', fontSize: 16, fontFamily: Fonts.monoBold }}>↑</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 20 },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  communityChip: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border },
  communityChipText: { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.accent },

  topicBlock: { backgroundColor: Colors.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, marginBottom: Spacing.lg, ...Shadows.card },
  topicAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.md },
  topicAuthorName: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text },
  topicAuthorTime: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, marginTop: 2 },
  topicTitle: { fontFamily: Fonts.display, fontSize: 22, letterSpacing: 0.5, color: Colors.text, lineHeight: 26, marginBottom: Spacing.md },
  topicBody: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.lg },
  topicStats: { flexDirection: 'row', gap: 4, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md },
  topicAction: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.sm },
  topicActionIcon: { fontSize: 16, color: Colors.muted },
  topicActionCount: { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.muted },

  repliesHeader: { marginBottom: Spacing.md },
  repliesHeaderText: { fontFamily: Fonts.monoBold, fontSize: 10, letterSpacing: 2, color: Colors.muted },

  replyCard: { backgroundColor: Colors.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, ...Shadows.card },
  replyNested: { marginLeft: 20, borderLeftWidth: 2, borderLeftColor: Colors.accent + '40', borderRadius: Radius.lg },
  nestedLine: { position: 'absolute', left: -12, top: 20, width: 12, height: 1, backgroundColor: Colors.accent + '40' },
  removedText: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted, fontStyle: 'italic' },

  replyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.sm },
  replyAuthor: { fontFamily: Fonts.bodyBold, fontSize: 13, color: Colors.text },
  replyRoleBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.full, borderWidth: 1 },
  replyRoleText: { fontFamily: Fonts.monoBold, fontSize: 9, letterSpacing: 0.5 },
  replyTime: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, marginTop: 2 },
  replyBody: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textSecondary, lineHeight: 21, marginBottom: Spacing.md },
  replyFooter: { flexDirection: 'row', gap: 4 },
  replyAction: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.sm },
  replyActionIcon: { fontSize: 15, color: Colors.muted },
  replyActionCount: { fontFamily: Fonts.bodyMedium, fontSize: 12, color: Colors.muted },

  inputBar: { backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border, paddingHorizontal: Spacing.lg, paddingTop: 10 },
  replyingBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, marginBottom: 6 },
  replyingText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  inputField: { flex: 1, backgroundColor: Colors.surface2, borderRadius: Radius.xl, paddingHorizontal: 14, paddingVertical: 10, color: Colors.text, fontFamily: Fonts.body, fontSize: 14, maxHeight: 100, borderWidth: 1, borderColor: Colors.border },
  sendBtn: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  sendBtnGradient: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
});
