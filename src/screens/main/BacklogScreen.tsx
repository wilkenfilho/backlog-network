import React, { useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  SectionList, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { Colors, Fonts, Spacing, Radius, Shadows } from '../../theme';
import { Avatar, StatusBadge, GameCover, ProgressBar, EmptyState, Button } from '../../components';
import type { BacklogEntry, GameStatus } from '../../types';

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
const MOCK_BACKLOG: BacklogEntry[] = [
  { id: 'b1', userId: 'me', status: 'playing', progress: 34, hoursPlayed: 22, platform: 'PS5', updatedAt: '', game: { id: 'g1', title: 'Elden Ring: Nightreign', developer: 'FromSoftware', genres: ['Action', 'RPG'], platforms: ['PS5'] } },
  { id: 'b2', userId: 'me', status: 'playing', progress: 22, hoursPlayed: 34, platform: 'PC', updatedAt: '', game: { id: 'g3', title: "Baldur's Gate 3", developer: 'Larian Studios', genres: ['RPG'], platforms: ['PC'] } },
  { id: 'b3', userId: 'me', status: 'playing', progress: 58, hoursPlayed: 12, platform: 'PC', updatedAt: '', game: { id: 'g6', title: 'Hades II', developer: 'Supergiant Games', genres: ['Action', 'Roguelike'], platforms: ['PC'] } },
  { id: 'b4', userId: 'me', status: 'finished', progress: 100, hoursPlayed: 96, platform: 'PS5', finishedAt: '2025-01-15', updatedAt: '', game: { id: 'g7', title: 'Elden Ring', developer: 'FromSoftware', genres: ['RPG', 'Action'], platforms: ['PS5', 'PC'] } },
  { id: 'b5', userId: 'me', status: 'finished', progress: 100, hoursPlayed: 48, platform: 'PC', finishedAt: '2024-12-28', updatedAt: '', game: { id: 'g8', title: 'Disco Elysium', developer: 'ZA/UM', genres: ['RPG'], platforms: ['PC'] } },
  { id: 'b6', userId: 'me', status: 'finished', progress: 100, hoursPlayed: 30, platform: 'PS5', finishedAt: '2024-11-10', updatedAt: '', game: { id: 'g9', title: 'God of War Ragnarök', developer: 'Santa Monica Studio', genres: ['Action', 'Adventure'], platforms: ['PS5'] } },
  { id: 'b7', userId: 'me', status: 'backlog', updatedAt: '', game: { id: 'g10', title: 'Cyberpunk 2077: Phantom Liberty', developer: 'CD Projekt Red', genres: ['RPG', 'Action'], platforms: ['PS5', 'PC'] } },
  { id: 'b8', userId: 'me', status: 'backlog', updatedAt: '', game: { id: 'g11', title: 'Final Fantasy VII Rebirth', developer: 'Square Enix', genres: ['RPG'], platforms: ['PS5'] } },
  { id: 'b9', userId: 'me', status: 'backlog', updatedAt: '', game: { id: 'g12', title: 'Monster Hunter Wilds', developer: 'Capcom', genres: ['Action', 'RPG'], platforms: ['PS5', 'PC'] } },
  { id: 'b10', userId: 'me', status: 'backlog', updatedAt: '', game: { id: 'g13', title: 'Hollow Knight: Silksong', developer: 'Team Cherry', genres: ['Platformer'], platforms: ['PC', 'Nintendo Switch'] } },
  { id: 'b11', userId: 'me', status: 'dropped', updatedAt: '', hoursPlayed: 4, game: { id: 'g14', title: 'Forspoken', developer: 'Square Enix', genres: ['Action', 'RPG'], platforms: ['PS5'] } },
];

const STATUS_FILTERS: { key: GameStatus | 'all'; label: string; emoji: string }[] = [
  { key: 'all',      label: 'Todos',    emoji: '⊞' },
  { key: 'playing',  label: 'Jogando',  emoji: '▶' },
  { key: 'finished', label: 'Zerados',  emoji: '✓' },
  { key: 'backlog',  label: 'Backlog',  emoji: '⊟' },
  { key: 'dropped',  label: 'Largados', emoji: '✕' },
];

const STATUS_COLORS: Record<GameStatus, string> = {
  playing: Colors.purple,
  finished: Colors.accent,
  backlog: Colors.red,
  dropped: Colors.muted,
  wishlist: Colors.amber,
};

// ─── BACKLOG ENTRY CARD ───────────────────────────────────────────────────────
function BacklogCard({ entry, onPress }: { entry: BacklogEntry; onPress: () => void }) {
  const color = STATUS_COLORS[entry.status];
  return (
    <TouchableOpacity style={styles.entryCard} onPress={onPress} activeOpacity={0.85}>
      <GameCover game={entry.game} width={64} height={84} borderRadius={Radius.md} />

      <View style={styles.entryInfo}>
        <Text style={styles.entryTitle} numberOfLines={2}>{entry.game.title}</Text>
        <Text style={styles.entryDev}>{entry.game.developer}</Text>

        <View style={styles.entryMeta}>
          {entry.platform && (
            <View style={styles.entryPlatform}>
              <Text style={styles.entryPlatformText}>{entry.platform}</Text>
            </View>
          )}
          {entry.hoursPlayed != null && entry.hoursPlayed > 0 && (
            <Text style={styles.entryHours}>⏱ {entry.hoursPlayed}h</Text>
          )}
        </View>

        {entry.progress != null && entry.status === 'playing' && (
          <View style={{ marginTop: 6 }}>
            <ProgressBar progress={entry.progress} color={color} height={4} />
          </View>
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

// ─── STATS ROW ───────────────────────────────────────────────────────────────
function StatsRow({ entries }: { entries: BacklogEntry[] }) {
  const playing  = entries.filter(e => e.status === 'playing').length;
  const finished = entries.filter(e => e.status === 'finished').length;
  const backlog  = entries.filter(e => e.status === 'backlog').length;
  const hours    = entries.reduce((a, e) => a + (e.hoursPlayed ?? 0), 0);

  return (
    <View style={styles.statsRow}>
      {[
        { n: playing,  label: 'jogando',   color: Colors.purple },
        { n: finished, label: 'zerados',   color: Colors.accent },
        { n: backlog,  label: 'backlog',   color: Colors.red },
        { n: hours,    label: 'horas',     color: Colors.amber },
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
  const [activeFilter, setActiveFilter] = useState<GameStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const filtered = activeFilter === 'all'
    ? MOCK_BACKLOG
    : MOCK_BACKLOG.filter(e => e.status === activeFilter);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>BACKLOG</Text>
          <Text style={styles.headerSub}>{MOCK_BACKLOG.length} jogos</Text>
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
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('Search')}
          >
            <LinearGradient colors={[Colors.accent, Colors.accentDark]} style={styles.addBtnGradient}>
              <Text style={styles.addBtnText}>+ Add</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      <StatsRow entries={MOCK_BACKLOG} />

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
              onPress={() => {
                Haptics.selectionAsync();
                setActiveFilter(item.key);
              }}
            >
              <Text style={styles.filterEmoji}>{item.emoji}</Text>
              <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>
                {item.label}
              </Text>
              {isActive && (
                <View style={styles.filterCount}>
                  <Text style={styles.filterCountText}>
                    {item.key === 'all' ? MOCK_BACKLOG.length : MOCK_BACKLOG.filter(e => e.status === item.key).length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        numColumns={viewMode === 'grid' ? 2 : 1}
        key={viewMode} // force re-render on mode change
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={() => (
          <EmptyState
            emoji="🎮"
            title="Nada aqui ainda"
            subtitle="Explore jogos e adicione ao seu backlog"
            action="Explorar jogos"
            onAction={() => navigation.navigate('Explore')}
          />
        )}
        renderItem={({ item }) => (
          viewMode === 'list'
            ? <BacklogCard entry={item} onPress={() => navigation.navigate('GameDetail', { gameId: item.game.id, game: item.game })} />
            : <GridCard entry={item} onPress={() => navigation.navigate('GameDetail', { gameId: item.game.id, game: item.game })} />
        )}
      />
    </View>
  );
}

// ─── GRID CARD ────────────────────────────────────────────────────────────────
function GridCard({ entry, onPress }: { entry: BacklogEntry; onPress: () => void }) {
  const color = STATUS_COLORS[entry.status];
  return (
    <TouchableOpacity style={styles.gridCard} onPress={onPress} activeOpacity={0.85}>
      <GameCover game={entry.game} width="100%" as any height={130} borderRadius={Radius.md} />
      <View style={[styles.gridStatusDot, { backgroundColor: color }]} />
      <Text style={styles.gridTitle} numberOfLines={2}>{entry.game.title}</Text>
    </TouchableOpacity>
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

  statsRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 0 },
  statItem: { flex: 1, alignItems: 'center' },
  statNumber: { fontFamily: Fonts.display, fontSize: 26, lineHeight: 28 },
  statLabel: { fontFamily: Fonts.mono, fontSize: 9, color: Colors.muted, letterSpacing: 0.5, marginTop: 2 },

  filtersContainer: { paddingHorizontal: Spacing.lg, paddingVertical: 12, gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { borderColor: Colors.accent, backgroundColor: 'rgba(200,241,53,0.08)' },
  filterEmoji: { fontSize: 12 },
  filterLabel: { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.muted },
  filterLabelActive: { color: Colors.accent },
  filterCount: { backgroundColor: Colors.accent, borderRadius: 99, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  filterCountText: { fontFamily: Fonts.monoBold, fontSize: 9, color: '#0a0a0f' },

  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },

  entryCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.xl, padding: Spacing.md,
    overflow: 'hidden', position: 'relative',
    ...Shadows.card,
  },
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
