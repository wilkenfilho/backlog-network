import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Colors, Fonts, Spacing, Radius, Shadows } from '../../theme';
import { GameCover, ProgressBar, EmptyState } from '../../components';
import { backlogService } from '../../services/api';
import type { GameStatus } from '../../types';

const STATUS_FILTERS: { key: GameStatus | 'all'; label: string; emoji: string }[] = [
  { key: 'all',      label: 'Todos',    emoji: '⊞' },
  { key: 'playing',  label: 'Jogando',  emoji: '▶' },
  { key: 'finished', label: 'Zerados',  emoji: '✓' },
  { key: 'backlog',  label: 'Backlog',  emoji: '⊟' },
  { key: 'dropped',  label: 'Largados', emoji: '✕' },
];

const STATUS_COLORS: Record<string, string> = {
  playing: Colors.purple,
  finished: Colors.accent,
  backlog: Colors.red,
  dropped: Colors.muted,
  wishlist: Colors.amber,
};

// ─── MAP API RESPONSE TO APP FORMAT ──────────────────────────────────────────
function mapEntry(raw: any) {
  return {
    id: String(raw.id),
    userId: String(raw.user_id),
    status: raw.status as GameStatus,
    progress: raw.progress ? Number(raw.progress) : undefined,
    hoursPlayed: raw.hours_played ? Number(raw.hours_played) : undefined,
    platform: raw.platform ?? undefined,
    startedAt: raw.started_at,
    finishedAt: raw.finished_at,
    updatedAt: raw.updated_at,
    notes: raw.notes,
    game: {
      id: String(raw.game_id),
      title: raw.title ?? '',
      developer: raw.developer ?? '',
      coverUrl: raw.cover_url,
      rating: raw.rawg_rating ? Number(raw.rawg_rating) : undefined,
      genres: [],
      platforms: [],
    },
  };
}

// ─── BACKLOG ENTRY CARD ───────────────────────────────────────────────────────
function BacklogCard({ entry, onPress, onLongPress }: { entry: any; onPress: () => void; onLongPress: () => void }) {
  const color = STATUS_COLORS[entry.status] ?? Colors.muted;
  return (
    <TouchableOpacity style={styles.entryCard} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.85}>
      <GameCover game={entry.game} width={64} height={84} borderRadius={Radius.md} />
      <View style={styles.entryInfo}>
        <Text style={styles.entryTitle} numberOfLines={2}>{entry.game.title}</Text>
        <Text style={styles.entryDev}>{entry.game.developer}</Text>
        <View style={styles.entryMeta}>
          {entry.platform && (
            <View style={styles.entryPlatform}><Text style={styles.entryPlatformText}>{entry.platform}</Text></View>
          )}
          {entry.hoursPlayed != null && entry.hoursPlayed > 0 && (
            <Text style={styles.entryHours}>⏱ {entry.hoursPlayed}h</Text>
          )}
        </View>
        {entry.progress != null && entry.status === 'playing' && (
          <View style={{ marginTop: 6 }}><ProgressBar progress={entry.progress} color={color} height={4} /></View>
        )}
        {entry.status === 'finished' && entry.finishedAt && (
          <Text style={styles.entryDate}>
            Zerado em {new Date(entry.finishedAt).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
          </Text>
        )}
      </View>
      <View style={[styles.statusLine, { backgroundColor: color }]} />
    </TouchableOpacity>
  );
}

// ─── GRID CARD ────────────────────────────────────────────────────────────────
function GridCard({ entry, onPress }: { entry: any; onPress: () => void }) {
  const color = STATUS_COLORS[entry.status] ?? Colors.muted;
  return (
    <TouchableOpacity style={styles.gridCard} onPress={onPress} activeOpacity={0.85}>
      <GameCover game={entry.game} width={999} height={130} borderRadius={Radius.md} />
      <View style={[styles.gridStatusDot, { backgroundColor: color }]} />
      <Text style={styles.gridTitle} numberOfLines={2}>{entry.game.title}</Text>
    </TouchableOpacity>
  );
}

