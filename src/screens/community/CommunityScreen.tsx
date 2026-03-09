import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ScrollView, RefreshControl, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';

import { Colors, Fonts, Spacing, Radius, Shadows } from '../../theme';
import { Avatar, Button, EmptyState, SectionHeader } from '../../components';
import { useAuthStore } from '../../store/authStore';
import { timeAgo } from '../../utils/helpers';

// ─── TYPES ───────────────────────────────────────────────────────────────────
type Role = 'owner' | 'admin' | 'mod' | 'member' | 'banned' | null;
type CommunityType = 'public' | 'closed' | 'private';

interface Community {
  id: string; slug: string; name: string; description: string;
  type: CommunityType; members_count: number; topics_count: number;
  cover_url?: string; icon_url?: string; rules?: string;
  my_role: Role; my_status: string; is_verified: boolean;
  staff: StaffMember[];
}

interface StaffMember {
  id: string; username: string; display_name: string;
  avatar_url?: string; role: Role;
}

interface Topic {
  id: string; title: string; body: string; user_id: string;
  username: string; display_name: string; avatar_url?: string;
  is_pinned: boolean; is_locked: boolean; likes_count: number;
  replies_count: number; views_count: number;
  last_reply_at: string; created_at: string; is_liked: boolean;
}

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
const MOCK_COMMUNITY: Community = {
  id: 'c1', slug: 'fas-de-elden-ring',
  name: 'Fãs de Elden Ring 🐉',
  description: 'A maior comunidade brasileira de Elden Ring. Compartilhe builds, lore, conquistas e sofra junto com a gente.',
  type: 'public', members_count: 12847, topics_count: 3241,
  my_role: 'member', my_status: 'active', is_verified: true,
  rules: '1. Sem spoilers sem aviso\n2. Respeite os outros\n3. Posts OT serão removidos',
  staff: [
    { id: 'u1', username: 'wilken', display_name: 'Wilken P.', role: 'owner' },
    { id: 'u2', username: 'mari_rpg', display_name: 'Mari', role: 'admin' },
    { id: 'u3', username: 'luca.dev', display_name: 'Luca', role: 'mod' },
  ],
};

const MOCK_TOPICS: Topic[] = [
  { id: 't1', title: '📌 Guia completo de builds para iniciantes', body: '', user_id: 'u1', username: 'wilken', display_name: 'Wilken P.', is_pinned: true, is_locked: false, likes_count: 847, replies_count: 234, views_count: 12400, last_reply_at: new Date().toISOString(), created_at: new Date().toISOString(), is_liked: false },
  { id: 't2', title: 'Qual boss foi mais difícil pra vocês? (sem spoiler do DLC)', body: '', user_id: 'u2', username: 'mari_rpg', display_name: 'Mari', is_pinned: false, is_locked: false, likes_count: 312, replies_count: 98, views_count: 4200, last_reply_at: new Date(Date.now() - 3600000).toISOString(), created_at: new Date(Date.now() - 3600000).toISOString(), is_liked: true },
  { id: 't3', title: 'Rate my build! Arcane 80 com Mohgwyn Sacred Spear', body: '', user_id: 'u3', username: 'kae_plays', display_name: 'Kae', is_pinned: false, is_locked: false, likes_count: 128, replies_count: 44, views_count: 1800, last_reply_at: new Date(Date.now() - 7200000).toISOString(), created_at: new Date(Date.now() - 7200000).toISOString(), is_liked: false },
  { id: 't4', title: 'Lore do Elden Ring explicado do início ao fim', body: '', user_id: 'u4', username: 'rodrigao', display_name: 'Rodrigão', is_pinned: false, is_locked: false, likes_count: 554, replies_count: 76, views_count: 8900, last_reply_at: new Date(Date.now() - 86400000).toISOString(), created_at: new Date(Date.now() - 86400000).toISOString(), is_liked: false },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const ROLE_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  owner: { label: 'Dono',       color: '#ff5c5c', emoji: '👑' },
  admin: { label: 'Admin',      color: '#ffaa00', emoji: '⚡' },
  mod:   { label: 'Mod',        color: Colors.purple, emoji: '🛡️' },
  member:{ label: 'Membro',     color: Colors.muted, emoji: '' },
};


function formatCount(n: number): string {
  if (n >= 1000) return `${(n/1000).toFixed(1)}k`;
  return String(n);
}

