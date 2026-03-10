import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator, Modal, TextInput, Pressable, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Colors, Fonts, Spacing, Radius, Shadows } from '../../theme';
import { GameCover, ProgressBar, EmptyState } from '../../components';
import { backlogService, gamesService } from '../../services/api';
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

  // ─── Modal de adição rápida ────────────────────────────────────────────────
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [addStatus, setAddStatus] = useState<GameStatus>('backlog');
  const [addPlatform, setAddPlatform] = useState('');
  const [addHours, setAddHours] = useState('');

  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['game-search-backlog', searchText],
    queryFn: () => gamesService.search(searchText),
    select: (res: any) => {
      const raw = res?.data?.data ?? res?.data ?? res ?? [];
      return Array.isArray(raw) ? raw : [];
    },
    enabled: searchText.length >= 2,
  });

  const addMutation = useMutation({
    mutationFn: (data: any) => backlogService.addGame(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-backlog'] });
      queryClient.invalidateQueries({ queryKey: ['backlog-stats'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAddModalVisible(false);
      setSelectedGame(null);
      setSearchText('');
      setAddPlatform('');
      setAddHours('');
      setAddStatus('backlog');
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.error ?? e?.message ?? 'Não foi possível adicionar.';
      Alert.alert('Erro', msg);
    },
  });

  const handleConfirmAdd = () => {
    if (!selectedGame) return;
    addMutation.mutate({
      game_id: selectedGame.id,
      status: addStatus,
      platform: addPlatform.trim() || undefined,
      hours_played: addHours ? Number(addHours) : undefined,
    });
  };

  const ADD_STATUSES: { status: GameStatus; label: string; emoji: string }[] = [
    { status: 'playing',  label: 'Jogando',  emoji: '▶' },
    { status: 'backlog',  label: 'Backlog',  emoji: '⊟' },
    { status: 'finished', label: 'Zerado',   emoji: '✓' },
    { status: 'wishlist', label: 'Quero',    emoji: '♡' },
    { status: 'dropped',  label: 'Largado',  emoji: '✕' },
  ];

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
          <TouchableOpacity style={styles.addBtn} onPress={() => setAddModalVisible(true)}>
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

      {/* ─── Modal de adição rápida ─────────────────────────────────── */}
      <Modal visible={addModalVisible} transparent animationType="slide" onRequestClose={() => setAddModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => !addMutation.isPending && setAddModalVisible(false)}>
          <Pressable style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {selectedGame ? selectedGame.title : 'Adicionar ao Backlog'}
            </Text>

            {!selectedGame ? (
              <>
                {/* Busca de jogo */}
                <View style={styles.searchRow}>
                  <TextInput
                    style={styles.searchInput}
                    value={searchText}
                    onChangeText={setSearchText}
                    placeholder="Buscar jogo..."
                    placeholderTextColor={Colors.muted}
                    autoFocus
                  />
                  {searchLoading && <ActivityIndicator color={Colors.accent} size="small" />}
                </View>
                <ScrollView style={{ maxHeight: 280 }}>
                  {(searchResults ?? []).map((g: any) => (
                    <TouchableOpacity
                      key={g.id}
                      style={styles.gameRow}
                      onPress={() => { Haptics.selectionAsync(); setSelectedGame(g); }}
                    >
                      <Text style={styles.gameRowTitle} numberOfLines={1}>{g.title}</Text>
                      {g.rawg_rating && <Text style={styles.gameRowRating}>★ {Number(g.rawg_rating).toFixed(1)}</Text>}
                    </TouchableOpacity>
                  ))}
                  {searchText.length >= 2 && !searchLoading && (searchResults ?? []).length === 0 && (
                    <Text style={styles.emptySearch}>Nenhum jogo encontrado</Text>
                  )}
                </ScrollView>
              </>
            ) : (
              <>
                {/* Status */}
                <Text style={styles.fieldLabel}>STATUS</Text>
                <View style={styles.statusRow}>
                  {ADD_STATUSES.map(s => (
                    <TouchableOpacity
                      key={s.status}
                      style={[styles.statusChip, addStatus === s.status && styles.statusChipActive]}
                      onPress={() => setAddStatus(s.status)}
                    >
                      <Text style={styles.statusChipEmoji}>{s.emoji}</Text>
                      <Text style={[styles.statusChipLabel, addStatus === s.status && styles.statusChipLabelActive]}>
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Plataforma */}
                <Text style={styles.fieldLabel}>PLATAFORMA</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={addPlatform}
                  onChangeText={setAddPlatform}
                  placeholder="Ex: PS5, PC, Switch..."
                  placeholderTextColor={Colors.muted}
                />

                {/* Horas jogadas */}
                <Text style={styles.fieldLabel}>HORAS JOGADAS</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={addHours}
                  onChangeText={v => setAddHours(v.replace(/[^0-9]/g, ''))}
                  placeholder="0"
                  placeholderTextColor={Colors.muted}
                  keyboardType="numeric"
                />

                {/* Ações */}
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedGame(null)}>
                    <Text style={styles.backBtnText}>← Trocar jogo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmBtn, addMutation.isPending && { opacity: 0.5 }]}
                    onPress={handleConfirmAdd}
                    disabled={addMutation.isPending}
                  >
                    <LinearGradient colors={[Colors.accent, Colors.accentDark]} style={styles.confirmGradient}>
                      <Text style={styles.confirmText}>
                        {addMutation.isPending ? 'Salvando...' : '✓ Adicionar'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
  // Modal de adição rápida
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, paddingHorizontal: Spacing.lg, paddingBottom: 40, paddingTop: Spacing.md, maxHeight: '85%' },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: Fonts.display, fontSize: 18, letterSpacing: 2, color: Colors.text, marginBottom: Spacing.md },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.bg, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md },
  searchInput: { flex: 1, fontFamily: Fonts.body, fontSize: 14, color: Colors.text },
  gameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  gameRowTitle: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.text, flex: 1 },
  gameRowRating: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.amber },
  emptySearch: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted, textAlign: 'center', paddingVertical: Spacing.lg },
  fieldLabel: { fontFamily: Fonts.monoBold, fontSize: 10, letterSpacing: 2, color: Colors.muted, marginBottom: 6, marginTop: Spacing.md },
  fieldInput: { backgroundColor: Colors.bg, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 10, color: Colors.text, fontFamily: Fonts.body, fontSize: 14, borderWidth: 1, borderColor: Colors.border },
  statusRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg },
  statusChipActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '15' },
  statusChipEmoji: { fontSize: 12 },
  statusChipLabel: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  statusChipLabelActive: { color: Colors.accent },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: Spacing.xl },
  backBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: Colors.bg, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  backBtnText: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.muted },
  confirmBtn: { flex: 2, borderRadius: Radius.lg, overflow: 'hidden' },
  confirmGradient: { paddingVertical: 13, alignItems: 'center' },
  confirmText: { fontFamily: Fonts.monoBold, fontSize: 14, color: '#0a0a0f' },
});
