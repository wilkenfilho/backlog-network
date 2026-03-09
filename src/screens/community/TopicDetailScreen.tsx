import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { Colors, Fonts, Spacing, Radius, Shadows } from '../../theme';
import { Avatar, Button } from '../../components';
import { useAuthStore } from '../../store/authStore';
import { timeAgo } from '../../utils/helpers';

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

const MOCK_TOPIC = {
  id: 't2',
  title: 'Qual boss foi mais difícil pra vocês? (sem spoiler do DLC)',
  body: 'Depois de zerar o jogo pela terceira vez, ainda acho que a Malenia é impossível na primeira tentativa. Vocês tiveram algum boss que travou mais que ela?\n\nPara mim o ranking ficou:\n1. Malenia\n2. Radahn (pré-nerf)\n3. Maliketh',
  community_id: 'c1', community_name: 'Fãs de Elden Ring 🐉',
  user_id: 'u2', username: 'mari_rpg', display_name: 'Mari RPG',
  user_role: 'admin', likes_count: 312, replies_count: 98,
  views_count: 4200, is_pinned: false, is_locked: false,
  is_liked: true, created_at: new Date(Date.now() - 3600000).toISOString(),
};

const MOCK_REPLIES: Reply[] = [
  { id: 'r1', user_id: 'u1', username: 'wilken', display_name: 'Wilken P.', user_role: 'owner', body: 'Malenia disparado. Morri mais de 80 vezes nela. O Radahn pré-nerf também era absurdo mas pelo menos dava pra usar a cavalaria pra distrair.', likes_count: 89, is_liked: false, parent_id: null, created_at: new Date(Date.now() - 3500000).toISOString(), is_removed: false },
  { id: 'r2', user_id: 'u3', username: 'luca.dev', display_name: 'Luca', user_role: 'mod', body: 'Pra mim foi o Placidusax. Aquela arena no vazio é linda mas o boss em si é uma luta frustrante demais com aquelas garras.', likes_count: 44, is_liked: true, parent_id: null, created_at: new Date(Date.now() - 3200000).toISOString(), is_removed: false },
  { id: 'r3', user_id: 'u4', username: 'rodrigao', display_name: 'Rodrigão', body: 'Concordo com o Luca, Placidusax é muito overrated de dificuldade mas o Malenia com a fase 2 me quebrou emocionalmente kkkk', likes_count: 31, is_liked: false, parent_id: 'r2', created_at: new Date(Date.now() - 3100000).toISOString(), is_removed: false },
  { id: 'r4', user_id: 'u5', username: 'kae_plays', display_name: 'Kae', body: 'Alguém aqui usou o Let Me Solo Her? Aquele cara era lendário na época do lançamento 😂', likes_count: 127, is_liked: false, parent_id: null, created_at: new Date(Date.now() - 2800000).toISOString(), is_removed: false },
  { id: 'r5', user_id: 'u1', username: 'wilken', display_name: 'Wilken P.', user_role: 'owner', body: 'Chamei ele umas 4 vezes sem vergonha nenhuma hahahaha', likes_count: 56, is_liked: false, parent_id: 'r4', created_at: new Date(Date.now() - 2700000).toISOString(), is_removed: false },
];


