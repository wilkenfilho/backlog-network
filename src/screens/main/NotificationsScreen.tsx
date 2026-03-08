import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Spacing, Radius } from '../../theme';
import { Avatar, EmptyState } from '../../components';
import { notificationsService } from '../../services/api';

const TYPE_CONFIG: Record<string, { emoji: string; color: string }> = {
  like_post:          { emoji: '♥',  color: Colors.red },
  like_review:        { emoji: '♥',  color: Colors.red },
  comment:            { emoji: '💬', color: Colors.purple },
  follow:             { emoji: '👤', color: Colors.accent },
  new_scrap:          { emoji: '📬', color: Colors.teal },
  new_fan:            { emoji: '⭐', color: Colors.amber },
  community_approved: { emoji: '✅', color: Colors.accent },
  achievement:        { emoji: '🏆', color: Colors.amber },
  game_release:       { emoji: '🎮', color: Colors.purple },
};

function timeAgo(d: string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60)    return 'agora';
  if (s < 3600)  return `${Math.floor(s / 60)}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsService.getAll(),
    select: (res: any) => res.data?.data ?? [],
  });

  const readAllMutation = useMutation({
    mutationFn: () => notificationsService.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const readOneMutation = useMutation({
    mutationFn: (id: string) => notificationsService.markRead(id),
  });

  const notifs: any[] = data ?? [];
  const unreadCount = notifs.filter((n: any) => !n.is_read).length;

  const handlePress = (notif: any) => {
    readOneMutation.mutate(notif.id);
    if (notif.actor_id) navigation.navigate('UserProfile', { userId: notif.actor_id });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ color: Colors.text, fontSize: 20 }}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>NOTIFICAÇÕES</Text>
          {unreadCount > 0 && <Text style={styles.headerSub}>{unreadCount} não lida{unreadCount > 1 ? 's' : ''}</Text>}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); readAllMutation.mutate(); }}>
            <Text style={styles.markAllText}>Marcar todas</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifs}
        keyExtractor={(item: any) => item.id}
        renderItem={({ item }) => {
          const cfg = TYPE_CONFIG[item.type] ?? { emoji: '🔔', color: Colors.muted };
          return (
            <TouchableOpacity
              style={[styles.notifItem, !item.is_read && styles.notifItemUnread]}
              onPress={() => handlePress(item)}
              activeOpacity={0.8}
            >
              {!item.is_read && <View style={styles.unreadDot} />}
              <View style={[styles.notifIcon, { backgroundColor: cfg.color + '20', borderColor: cfg.color + '40' }]}>
                {item.actor_username
                  ? <Avatar user={{ id: item.actor_id, username: item.actor_username, displayName: item.actor_username } as any} size={36} />
                  : <Text style={{ fontSize: 18 }}>{cfg.emoji}</Text>
                }
                <View style={[styles.notifTypeDot, { backgroundColor: cfg.color }]}>
                  <Text style={{ fontSize: 8 }}>{cfg.emoji}</Text>
                </View>
              </View>
              <View style={styles.notifContent}>
                <Text style={styles.notifMsg}>{item.message}</Text>
                <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.accent} />}
        ListEmptyComponent={() => (
          isLoading
            ? <View style={{ padding: 40, alignItems: 'center' }}><Text style={{ color: Colors.muted, fontFamily: Fonts.mono }}>Carregando...</Text></View>
            : <EmptyState emoji="🔔" title="Sem notificações" subtitle="Quando alguém interagir com você, aparece aqui." />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: Colors.border }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.display, fontSize: 22, letterSpacing: 3, color: Colors.text },
  headerSub: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.accent, marginTop: 2 },
  markAllBtn: { marginLeft: 'auto' as any, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  markAllText: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  notifItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.lg, paddingVertical: 14, position: 'relative' },
  notifItemUnread: { backgroundColor: Colors.accent + '06' },
  unreadDot: { position: 'absolute', left: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accent },
  notifIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, position: 'relative' },
  notifTypeDot: { position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.bg },
  notifContent: { flex: 1 },
  notifMsg: { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.text, lineHeight: 19, marginBottom: 3 },
  notifTime: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
});
