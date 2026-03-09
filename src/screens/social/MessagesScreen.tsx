import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Modal, Pressable,
  ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Colors, Fonts, Spacing, Radius, Shadows } from '../../theme';
import { Avatar, EmptyState } from '../../components';
import { useAuthStore } from '../../store/authStore';
import { messagesService, usersService } from '../../services/api';
import { timeAgo } from '../../utils/helpers';

// ─── TYPES ───────────────────────────────────────────────────────────────────
interface Conversation {
  id: string; other_id: string; other_username: string;
  other_name: string; other_avatar?: string;
  last_message: string; last_message_at: string; unread_count: number;
}

interface Message {
  id: string; sender_id: string; body: string;
  is_read: boolean; created_at: string;
}

interface Scrap {
  id: string; from_user_id: string; from_username: string;
  from_name: string; from_avatar?: string;
  body: string; is_private: boolean; created_at: string;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

// ─── CONVERSATIONS LIST ───────────────────────────────────────────────────────
function ConversationItem({ conv, onPress }: { conv: Conversation; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.convItem} onPress={onPress} activeOpacity={0.8}>
      <View style={{ position: 'relative' }}>
        <Avatar user={{ id: conv.other_id, username: conv.other_username, displayName: conv.other_name, avatar: conv.other_avatar } as any} size={48} />
        <View style={styles.onlineDot} />
      </View>
      <View style={styles.convInfo}>
        <View style={styles.convHeader}>
          <Text style={styles.convName}>{conv.other_name || conv.other_username}</Text>
          <Text style={styles.convTime}>{timeAgo(conv.last_message_at)}</Text>
        </View>
        <View style={styles.convPreview}>
          <Text style={[styles.convLastMsg, conv.unread_count > 0 && styles.convLastMsgUnread]} numberOfLines={1}>
            {conv.last_message}
          </Text>
          {conv.unread_count > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{conv.unread_count}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── NEW MESSAGE MODAL ────────────────────────────────────────────────────────
function NewMessageModal({ visible, onClose, onSelectUser }: { visible: boolean; onClose: () => void; onSelectUser: (user: any) => void }) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data: results, isLoading } = useQuery({
    queryKey: ['user-search-msg', debouncedSearch],
    queryFn: () => usersService.search(debouncedSearch),
    select: (res: any) => {
      const raw = res?.data?.data ?? res?.data ?? res ?? [];
      return Array.isArray(raw) ? raw : [];
    },
    enabled: debouncedSearch.length >= 2,
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Nova Mensagem</Text>
          <View style={styles.modalSearchRow}>
            <Text style={{ color: Colors.muted }}>🔍</Text>
            <TextInput
              style={styles.modalSearchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar usuário..."
              placeholderTextColor={Colors.muted}
              autoFocus
            />
            {isLoading && <ActivityIndicator color={Colors.accent} size="small" />}
          </View>
          {debouncedSearch.length >= 2 && (results ?? []).length === 0 && !isLoading && (
            <Text style={styles.modalEmpty}>Nenhum usuário encontrado</Text>
          )}
          <FlatList
            data={results ?? []}
            keyExtractor={(item: any) => String(item.id ?? item.user_id)}
            renderItem={({ item }: any) => (
              <TouchableOpacity
                style={styles.modalUserItem}
                onPress={() => { onSelectUser(item); onClose(); setSearch(''); }}
                activeOpacity={0.8}
              >
                <Avatar user={{ id: String(item.id), username: item.username, displayName: item.display_name, avatar: item.avatar_url } as any} size={40} />
                <View>
                  <Text style={styles.modalUserName}>{item.display_name ?? item.username}</Text>
                  <Text style={styles.modalUserHandle}>@{item.username}</Text>
                </View>
              </TouchableOpacity>
            )}
            style={{ maxHeight: 300 }}
          />
          <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
            <Text style={styles.modalCancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── MESSAGES SCREEN ──────────────────────────────────────────────────────────
export function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [newMsgVisible, setNewMsgVisible] = useState(false);
  const queryClient = useQueryClient();

  const { data: conversations, isLoading, refetch } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => messagesService.getConversations(),
    select: (res: any) => {
      const raw = res?.data ?? res ?? [];
      return Array.isArray(raw) ? raw.map((c: any) => ({
        id: String(c.id ?? c.conversation_id),
        other_id: String(c.other_user_id ?? c.other_id),
        other_username: c.other_username ?? '',
        other_name: c.other_display_name ?? c.other_name ?? c.other_username ?? '',
        other_avatar: c.other_avatar_url ?? c.other_avatar,
        last_message: c.last_message ?? c.last_body ?? '',
        last_message_at: c.last_message_at ?? c.updated_at ?? new Date().toISOString(),
        unread_count: Number(c.unread_count ?? 0),
      })) : [];
    },
  });

  const handleSelectUser = async (selectedUser: any) => {
    // Start a new conversation with this user
    const convId = String(selectedUser.id ?? selectedUser.user_id);
    const newConv: Conversation = {
      id: convId,
      other_id: convId,
      other_username: selectedUser.username,
      other_name: selectedUser.display_name ?? selectedUser.username,
      other_avatar: selectedUser.avatar_url,
      last_message: '',
      last_message_at: new Date().toISOString(),
      unread_count: 0,
    };
    setActiveConv(newConv);
  };

  if (activeConv) {
    return <ChatScreen conv={activeConv} onBack={() => { setActiveConv(null); queryClient.invalidateQueries({ queryKey: ['conversations'] }); }} />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MENSAGENS</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={() => setNewMsgVisible(true)}>
          <Text style={{ fontSize: 20 }}>✏️</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={conversations ?? []}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <ConversationItem conv={item} onPress={() => setActiveConv(item)} />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: Colors.border, marginLeft: 76 }} />}
          ListEmptyComponent={() => (
            <EmptyState emoji="💬" title="Sem mensagens" subtitle="Toque no ✏️ para iniciar uma conversa!" />
          )}
          onRefresh={refetch}
          refreshing={false}
        />
      )}

      <NewMessageModal
        visible={newMsgVisible}
        onClose={() => setNewMsgVisible(false)}
        onSelectUser={handleSelectUser}
      />
    </View>
  );
}