// ─── REPLY CARD ──────────────────────────────────────────────────────────────
function ReplyCard({ reply, isNested = false, myRole, onReply, onLike, onModerate }: {
  reply: Reply; isNested?: boolean; myRole?: string;
  onReply: (reply: Reply) => void;
  onLike: (id: string) => void;
  onModerate: (id: string) => void;
}) {
  const [liked, setLiked] = useState(reply.is_liked);
  const [likes, setLikes] = useState(reply.likes_count);
  const isMod = myRole && ['mod', 'admin', 'owner'].includes(myRole);
  const roleColor = reply.user_role ? ROLE_COLORS[reply.user_role] : null;

  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLiked(!liked); setLikes(c => liked ? c - 1 : c + 1);
    onLike(reply.id);
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
  const { user } = useAuthStore();

  const [replies, setReplies] = useState<Reply[]>(MOCK_REPLIES);
  const [replyingTo, setReplyingTo] = useState<Reply | null>(null);
  const [text, setText] = useState('');
  const [topicLiked, setTopicLiked] = useState(MOCK_TOPIC.is_liked);
  const [topicLikes, setTopicLikes] = useState(MOCK_TOPIC.likes_count);
  const listRef = useRef<FlatList>(null);
  const myRole = 'owner'; // viria do state real

  // Organiza replies em árvore (raiz + filhos)
  const rootReplies = replies.filter(r => !r.parent_id);
  const childrenOf = (id: string) => replies.filter(r => r.parent_id === id);

  const handleSend = () => {
    if (!text.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newReply: Reply = {
      id: Math.random().toString(),
      user_id: 'me', username: user?.username ?? 'você',
      display_name: user?.displayName ?? 'Você',
      user_role: myRole, body: text.trim(),
      likes_count: 0, is_liked: false,
      parent_id: replyingTo?.id ?? null,
      created_at: new Date().toISOString(),
      is_removed: false,
    };
    setReplies(prev => [...prev, newReply]);
    setText(''); setReplyingTo(null);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
  };

  const handleModerate = (replyId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Moderação', 'O que deseja fazer com esta resposta?', [
      { text: 'Remover', style: 'destructive', onPress: () => setReplies(prev => prev.map(r => r.id === replyId ? { ...r, is_removed: true } : r)) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const ListHeader = () => (
    <View>
      {/* Back + community */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ color: Colors.text, fontSize: 20 }}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.communityChip}>
          <Text style={styles.communityChipText}>{MOCK_TOPIC.community_name}</Text>
        </TouchableOpacity>
        {myRole && ['mod','admin','owner'].includes(myRole) && (
          <TouchableOpacity onPress={() => Alert.alert('Tópico', 'Ações', [
            { text: MOCK_TOPIC.is_pinned ? 'Desafixar' : 'Fixar 📌' },
            { text: 'Bloquear respostas 🔒' },
            { text: 'Remover tópico', style: 'destructive' },
            { text: 'Cancelar', style: 'cancel' },
          ])}>
            <Text style={{ color: Colors.muted, fontSize: 20 }}>⋯</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Topic body */}
      <View style={styles.topicBlock}>
        <View style={styles.topicAuthorRow}>
          <Avatar user={{ id: MOCK_TOPIC.user_id, username: MOCK_TOPIC.username, displayName: MOCK_TOPIC.display_name } as any} size={40} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.topicAuthorName}>{MOCK_TOPIC.display_name}</Text>
              {MOCK_TOPIC.user_role && ROLE_LABELS[MOCK_TOPIC.user_role] && (
                <View style={[styles.replyRoleBadge, { borderColor: ROLE_COLORS[MOCK_TOPIC.user_role] + '50', backgroundColor: ROLE_COLORS[MOCK_TOPIC.user_role] + '15' }]}>
                  <Text style={[styles.replyRoleText, { color: ROLE_COLORS[MOCK_TOPIC.user_role] }]}>{ROLE_LABELS[MOCK_TOPIC.user_role]}</Text>
                </View>
              )}
            </View>
            <Text style={styles.topicAuthorTime}>{timeAgo(MOCK_TOPIC.created_at)}</Text>
          </View>
        </View>

        <Text style={styles.topicTitle}>{MOCK_TOPIC.title}</Text>
        <Text style={styles.topicBody}>{MOCK_TOPIC.body}</Text>

        <View style={styles.topicStats}>
          <TouchableOpacity style={styles.topicAction} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setTopicLiked(!topicLiked); setTopicLikes(c => topicLiked ? c - 1 : c + 1); }}>
            <Text style={[styles.topicActionIcon, topicLiked && { color: Colors.red }]}>{topicLiked ? '♥' : '♡'}</Text>
            <Text style={[styles.topicActionCount, topicLiked && { color: Colors.red }]}>{topicLikes}</Text>
          </TouchableOpacity>
          <View style={styles.topicAction}>
            <Text style={styles.topicActionIcon}>💬</Text>
            <Text style={styles.topicActionCount}>{replies.length} respostas</Text>
          </View>
          <View style={styles.topicAction}>
            <Text style={styles.topicActionIcon}>👁</Text>
            <Text style={styles.topicActionCount}>{MOCK_TOPIC.views_count.toLocaleString()}</Text>
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
              onLike={(id) => {}}
              onModerate={handleModerate}
            />
            {/* Replies aninhadas */}
            {childrenOf(item.id).map(child => (
              <ReplyCard
                key={child.id} reply={child}
                isNested myRole={myRole}
                onReply={setReplyingTo}
                onLike={(id) => {}}
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
            style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
            onPress={handleSend} disabled={!text.trim()}
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
