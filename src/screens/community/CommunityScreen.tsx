import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Colors, Fonts, Spacing, Radius, Shadows } from '../../theme';
import { Avatar, Button, EmptyState } from '../../components';
import { useAuthStore } from '../../store/authStore';
import { timeAgo } from '../../utils/helpers';
import { communitiesService, topicsService } from '../../services/api';

type Role = 'owner' | 'admin' | 'mod' | 'member' | 'banned' | null;
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

const ROLE_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  owner:  { label: 'Dono',   color: '#ff5c5c', emoji: '👑' },
  admin:  { label: 'Admin',  color: '#ffaa00', emoji: '⚡' },
  mod:    { label: 'Mod',    color: Colors.purple, emoji: '🛡️' },
  member: { label: 'Membro', color: Colors.muted, emoji: '' },
};

function formatCount(n: number | null | undefined): string {
  if (n == null) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

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

function TopicCard({ topic, myRole, onPress, onLike, onModerate }: {
  topic: Topic; myRole: Role;
  onPress: () => void; onLike: () => void;
  onModerate: (action: string) => void;
}) {
  const [liked, setLiked] = useState(!!topic.is_liked);
  const [likes, setLikes] = useState(Number(topic.likes_count ?? 0));
  const isMod = !!(myRole && ['mod', 'admin', 'owner'].includes(myRole));

  return (
    <TouchableOpacity style={styles.topicCard} onPress={onPress} activeOpacity={0.85}>
      {!!topic.is_pinned && (
        <View style={styles.pinnedBadge}><Text style={styles.pinnedText}>📌 FIXADO</Text></View>
      )}
      <View style={styles.topicHeader}>
        <Avatar user={{ id: topic.user_id, username: topic.username, displayName: topic.display_name, avatar: topic.avatar_url } as any} size={32} />
        <View style={{ flex: 1 }}>
          <Text style={styles.topicAuthor}>{topic.display_name}</Text>
          <Text style={styles.topicTime}>{timeAgo(topic.created_at)}</Text>
        </View>
        {!!topic.is_locked && <Text style={{ fontSize: 14 }}>🔒</Text>}
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
        <TouchableOpacity style={styles.topicAction} onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setLiked(!liked); setLikes(c => liked ? c - 1 : c + 1);
          onLike();
        }}>
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

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();

  const { communityId, community: routeCommunity } = route.params ?? {};
  const [tab, setTab] = useState<'topics' | 'members' | 'about'>('topics');
  const [sort, setSort] = useState<'activity' | 'new' | 'top'>('activity');
  const [refreshing, setRefreshing] = useState(false);

  const { data: community, isLoading, refetch: refetchCommunity } = useQuery({
    queryKey: ['community', communityId],
    queryFn: () => communitiesService.get(communityId),
    select: (raw: any) => raw?.community ?? raw?.data ?? raw,
    initialData: routeCommunity ?? undefined,
    enabled: !!communityId,
  });

  const { data: topics = [], refetch: refetchTopics } = useQuery({
    queryKey: ['community-topics', communityId, sort],
    queryFn: () => topicsService.list(communityId, { sort }),
    select: (raw: any) => { const arr = raw?.data ?? raw?.topics ?? raw ?? []; return Array.isArray(arr) ? arr : []; },
    enabled: !!communityId && tab === 'topics',
  });

  const { data: members = [] } = useQuery({
    queryKey: ['community-members', communityId],
    queryFn: () => communitiesService.getMembers(communityId),
    select: (raw: any) => { const arr = raw?.data ?? raw?.members ?? raw ?? []; return Array.isArray(arr) ? arr : []; },
    enabled: !!communityId && tab === 'members',
  });

  const myRole: Role = community?.my_role ?? null;
  const isMember = !!myRole && myRole !== 'banned';
  const isMod = !!(myRole && ['mod', 'admin', 'owner'].includes(myRole));
  const isPrivate = community?.is_private === 1 || community?.is_private === true || community?.type === 'private' || community?.type === 'closed';

  const joinMutation = useMutation({
    mutationFn: () => communitiesService.join(communityId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community', communityId] }),
    onError: () => Alert.alert('Erro', 'Não foi possível entrar na comunidade.'),
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchCommunity(), refetchTopics()]);
    setRefreshing(false);
  }, [refetchCommunity, refetchTopics]);

  const handleModTopic = async (topicId: string, action: string) => {
    if (action === 'pin') {
      await topicsService.pin(topicId).catch(() => {});
      refetchTopics();
    } else if (action === 'remove') {
      Alert.alert('Remover tópico', 'Qual o motivo?', [
        { text: 'Spam', onPress: async () => { await topicsService.remove(topicId, 'spam').catch(() => {}); refetchTopics(); } },
        { text: 'Conteúdo inapropriado', onPress: async () => { await topicsService.remove(topicId, 'inappropriate').catch(() => {}); refetchTopics(); } },
        { text: 'Cancelar', style: 'cancel' },
      ]);
    }
  };

  if (isLoading && !community) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  if (!community) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: 32 }]}>
        <Text style={{ color: Colors.muted, fontFamily: Fonts.mono, textAlign: 'center' }}>Comunidade não encontrada.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          <Text style={{ color: Colors.accent, fontFamily: Fonts.bodyBold }}>← Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const staff: StaffMember[] = community.staff ?? [];

  const ListHeader = () => (
    <View>
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
          {!!isMod && (
            <TouchableOpacity
              onPress={() => navigation.navigate('CommunitySettings', { communityId: community.id ?? communityId, community })}
              style={styles.backBubble}
            >
              <BlurView intensity={40} tint="dark" style={styles.backBubbleBlur}>
                <Text style={{ fontSize: 18 }}>⚙️</Text>
              </BlurView>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.communityInfo}>
        <View style={styles.communityNameRow}>
          <Text style={styles.communityName}>{community.name}</Text>
          {!!community.is_verified && <Text style={{ fontSize: 18 }}>✅</Text>}
        </View>

        <View style={styles.communityStats}>
          <View style={styles.communityStat}>
            <Text style={styles.communityStatNum}>{formatCount(community.members_count ?? 0)}</Text>
            <Text style={styles.communityStatLabel}>membros</Text>
          </View>
          <View style={styles.communityStatDivider} />
          <View style={styles.communityStat}>
            <Text style={styles.communityStatNum}>{formatCount(community.topics_count ?? 0)}</Text>
            <Text style={styles.communityStatLabel}>tópicos</Text>
          </View>
          <View style={styles.communityStatDivider} />
          <View style={styles.communityStat}>
            <Text style={styles.communityStatNum}>{isPrivate ? '🔒' : '🌍'}</Text>
            <Text style={styles.communityStatLabel}>{isPrivate ? 'privada' : 'pública'}</Text>
          </View>
        </View>

        <Text style={styles.communityDesc} numberOfLines={3}>{community.description}</Text>

        {staff.length > 0 && (
          <View style={styles.staffRow}>
            {staff.map((s: StaffMember) => (
              <View key={s.id} style={styles.staffItem}>
                <Avatar user={{ id: s.id, username: s.username, displayName: s.display_name } as any} size={28} />
                <RoleBadge role={s.role ?? 'member'} />
              </View>
            ))}
          </View>
        )}

        {!isMember ? (
          <Button
            label={joinMutation.isPending
              ? '...'
              : isPrivate ? '✉️ Solicitar entrada' : '+ Entrar na comunidade'}
            onPress={() => {
              if (joinMutation.isPending) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              joinMutation.mutate();
            }}
            style={{ marginTop: Spacing.md, opacity: joinMutation.isPending ? 0.6 : 1 }}
          />
        ) : (
          <View style={styles.memberBadgeRow}>
            <View style={styles.memberBadge}>
              <Text style={styles.memberBadgeText}>
                {myRole ? (ROLE_CONFIG[myRole]?.emoji ?? '') + ' ' : ''}
                {myRole === 'member' ? 'Você é membro' : `Você é ${ROLE_CONFIG[myRole ?? 'member']?.label}`}
              </Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.tabsRow}>
        {(['topics', 'members', 'about'] as const).map(t => (
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
          {(['activity', 'new', 'top'] as const).map(s => (
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
              onPress={() => navigation.navigate('TopicCreate', {
                communityId: community.id ?? communityId,
                communityName: community.name
              })}
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
    if (tab === 'members') return (
      <View style={styles.aboutSection}>
        {members.length === 0
          ? <Text style={{ color: Colors.muted, fontFamily: Fonts.mono, fontSize: 12, textAlign: 'center', paddingVertical: 24 }}>Nenhum membro encontrado.</Text>
          : (members as any[]).map((m) => (
            <View key={m.id ?? m.user_id} style={styles.staffCard}>
              <Avatar user={{ id: m.id ?? m.user_id, username: m.username, displayName: m.display_name } as any} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.staffCardName}>{m.display_name ?? m.username}</Text>
                <Text style={styles.staffCardUsername}>@{m.username}</Text>
              </View>
              <RoleBadge role={m.role ?? 'member'} />
            </View>
          ))
        }
      </View>
    );

    if (tab === 'about') return (
      <View style={styles.aboutSection}>
        {community.rules ? (
          <>
            <Text style={styles.sectionTitle}>Regras da comunidade</Text>
            <View style={styles.rulesBox}>
              <Text style={styles.rulesText}>{community.rules}</Text>
            </View>
          </>
        ) : null}
        {staff.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: Spacing.xxl }]}>Administração</Text>
            {staff.map((s: StaffMember) => (
              <View key={s.id} style={styles.staffCard}>
                <Avatar user={{ id: s.id, username: s.username, displayName: s.display_name } as any} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.staffCardName}>{s.display_name}</Text>
                  <Text style={styles.staffCardUsername}>@{s.username}</Text>
                </View>
                <RoleBadge role={s.role ?? 'member'} />
              </View>
            ))}
          </>
        )}
        {community.game_title && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: Spacing.xxl }]}>Jogo vinculado</Text>
            <View style={[styles.rulesBox, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
              {community.game_cover && (
                <Image source={{ uri: community.game_cover }} style={{ width: 44, height: 58, borderRadius: Radius.sm }} contentFit="cover" />
              )}
              <Text style={styles.rulesText}>{community.game_title}</Text>
            </View>
          </>
        )}
      </View>
    );

    return null;
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={tab === 'topics' ? (topics as Topic[]) : []}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TopicCard
            topic={item}
            myRole={myRole}
            onPress={() => navigation.navigate('TopicDetail', { topicId: item.id })}
            onLike={() => {
              if (item.is_liked) topicsService.unlike(item.id).catch(() => {});
              else topicsService.like(item.id).catch(() => {});
            }}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
  cover: { height: 180, position: 'relative', marginHorizontal: -Spacing.lg },
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
  topicCard: { backgroundColor: Colors.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, ...Shadows.card },
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
});