// ─── STATS ROW ───────────────────────────────────────────────────────────────
function StatsRow({ stats }: { stats: any }) {
  return (
    <View style={styles.statsRow}>
      {[
        { n: stats?.playing ?? 0,      label: 'jogando',  color: Colors.purple },
        { n: stats?.finished ?? 0,     label: 'zerados',  color: Colors.accent },
        { n: stats?.backlog ?? 0,      label: 'backlog',  color: Colors.red },
        { n: stats?.hours_played ?? 0, label: 'horas',    color: Colors.amber },
      ].map(stat => (
        <View key={stat.label} style={styles.statItem}>
          <Text style={[styles.statNumber, { color: stat.color }]}>{stat.n}</Text>
          <Text style={styles.statLabel}>{stat.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── BACKLOG SCREEN ───────────────────────────────────────────────────────────
export default function BacklogScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<GameStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // ─── QUERIES ──────────────────────────────────────────────────────────────
  const { data: backlogData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['my-backlog', activeFilter === 'all' ? undefined : activeFilter],
    queryFn: () => backlogService.getMyBacklog(activeFilter === 'all' ? undefined : activeFilter),
    select: (res: any) => {
      const raw = res.data?.data ?? res.data ?? res ?? [];
      return Array.isArray(raw) ? raw.map(mapEntry) : [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['backlog-stats'],
    queryFn: () => backlogService.getStats(),
    select: (res: any) => res.data ?? res ?? {},
  });

  const entries = backlogData ?? [];
  const totalCount = stats?.total ?? entries.length;

  // ─── DELETE MUTATION ────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (entryId: string) => backlogService.removeGame(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-backlog'] });
      queryClient.invalidateQueries({ queryKey: ['backlog-stats'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => Alert.alert('Erro', 'Não foi possível remover o jogo.'),
  });

  const handleLongPress = (entry: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      entry.game.title,
      'O que deseja fazer?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Alterar status',
          onPress: () => {
            Alert.alert('Alterar status', 'Escolha o novo status:', [
              { text: 'Jogando', onPress: () => updateStatus(entry.id, 'playing') },
              { text: 'Zerado', onPress: () => updateStatus(entry.id, 'finished') },
              { text: 'Backlog', onPress: () => updateStatus(entry.id, 'backlog') },
              { text: 'Largado', onPress: () => updateStatus(entry.id, 'dropped') },
              { text: 'Cancelar', style: 'cancel' },
            ]);
          },
        },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(entry.id),
        },
      ]
    );
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => backlogService.updateEntry(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-backlog'] });
      queryClient.invalidateQueries({ queryKey: ['backlog-stats'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => Alert.alert('Erro', 'Não foi possível atualizar.'),
  });

  const updateStatus = (entryId: string, status: string) => {
    const data: any = { status };
    if (status === 'finished') data.finished_at = new Date().toISOString().split('T')[0];
    updateMutation.mutate({ id: entryId, data });
  };

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetch(), queryClient.invalidateQueries({ queryKey: ['backlog-stats'] })]);
  }, [refetch, queryClient]);

  // ─── FILTER COUNTS from stats ──────────────────────────────────────────────
  const getFilterCount = (key: string) => {
    if (key === 'all') return totalCount;
    return stats?.[key] ?? 0;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>BACKLOG</Text>
          <Text style={styles.headerSub}>{totalCount} jogos</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.viewToggle, viewMode === 'list' && styles.viewToggleActive]}
            onPress={() => { Haptics.selectionAsync(); setViewMode('list'); }}
          >
            <Text style={{ color: viewMode === 'list' ? Colors.accent : Colors.muted }}>≡</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewToggle, viewMode === 'grid' && styles.viewToggleActive]}
            onPress={() => { Haptics.selectionAsync(); setViewMode('grid'); }}
          >
            <Text style={{ color: viewMode === 'grid' ? Colors.accent : Colors.muted }}>⊞</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('Search')}>
            <LinearGradient colors={[Colors.accent, Colors.accentDark]} style={styles.addBtnGradient}>
              <Text style={styles.addBtnText}>+ Add</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      <StatsRow stats={stats} />

      {/* Filters */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={STATUS_FILTERS}
        keyExtractor={item => item.key}
        contentContainerStyle={styles.filtersContainer}
        renderItem={({ item }) => {
          const isActive = activeFilter === item.key;
          return (
            <TouchableOpacity
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => { Haptics.selectionAsync(); setActiveFilter(item.key); }}
            >
              <Text style={styles.filterEmoji}>{item.emoji}</Text>
              <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>{item.label}</Text>
              {isActive && (
                <View style={styles.filterCount}>
                  <Text style={styles.filterCountText}>{getFilterCount(item.key)}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      {/* List */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          numColumns={viewMode === 'grid' ? 2 : 1}
          key={viewMode}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor={Colors.accent} colors={[Colors.accent]} />
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={() => (
            <EmptyState
              emoji="🎮"
              title="Nada aqui ainda"
              subtitle="Explore jogos e adicione ao seu backlog"
              action="Explorar jogos"
              onAction={() => navigation.navigate('Search')}
            />
          )}
          renderItem={({ item }) => (
            viewMode === 'list'
              ? <BacklogCard entry={item} onPress={() => navigation.navigate('GameDetail', { gameId: item.game.id, game: item.game })} onLongPress={() => handleLongPress(item)} />
              : <GridCard entry={item} onPress={() => navigation.navigate('GameDetail', { gameId: item.game.id, game: item.game })} />
          )}
        />
      )}
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontFamily: Fonts.display, fontSize: 28, letterSpacing: 3, color: Colors.text },
  headerSub: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewToggle: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border },
  viewToggleActive: { borderColor: Colors.accent },
  addBtn: { borderRadius: Radius.md, overflow: 'hidden' },
  addBtnGradient: { paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { fontFamily: Fonts.monoBold, fontSize: 12, color: '#0a0a0f' },
  statsRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  statItem: { flex: 1, alignItems: 'center' },
  statNumber: { fontFamily: Fonts.display, fontSize: 26, lineHeight: 28 },
  statLabel: { fontFamily: Fonts.mono, fontSize: 9, color: Colors.muted, letterSpacing: 0.5, marginTop: 2 },
  filtersContainer: { paddingHorizontal: Spacing.lg, paddingVertical: 12, gap: 8, alignItems: 'center' },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, minHeight: 40, minWidth: 80 },
  filterChipActive: { borderColor: Colors.accent, backgroundColor: 'rgba(200,241,53,0.08)' },
  filterEmoji: { fontSize: 13 },
  filterLabel: { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.muted },
  filterLabelActive: { color: Colors.accent },
  filterCount: { backgroundColor: Colors.accent, borderRadius: 99, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  filterCountText: { fontFamily: Fonts.monoBold, fontSize: 9, color: '#0a0a0f' },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
  entryCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.xl, padding: Spacing.md, overflow: 'hidden', position: 'relative', ...Shadows.card },
  entryInfo: { flex: 1 },
  entryTitle: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text, lineHeight: 19 },
  entryDev: { fontFamily: Fonts.body, fontSize: 12, color: Colors.muted, marginTop: 2, marginBottom: 6 },
  entryMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryPlatform: { backgroundColor: Colors.surface2, borderRadius: Radius.xs, paddingHorizontal: 7, paddingVertical: 2 },
  entryPlatformText: { fontFamily: Fonts.monoBold, fontSize: 10, color: Colors.muted },
  entryHours: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  entryDate: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, marginTop: 6 },
  statusLine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  gridCard: { flex: 1, margin: 4, backgroundColor: Colors.card, borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  gridStatusDot: { position: 'absolute', top: 8, right: 8, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: Colors.bg },
  gridTitle: { fontFamily: Fonts.bodyBold, fontSize: 12, color: Colors.text, padding: 8, lineHeight: 16 },
});