// ─── CHAT SCREEN ─────────────────────────────────────────────────────────────
function ChatScreen({ conv, onBack }: { conv: Conversation; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);
  const queryClient = useQueryClient();

  const { data: messages, isLoading } = useQuery({
    queryKey: ['messages', conv.id],
    queryFn: () => messagesService.getMessages(conv.id),
    select: (res: any) => {
      const raw = res?.data ?? res ?? [];
      return Array.isArray(raw) ? raw.map((m: any) => ({
        id: String(m.id),
        sender_id: String(m.sender_id ?? m.from_user_id),
        body: m.body ?? m.text ?? '',
        is_read: !!m.is_read,
        created_at: m.created_at ?? new Date().toISOString(),
      })) : [];
    },
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: (body: string) => messagesService.send(conv.other_id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conv.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    },
    onError: (err: any) => Alert.alert('Erro ao enviar', err?.message ?? 'Nao foi possivel enviar a mensagem.'),
  });

  const sendMessage = () => {
    if (!text.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendMutation.mutate(text.trim());
    setText('');
  };

  const renderMsg = ({ item, index }: { item: Message; index: number }) => {
    const isMe = String(item.sender_id) === String((user as any)?.id);
    const allMessages = messages ?? [];
    const prevItem = allMessages[index - 1];
    const showAvatar = !isMe && (!prevItem || String(prevItem.sender_id) === String((user as any)?.id));
    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {!isMe && showAvatar
          ? <Avatar user={{ id: conv.other_id, username: conv.other_username, displayName: conv.other_name, avatar: conv.other_avatar } as any} size={28} />
          : !isMe && <View style={{ width: 28 }} />
        }
        <View style={[styles.msgBubble, isMe && styles.msgBubbleMe]}>
          <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.body}</Text>
          <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>{timeAgo(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
          <Text style={{ color: Colors.text, fontSize: 20 }}>←</Text>
        </TouchableOpacity>
        <Avatar user={{ id: conv.other_id, username: conv.other_username, displayName: conv.other_name, avatar: conv.other_avatar } as any} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={styles.chatHeaderName}>{conv.other_name || conv.other_username}</Text>
          <Text style={styles.chatHeaderStatus}>@{conv.other_username}</Text>
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('UserProfile', { userId: conv.other_id, username: conv.other_username })}>
          <Text style={{ fontSize: 18 }}>👤</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages ?? []}
          keyExtractor={item => item.id}
          renderItem={renderMsg}
          contentContainerStyle={styles.chatList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>💬</Text>
              <Text style={{ fontFamily: Fonts.body, color: Colors.muted, fontSize: 14 }}>Comece a conversa!</Text>
            </View>
          )}
        />
      )}

      <View style={[styles.chatInput, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={styles.chatInputField}
          value={text}
          onChangeText={setText}
          placeholder="Mensagem..."
          placeholderTextColor={Colors.muted}
          multiline
          maxLength={1000}
          returnKeyType="send"
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sendMutation.isPending) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!text.trim() || sendMutation.isPending}
        >
          {sendMutation.isPending
            ? <ActivityIndicator color="#0a0a0f" size="small" />
            : <Text style={{ fontSize: 18, color: '#0a0a0f' }}>↑</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}