// ─── ROLE BADGE ──────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const cfg = ROLE_CONFIG[role];
  if (!cfg || role === 'member') return null;
  return (
    <View style={[styles.roleBadge, { borderColor: cfg.color + '50', backgroundColor: cfg.color + '15' }]}>
      <Text style={{ fontSize: 9 }}>{cfg.emoji}</Text>
      <Text style={[styles.roleBadgeText, { color: cfg.color }]}>{cfg.label.toUpperCase()}</Text>
    </View>
  );
}

// ─── TOPIC CARD ───────────────────────────────────────────────────────────────
function TopicCard({ topic, myRole, onPress, onLike, onModerate }: {
  topic: Topic; myRole: Role;
  onPress: () => void; onLike: () => void;
  onModerate: (action: string) => void;
}) {
  const [liked, setLiked] = useState(topic.is_liked);
  const [likes, setLikes] = useState(topic.likes_count);
  const isMod = myRole && ['mod','admin','owner'].includes(myRole);

  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLiked(!liked); setLikes(c => liked ? c - 1 : c + 1);
    onLike();
  };

  return (
    <TouchableOpacity style={styles.topicCard} onPress={onPress} activeOpacity={0.85}>
      {topic.is_pinned && (
        <View style={styles.pinnedBadge}>
          <Text style={styles.pinnedText}>📌 FIXADO</Text>
        </View>
      )}

      <View style={styles.topicHeader}>
        <Avatar user={{ id: topic.user_id, username: topic.username, displayName: topic.display_name, avatar: topic.avatar_url } as any} size={32} />
        <View style={{ flex: 1 }}>
          <Text style={styles.topicAuthor}>{topic.display_name}</Text>
          <Text style={styles.topicTime}>{timeAgo(topic.created_at)}</Text>
        </View>
        {topic.is_locked && <Text style={{ fontSize: 14 }}>🔒</Text>}
        {isMod && (
          <TouchableOpacity
            style={styles.modBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Alert.alert('Moderação', `Tópico: ${topic.title}`, [
                { text: topic.is_pinned ? 'Desafixar' : 'Fixar', onPress: () => onModerate('pin') },
                { text: 'Remover tópico', style: 'destructive', onPress: () => onModerate('remove') },
                { text: 'Cancelar', style: 'cancel' },
              ]);
            }}
          >
            <Text style={{ color: Colors.muted, fontSize: 18 }}>⋯</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.topicTitle} numberOfLines={2}>{topic.title}</Text>

      <View style={styles.topicFooter}>
        <TouchableOpacity style={styles.topicAction} onPress={handleLike}>
          <Text style={[styles.topicActionIcon, liked && { color: Colors.red }]}>{liked ? '♥' : '♡'}</Text>
          <Text style={[styles.topicActionCount, liked && { color: Colors.red }]}>{formatCount(likes)}</Text>
        </TouchableOpacity>

        <View style={styles.topicAction}>
          <Text style={styles.topicActionIcon}>💬</Text>
          <Text style={styles.topicActionCount}>{formatCount(topic.replies_count)}</Text>
        </View>

        <View style={styles.topicAction}>
          <Text style={styles.topicActionIcon}>👁</Text>
          <Text style={styles.topicActionCount}>{formatCount(topic.views_count)}</Text>
        </View>

        <View style={{ flex: 1 }} />
        <Text style={styles.topicLastReply}>última resposta {timeAgo(topic.last_reply_at)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── MOD PANEL ────────────────────────────────────────────────────────────────
function ModPanel({ community, onClose }: { community: Community; onClose: () => void }) {
  const navigation = useNavigation<any>();
  const items = [
    { emoji: '👥', label: 'Gerenciar membros',    action: () => {} },
    { emoji: '📋', label: 'Fila de aprovação',    action: () => {} },
    { emoji: '🚨', label: 'Denúncias pendentes',  action: () => {} },
    { emoji: '📜', label: 'Log de moderação',      action: () => {} },
    { emoji: '✏️', label: 'Editar comunidade',     action: () => {} },
    { emoji: '📌', label: 'Gerenciar tópicos fixos', action: () => {} },
  ];
  const ownerOnly = [
    { emoji: '🔄', label: 'Transferir ownership', action: () => {} },
    { emoji: '🗑️', label: 'Deletar comunidade',   action: () => Alert.alert('Atenção', 'Tem certeza? Esta ação é irreversível.', [{ text: 'Deletar', style: 'destructive' }, { text: 'Cancelar' }]) },
  ];

  return (
    <View style={styles.modPanelOverlay}>
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.modPanel}>
        <View style={styles.modPanelHandle} />
        <Text style={styles.modPanelTitle}>⚙️ Painel de Moderação</Text>
        <Text style={styles.modPanelSub}>{community.name}</Text>

        {items.map((item, i) => (
          <TouchableOpacity key={i} style={styles.modPanelItem} onPress={item.action}>
            <Text style={{ fontSize: 18, width: 28 }}>{item.emoji}</Text>
            <Text style={styles.modPanelItemText}>{item.label}</Text>
            <Text style={{ color: Colors.muted }}>›</Text>
          </TouchableOpacity>
        ))}

        {community.my_role === 'owner' && (
          <>
            <View style={styles.modPanelDivider} />
            <Text style={styles.modPanelDangerLabel}>ZONA DE PERIGO</Text>
            {ownerOnly.map((item, i) => (
              <TouchableOpacity key={i} style={styles.modPanelItem} onPress={item.action}>
                <Text style={{ fontSize: 18, width: 28 }}>{item.emoji}</Text>
                <Text style={[styles.modPanelItemText, { color: Colors.red }]}>{item.label}</Text>
                <Text style={{ color: Colors.muted }}>›</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
      </View>
    </View>
  );
}

// ─── COMMUNITY SCREEN ─────────────────────────────────────────────────────────
export default function CommunityScreen() {
  const insets   = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();

  const [community] = useState<Community>(MOCK_COMMUNITY);
  const [topics, setTopics]     = useState<Topic[]>(MOCK_TOPICS);
  const [tab, setTab]           = useState<'topics' | 'members' | 'about'>('topics');
  const [sort, setSort]         = useState<'activity' | 'new' | 'top'>('activity');
  const [isMember, setIsMember] = useState(!!community.my_role && community.my_role !== 'banned');
  const [showMod, setShowMod]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const isMod = community.my_role && ['mod','admin','owner'].includes(community.my_role);

  const handleJoin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (community.type === 'public') {
      setIsMember(true);
    } else {
      Alert.alert('Solicitação enviada', 'Os administradores vão analisar seu pedido.');
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 600));
    setRefreshing(false);
  }, []);

  const handleModTopic = (topicId: string, action: string) => {
    if (action === 'pin') {
      setTopics(prev => prev.map(t => t.id === topicId ? { ...t, is_pinned: !t.is_pinned } : t));
    } else if (action === 'remove') {
      Alert.alert('Remover tópico', 'Qual o motivo?', [
        { text: 'Spam', onPress: () => setTopics(prev => prev.filter(t => t.id !== topicId)) },
        { text: 'Conteúdo inapropriado', onPress: () => setTopics(prev => prev.filter(t => t.id !== topicId)) },
        { text: 'Cancelar', style: 'cancel' },
      ]);
    }
  };

  const ListHeader = () => (
    <View>
      {/* COVER */}
      <View style={styles.cover}>
        {community.cover_url
          ? <Image source={{ uri: community.cover_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
          : <LinearGradient colors={['#1a1628', Colors.purple + '80', Colors.bg]} style={StyleSheet.absoluteFill} />
        }
        <View style={[styles.coverOverlay, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBubble}>
            <BlurView intensity={40} tint="dark" style={styles.backBubbleBlur}>
              <Text style={{ color: Colors.text, fontSize: 18 }}>←</Text>
            </BlurView>
          </TouchableOpacity>
          {isMod && (
            <TouchableOpacity onPress={() => setShowMod(true)} style={styles.backBubble}>
              <BlurView intensity={40} tint="dark" style={styles.backBubbleBlur}>
                <Text style={{ fontSize: 18 }}>⚙️</Text>
              </BlurView>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* INFO */}
      <View style={styles.communityInfo}>
        <View style={styles.communityNameRow}>
          <Text style={styles.communityName}>{community.name}</Text>
          {community.is_verified && <Text style={{ fontSize: 18 }}>✅</Text>}
        </View>

        <View style={styles.communityStats}>
          <View style={styles.communityStat}>
            <Text style={styles.communityStatNum}>{formatCount(community.members_count)}</Text>
            <Text style={styles.communityStatLabel}>membros</Text>
          </View>
          <View style={styles.communityStatDivider} />
          <View style={styles.communityStat}>
            <Text style={styles.communityStatNum}>{formatCount(community.topics_count)}</Text>
            <Text style={styles.communityStatLabel}>tópicos</Text>
          </View>
          <View style={styles.communityStatDivider} />
          <View style={styles.communityStat}>
            <Text style={[styles.communityStatNum, { color: community.type === 'public' ? Colors.accent : community.type === 'closed' ? Colors.amber : Colors.red }]}>
              {community.type === 'public' ? '🌍' : community.type === 'closed' ? '🔒' : '🔑'}
            </Text>
            <Text style={styles.communityStatLabel}>{community.type === 'public' ? 'pública' : community.type === 'closed' ? 'fechada' : 'privada'}</Text>
          </View>
        </View>

        <Text style={styles.communityDesc} numberOfLines={3}>{community.description}</Text>

        {/* Staff */}
        <View style={styles.staffRow}>
          {community.staff.map(s => (
            <View key={s.id} style={styles.staffItem}>
              <Avatar user={{ id: s.id, username: s.username, displayName: s.display_name } as any} size={28} />
              <RoleBadge role={s.role ?? 'member'} />
            </View>
          ))}
        </View>

        {/* Join / Leave button */}
        {!isMember ? (
          <Button
            label={community.type === 'public' ? '+ Entrar na comunidade' : '✉️ Solicitar entrada'}
            onPress={handleJoin}
            style={{ marginTop: Spacing.md }}
          />
        ) : (
          <View style={styles.memberBadgeRow}>
            <View style={styles.memberBadge}>
              <Text style={styles.memberBadgeText}>
                {community.my_role ? (ROLE_CONFIG[community.my_role]?.emoji ?? '') + ' ' : ''}
                {community.my_role === 'member' ? 'Você é membro' : `Você é ${ROLE_CONFIG[community.my_role ?? 'member']?.label}`}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* TABS */}
      <View style={styles.tabsRow}>
        {(['topics','members','about'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => { Haptics.selectionAsync(); setTab(t); }}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'topics' ? 'Tópicos' : t === 'members' ? 'Membros' : 'Sobre'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'topics' && (
        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>Ordenar:</Text>
          {(['activity','new','top'] as const).map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.sortChip, sort === s && styles.sortChipActive]}
              onPress={() => { Haptics.selectionAsync(); setSort(s); }}
            >
              <Text style={[styles.sortText, sort === s && styles.sortTextActive]}>
                {s === 'activity' ? 'Atividade' : s === 'new' ? 'Novo' : 'Top'}
              </Text>
            </TouchableOpacity>
          ))}

          {isMember && (
            <TouchableOpacity
              style={styles.newTopicBtn}
              onPress={() => navigation.navigate('TopicCreate', { communityId: community.id })}
            >
              <LinearGradient colors={[Colors.accent, Colors.accentDark]} style={styles.newTopicGradient}>
                <Text style={styles.newTopicText}>+ Novo tópico</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  const ListFooter = () => {
    if (tab === 'about') return (
      <View style={styles.aboutSection}>
        <Text style={styles.sectionTitle}>Regras da comunidade</Text>
        <View style={styles.rulesBox}>
          <Text style={styles.rulesText}>{community.rules ?? 'Sem regras definidas.'}</Text>
        </View>
        <Text style={[styles.sectionTitle, { marginTop: Spacing.xxl }]}>Administração</Text>
        {community.staff.map(s => (
          <View key={s.id} style={styles.staffCard}>
            <Avatar user={{ id: s.id, username: s.username, displayName: s.display_name } as any} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.staffCardName}>{s.display_name}</Text>
              <Text style={styles.staffCardUsername}>@{s.username}</Text>
            </View>
            <RoleBadge role={s.role ?? 'member'} />
          </View>
        ))}
      </View>
    );
    return null;
  };

  return (
    <View style={[styles.container]}>
      <FlatList
        data={tab === 'topics' ? topics : []}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TopicCard
            topic={item}
            myRole={community.my_role}
            onPress={() => navigation.navigate('TopicDetail', { topicId: item.id })}
            onLike={() => {}}
            onModerate={(action) => handleModTopic(item.id, action)}
          />
        )}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        ListEmptyComponent={tab === 'topics' ? () => (
          <EmptyState emoji="💬" title="Sem tópicos ainda" subtitle="Seja o primeiro a criar um tópico!" />
        ) : undefined}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.accent} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />

      {showMod && <ModPanel community={community} onClose={() => setShowMod(false)} />}
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },

  cover: { height: 180, position: 'relative', marginHorizontal: -Spacing.lg, marginBottom: 0 },
  coverOverlay: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.lg },
  backBubble: { width: 36, height: 36, borderRadius: Radius.sm, overflow: 'hidden' },
  backBubbleBlur: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  communityInfo: { paddingTop: Spacing.lg, paddingBottom: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  communityNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md },
  communityName: { fontFamily: Fonts.display, fontSize: 26, letterSpacing: 1, color: Colors.text, flex: 1 },
  communityStats: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  communityStat: { flex: 1, alignItems: 'center' },
  communityStatNum: { fontFamily: Fonts.display, fontSize: 20, color: Colors.accent },
  communityStatLabel: { fontFamily: Fonts.mono, fontSize: 9, color: Colors.muted, marginTop: 2 },
  communityStatDivider: { width: 1, height: 28, backgroundColor: Colors.border },
  communityDesc: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.md },
  staffRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md, flexWrap: 'wrap' },
  staffItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  memberBadgeRow: { marginTop: Spacing.md },
  memberBadge: { alignSelf: 'flex-start', backgroundColor: Colors.surface, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: Colors.accent + '50' },
  memberBadgeText: { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.accent },

  tabsRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border, marginHorizontal: -Spacing.lg, paddingHorizontal: Spacing.lg, marginTop: Spacing.md },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: Colors.accent },
  tabText: { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.muted, letterSpacing: 0.5 },
  tabTextActive: { color: Colors.accent },

  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: Spacing.md, flexWrap: 'wrap' },
  sortLabel: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  sortChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  sortChipActive: { borderColor: Colors.accent },
  sortText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  sortTextActive: { color: Colors.accent },
  newTopicBtn: { marginLeft: 'auto' as any, borderRadius: Radius.md, overflow: 'hidden' },
  newTopicGradient: { paddingHorizontal: 14, paddingVertical: 8 },
  newTopicText: { fontFamily: Fonts.monoBold, fontSize: 11, color: '#0a0a0f' },

  topicCard: {
    backgroundColor: Colors.card, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg,
    ...Shadows.card,
  },
  pinnedBadge: { backgroundColor: Colors.accent + '15', borderRadius: Radius.xs, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 8 },
  pinnedText: { fontFamily: Fonts.monoBold, fontSize: 9, color: Colors.accent, letterSpacing: 1 },
  topicHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.sm },
  topicAuthor: { fontFamily: Fonts.bodyBold, fontSize: 12, color: Colors.text },
  topicTime: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  modBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  topicTitle: { fontFamily: Fonts.bodyBold, fontSize: 15, color: Colors.text, lineHeight: 21, marginBottom: Spacing.md },
  topicFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  topicAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  topicActionIcon: { fontSize: 15, color: Colors.muted },
  topicActionCount: { fontFamily: Fonts.bodyMedium, fontSize: 12, color: Colors.muted },
  topicLastReply: { fontFamily: Fonts.mono, fontSize: 9, color: Colors.muted },

  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.full, borderWidth: 1 },
  roleBadgeText: { fontFamily: Fonts.monoBold, fontSize: 9, letterSpacing: 0.5 },

  aboutSection: { paddingVertical: Spacing.lg },
  sectionTitle: { fontFamily: Fonts.monoBold, fontSize: 10, letterSpacing: 2, color: Colors.muted, textTransform: 'uppercase', marginBottom: Spacing.md },
  rulesBox: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  rulesText: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  staffCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  staffCardName: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text },
  staffCardUsername: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted, marginTop: 2 },

  modPanelOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end', zIndex: 999 },
  modPanel: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: Spacing.xxl, paddingBottom: 40, borderTopWidth: 1, borderTopColor: Colors.border },
  modPanelHandle: { width: 36, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.lg },
  modPanelTitle: { fontFamily: Fonts.display, fontSize: 22, letterSpacing: 1.5, color: Colors.text, marginBottom: 4 },
  modPanelSub: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted, marginBottom: Spacing.lg },
  modPanelItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modPanelItemText: { flex: 1, fontFamily: Fonts.bodyMedium, fontSize: 15, color: Colors.text },
  modPanelDivider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.lg },
  modPanelDangerLabel: { fontFamily: Fonts.monoBold, fontSize: 10, color: Colors.red, letterSpacing: 2, marginBottom: Spacing.md },
});