// ─── SCRAPS SECTION (para usar dentro do ProfileScreen) ──────────────────────
export function ScrapsSection({ userId, isMyProfile }: { userId: string; isMyProfile: boolean }) {
  const { user } = useAuthStore();
  const [scraps, setScraps] = useState<Scrap[]>(MOCK_SCRAPS);
  const [composing, setComposing] = useState(false);
  const [scrapText, setScrapText] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  const sendScrap = () => {
    if (!scrapText.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newScrap: Scrap = {
      id: Math.random().toString(),
      from_user_id: 'me',
      from_username: user?.username ?? 'você',
      from_name: user?.displayName ?? 'Você',
      body: scrapText.trim(),
      is_private: isPrivate,
      created_at: new Date().toISOString(),
    };
    setScraps(prev => [newScrap, ...prev]);
    setScrapText(''); setComposing(false);
  };

  const removeScrap = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setScraps(prev => prev.filter(s => s.id !== id));
  };

  return (
    <View style={styles.scrapsSection}>
      <View style={styles.scrapsHeader}>
        <Text style={styles.scrapsTitle}>📬 Recados ({scraps.length})</Text>
        {!isMyProfile && (
          <TouchableOpacity
            style={styles.writeScrapBtn}
            onPress={() => setComposing(true)}
          >
            <Text style={styles.writeScrapText}>+ Deixar recado</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Composer */}
      {composing && (
        <View style={styles.scrapComposer}>
          <TextInput
            style={styles.scrapInput}
            value={scrapText}
            onChangeText={setScrapText}
            placeholder="Escreva um recado..."
            placeholderTextColor={Colors.muted}
            multiline
            maxLength={500}
            autoFocus
          />
          <View style={styles.scrapComposerFooter}>
            <TouchableOpacity
              style={[styles.scrapPrivateBtn, isPrivate && styles.scrapPrivateBtnActive]}
              onPress={() => setIsPrivate(!isPrivate)}
            >
              <Text style={{ fontSize: 12 }}>{isPrivate ? '🔒' : '👁'}</Text>
              <Text style={[styles.scrapPrivateText, isPrivate && { color: Colors.accent }]}>
                {isPrivate ? 'Privado' : 'Público'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.scrapCancelBtn} onPress={() => setComposing(false)}>
              <Text style={{ color: Colors.muted, fontSize: 13 }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.scrapSendBtn, !scrapText.trim() && { opacity: 0.4 }]}
              onPress={sendScrap}
              disabled={!scrapText.trim()}
            >
              <Text style={styles.scrapSendText}>Enviar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Scraps list */}
      {scraps.map(scrap => (
        <View key={scrap.id} style={styles.scrapCard}>
          <Avatar user={{ id: scrap.from_user_id, username: scrap.from_username, displayName: scrap.from_name } as any} size={36} />
          <View style={styles.scrapContent}>
            <View style={styles.scrapCardHeader}>
              <Text style={styles.scrapAuthor}>{scrap.from_name}</Text>
              {scrap.is_private && <Text style={{ fontSize: 11 }}>🔒</Text>}
              <Text style={styles.scrapTime}>{timeAgo(scrap.created_at)}</Text>
            </View>
            <Text style={styles.scrapBody}>{scrap.body}</Text>
          </View>
          {(isMyProfile || scrap.from_user_id === 'me') && (
            <TouchableOpacity onPress={() => removeScrap(scrap.id)} style={styles.scrapRemoveBtn}>
              <Text style={{ color: Colors.muted, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      {scraps.length === 0 && (
        <View style={styles.scrapsEmpty}>
          <Text style={{ fontSize: 32 }}>📭</Text>
          <Text style={styles.scrapsEmptyText}>Sem recados ainda</Text>
        </View>
      )}
    </View>
  );
}

// ─── FANS SECTION (para usar dentro do ProfileScreen) ────────────────────────
export function FansSection({ userId }: { userId: string }) {
  const { user } = useAuthStore();
  const [isFan, setIsFan] = useState(false);
  const [fansCount, setFansCount] = useState(48);

  const MOCK_FANS = [
    { id: 'u1', username: 'mari_rpg',  displayName: 'Mari RPG' },
    { id: 'u2', username: 'luca.dev',  displayName: 'Luca' },
    { id: 'u3', username: 'rodrigao',  displayName: 'Rodrigão' },
    { id: 'u4', username: 'kae_plays', displayName: 'Kae' },
  ];

  const toggleFan = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsFan(!isFan);
    setFansCount(c => isFan ? c - 1 : c + 1);
  };

  return (
    <View style={styles.fansSection}>
      <View style={styles.fansSectionHeader}>
        <Text style={styles.fansTitle}>⭐ Fãs ({fansCount})</Text>
        {userId !== user?.id && (
          <TouchableOpacity
            style={[styles.fanBtn, isFan && styles.fanBtnActive]}
            onPress={toggleFan}
          >
            <Text style={[styles.fanBtnText, isFan && styles.fanBtnTextActive]}>
              {isFan ? '⭐ Você é fã' : '☆ Ser fã'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.fansGrid}>
        {MOCK_FANS.map(fan => (
          <View key={fan.id} style={styles.fanItem}>
            <Avatar user={fan as any} size={40} />
            <Text style={styles.fanName} numberOfLines={1}>{fan.displayName}</Text>
          </View>
        ))}
        {fansCount > 4 && (
          <View style={styles.fanItem}>
            <View style={styles.fanMoreBubble}>
              <Text style={styles.fanMoreText}>+{fansCount - 4}</Text>
            </View>
            <Text style={styles.fanName}>ver todos</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontFamily: Fonts.display, fontSize: 26, letterSpacing: 3, color: Colors.text },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md },

  // Conversations
  convItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.lg, paddingVertical: 14 },
  onlineDot: { position: 'absolute', bottom: 2, right: 2, width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.teal, borderWidth: 2, borderColor: Colors.bg },
  convInfo: { flex: 1 },
  convHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  convName: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text },
  convTime: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  convPreview: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  convLastMsg: { fontFamily: Fonts.body, fontSize: 13, color: Colors.muted, flex: 1 },
  convLastMsgUnread: { color: Colors.text, fontFamily: Fonts.bodyMedium },
  unreadBadge: { backgroundColor: Colors.accent, borderRadius: 99, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginLeft: 8 },
  unreadBadgeText: { fontFamily: Fonts.monoBold, fontSize: 10, color: '#0a0a0f' },

  // Chat
  chatHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.lg, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  chatHeaderName: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text },
  chatHeaderStatus: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  chatList: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg, gap: 8 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgBubble: { maxWidth: '75%', backgroundColor: Colors.surface, borderRadius: Radius.lg, borderBottomLeftRadius: 4, padding: Spacing.md },
  msgBubbleMe: { backgroundColor: Colors.accent + '20', borderBottomLeftRadius: Radius.lg, borderBottomRightRadius: 4, borderWidth: 1, borderColor: Colors.accent + '30' },
  msgText: { fontFamily: Fonts.body, fontSize: 14, color: Colors.text, lineHeight: 20 },
  msgTextMe: { color: Colors.text },
  msgTime: { fontFamily: Fonts.mono, fontSize: 9, color: Colors.muted, marginTop: 4 },
  msgTimeMe: { textAlign: 'right' },
  chatInput: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: Spacing.lg, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bg },
  chatInputField: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.xl, paddingHorizontal: 16, paddingVertical: 10, color: Colors.text, fontFamily: Fonts.body, fontSize: 14, maxHeight: 100, borderWidth: 1, borderColor: Colors.border },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, paddingHorizontal: Spacing.lg, paddingBottom: 40, paddingTop: Spacing.md },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontFamily: Fonts.display, fontSize: 18, letterSpacing: 2, color: Colors.text, marginBottom: Spacing.md },
  modalSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.bg, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md },
  modalSearchInput: { flex: 1, fontFamily: Fonts.body, fontSize: 14, color: Colors.text },
  modalEmpty: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted, textAlign: 'center', paddingVertical: Spacing.md },
  modalUserItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalUserName: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text },
  modalUserHandle: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  modalCancelBtn: { marginTop: Spacing.lg, paddingVertical: 14, alignItems: 'center', backgroundColor: Colors.bg, borderRadius: Radius.lg },
  modalCancelText: { fontFamily: Fonts.bodyBold, fontSize: 15, color: Colors.muted },


  scrapsSection: { paddingVertical: Spacing.lg },
  scrapsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  scrapsTitle: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.text },
  writeScrapBtn: { backgroundColor: Colors.surface, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: Colors.accent + '60' },
  writeScrapText: { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.accent },
  scrapComposer: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, marginBottom: Spacing.md },
  scrapInput: { fontFamily: Fonts.body, fontSize: 14, color: Colors.text, minHeight: 80, textAlignVertical: 'top' },
  scrapComposerFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md },
  scrapPrivateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border },
  scrapPrivateBtnActive: { borderColor: Colors.accent },
  scrapPrivateText: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  scrapCancelBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  scrapSendBtn: { marginLeft: 'auto' as any, backgroundColor: Colors.accent, borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 7 },
  scrapSendText: { fontFamily: Fonts.monoBold, fontSize: 12, color: '#0a0a0f' },
  scrapCard: { flexDirection: 'row', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  scrapContent: { flex: 1 },
  scrapCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  scrapAuthor: { fontFamily: Fonts.bodyBold, fontSize: 13, color: Colors.text },
  scrapTime: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, marginLeft: 'auto' as any },
  scrapBody: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  scrapRemoveBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  scrapsEmpty: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: 8 },
  scrapsEmptyText: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted },

  // Fans
  fansSection: { paddingVertical: Spacing.lg },
  fansSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  fansTitle: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.text },
  fanBtn: { borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  fanBtnActive: { borderColor: Colors.amber, backgroundColor: Colors.amber + '15' },
  fanBtnText: { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.muted },
  fanBtnTextActive: { color: Colors.amber },
  fansGrid: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  fanItem: { alignItems: 'center', gap: 6, width: 56 },
  fanName: { fontFamily: Fonts.mono, fontSize: 9, color: Colors.muted, textAlign: 'center', maxWidth: 56 },
  fanMoreBubble: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  fanMoreText: { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.muted },
});
