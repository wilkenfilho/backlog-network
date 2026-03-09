import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, TextInput, Modal, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Colors, Fonts, Spacing, Radius } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { listsService, rawgService } from '../../services/api';

function timeAgo(d: string) {
  if (!d) return '';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

// ─── ADD GAME MODAL ──────────────────────────────────────────────────────────
function AddGameModal({ visible, onClose, onAdd }: {
  visible: boolean;
  onClose: () => void;
  onAdd: (game: any) => void;
}) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  React.useEffect(() => {
    const t = setTimeout(() => setQuery(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data: results, isFetching } = useQuery({
    queryKey: ['game-search-list', query],
    queryFn: () => rawgService.search(query),
    select: (raw: any) => Array.isArray(raw) ? raw.slice(0, 8) : [],
    enabled: query.length >= 2,
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Adicionar Jogo</Text>

          <View style={styles.searchRow}>
            <Text style={{ color: Colors.muted }}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar jogo..."
              placeholderTextColor={Colors.muted}
              autoFocus
            />
            {isFetching && <ActivityIndicator color={Colors.accent} size="small" />}
          </View>

          {query.length >= 2 && !isFetching && (results ?? []).length === 0 && (
            <Text style={styles.emptySearch}>Nenhum jogo encontrado</Text>
          )}

          <FlatList
            data={results ?? []}
            keyExtractor={(item: any) => String(item.id)}
            renderItem={({ item }: any) => (
              <TouchableOpacity
                style={styles.gameResultItem}
                onPress={() => {
                  Haptics.selectionAsync();
                  onAdd(item);
                  onClose();
                  setSearch('');
                }}
                activeOpacity={0.8}
              >
                {item.cover_url ? (
                  <Image source={{ uri: item.cover_url }} style={styles.gameResultCover} contentFit="cover" />
                ) : (
                  <View style={[styles.gameResultCover, { backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ fontSize: 18 }}>🎮</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.gameResultTitle} numberOfLines={1}>{item.title ?? item.name}</Text>
                  <Text style={styles.gameResultDev} numberOfLines={1}>{item.developer ?? ''}</Text>
                  {item.released && (
                    <Text style={styles.gameResultYear}>{item.released.slice(0, 4)}</Text>
                  )}
                </View>
                {item.rawg_rating > 0 && (
                  <Text style={styles.gameResultRating}>⭐ {Number(item.rawg_rating).toFixed(1)}</Text>
                )}
              </TouchableOpacity>
            )}
            style={{ maxHeight: 380 }}
          />

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── LIST DETAIL SCREEN ──────────────────────────────────────────────────────
export default function ListDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const listId = route.params?.listId;
  const initialList = route.params?.list;

  const [addGameVisible, setAddGameVisible] = useState(false);

  // Fetch list details including items
  const { data: listData, isLoading, refetch } = useQuery({
    queryKey: ['list-detail', listId],
    queryFn: async () => {
      // Try to get list with items from the API
      try {
        const res = await listsService.getUserLists(String(user?.id));
        const all = res.data?.data ?? res.data ?? [];
        const found = all.find((l: any) => String(l.id) === String(listId));
        if (found) return found;
      } catch {}
      return initialList ?? null;
    },
    enabled: !!listId,
    initialData: initialList ?? undefined,
  });

  // Fetch list items separately if not included
  const { data: itemsData, isLoading: itemsLoading, refetch: refetchItems } = useQuery({
    queryKey: ['list-items', listId],
    queryFn: async () => {
      try {
        const res = await listsService.getItems(listId);
        const raw = res?.data ?? res;
        return Array.isArray(raw) ? raw : [];
      } catch {
        return listData?.items ?? [];
      }
    },
    enabled: !!listId,
  });

  const addGameMutation = useMutation({
    mutationFn: ({ gameId, notes }: { gameId: string; notes?: string }) =>
      listsService.addGame(listId, gameId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list-items', listId] });
      queryClient.invalidateQueries({ queryKey: ['list-detail', listId] });
      queryClient.invalidateQueries({ queryKey: ['user-lists'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e: any) => {
      Alert.alert('Erro', e?.message ?? 'Não foi possível adicionar o jogo.');
    },
  });

  const removeGameMutation = useMutation({
    mutationFn: (itemId: string) => listsService.removeGame(listId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list-items', listId] });
      queryClient.invalidateQueries({ queryKey: ['list-detail', listId] });
      queryClient.invalidateQueries({ queryKey: ['user-lists'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    },
    onError: (e: any) => {
      Alert.alert('Erro', e?.message ?? 'Não foi possível remover o jogo.');
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: () => listsService.delete(listId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-lists'] });
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    },
    onError: (e: any) => Alert.alert('Erro', e?.message ?? 'Não foi possível excluir a lista.'),
  });

  const isOwner = String(listData?.user_id ?? user?.id) === String(user?.id);
  const items: any[] = itemsData ?? listData?.items ?? [];
  const list = listData ?? initialList;

  const handleAddGame = (game: any) => {
    addGameMutation.mutate({
      gameId: String(game.rawg_id ?? game.id),
      notes: '',
    });
  };

  const handleRemoveGame = (item: any) => {
    Alert.alert(
      'Remover jogo',
      `Remover "${item.game_title ?? item.title}" da lista?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: () => removeGameMutation.mutate(String(item.id)) },
      ]
    );
  };

  const handleDeleteList = () => {
    Alert.alert(
      'Excluir lista',
      'Tem certeza? Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => deleteListMutation.mutate() },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ color: Colors.text, fontSize: 20 }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{list?.title ?? 'Lista'}</Text>
          <Text style={styles.headerSub}>
            {items.length} jogo{items.length !== 1 ? 's' : ''} · {list?.is_public ? '🌍 Pública' : '🔒 Privada'}
          </Text>
        </View>
        {isOwner && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteList}>
            <Text style={{ fontSize: 16 }}>🗑️</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Description */}
      {list?.description ? (
        <View style={styles.descContainer}>
          <Text style={styles.descText}>{list.description}</Text>
        </View>
      ) : null}

      {/* Items list */}
      {itemsLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item: any, i) => String(item?.id ?? i)}
          renderItem={({ item, index }: { item: any; index: number }) => {
            const cover = item.game_cover ?? item.cover_url ?? item.game?.cover_url;
            return (
              <TouchableOpacity
                style={styles.gameItem}
                onPress={() => navigation.navigate('GameDetail', { gameId: item.game_id ?? item.game?.id })}
                activeOpacity={0.85}
              >
                <Text style={styles.rankNum}>#{index + 1}</Text>
                <View style={styles.gameCover}>
                  {cover ? (
                    <Image source={{ uri: cover }} style={StyleSheet.absoluteFill as any} contentFit="cover" />
                  ) : (
                    <LinearGradient colors={['#1a1628', '#0d0d14']} style={StyleSheet.absoluteFill}>
                      <Text style={styles.gameCoverEmoji}>🎮</Text>
                    </LinearGradient>
                  )}
                </View>
                <View style={styles.gameInfo}>
                  <Text style={styles.gameTitle} numberOfLines={1}>{item.game_title ?? item.title ?? item.game?.title}</Text>
                  <Text style={styles.gameDev} numberOfLines={1}>{item.developer ?? item.game?.developer ?? ''}</Text>
                  {item.notes ? (
                    <Text style={styles.itemNotes} numberOfLines={1}>💬 {item.notes}</Text>
                  ) : null}
                  <Text style={styles.itemDate}>{timeAgo(item.created_at)}</Text>
                </View>
                {isOwner && (
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => handleRemoveGame(item)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={{ color: Colors.red, fontSize: 14 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          onRefresh={refetchItems}
          refreshing={false}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>📋</Text>
              <Text style={styles.emptyTitle}>Lista vazia</Text>
              <Text style={styles.emptySub}>
                {isOwner ? 'Toque no botão + para adicionar jogos!' : 'Nenhum jogo adicionado ainda.'}
              </Text>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: Colors.border, marginLeft: 72 }} />}
        />
      )}

      {/* Add game FAB */}
      {isOwner && (
        <TouchableOpacity
          style={[styles.fab, addGameMutation.isPending && { opacity: 0.6 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setAddGameVisible(true);
          }}
          disabled={addGameMutation.isPending}
        >
          <LinearGradient colors={[Colors.accent, Colors.accentDark]} style={styles.fabGradient}>
            {addGameMutation.isPending
              ? <ActivityIndicator color="#0a0a0f" size="small" />
              : <Text style={styles.fabText}>＋ Adicionar jogo</Text>
            }
          </LinearGradient>
        </TouchableOpacity>
      )}

      <AddGameModal
        visible={addGameVisible}
        onClose={() => setAddGameVisible(false)}
        onAdd={handleAddGame}
      />
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.lg, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.display, fontSize: 20, letterSpacing: 1, color: Colors.text },
  headerSub: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted, marginTop: 2 },
  deleteBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  descContainer: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  descText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },

  gameItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Spacing.lg, paddingVertical: 12,
  },
  rankNum: { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.muted, width: 24, textAlign: 'center' },
  gameCover: {
    width: 44, height: 58, borderRadius: Radius.md, overflow: 'hidden',
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  gameCoverEmoji: { fontSize: 20, position: 'absolute' },
  gameInfo: { flex: 1 },
  gameTitle: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text, marginBottom: 2 },
  gameDev: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, marginBottom: 2 },
  itemNotes: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.accent, marginBottom: 2 },
  itemDate: { fontFamily: Fonts.mono, fontSize: 9, color: Colors.muted },
  removeBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

  emptyState: { alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { fontFamily: Fonts.bodyBold, fontSize: 16, color: Colors.text, marginBottom: 6 },
  emptySub: { fontFamily: Fonts.body, fontSize: 13, color: Colors.muted, textAlign: 'center', maxWidth: 240 },

  fab: {
    position: 'absolute', bottom: 28, left: Spacing.lg, right: Spacing.lg,
    borderRadius: Radius.xl, overflow: 'hidden', elevation: 5,
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8,
  },
  fabGradient: {
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
  },
  fabText: { fontFamily: Fonts.monoBold, fontSize: 15, color: '#0a0a0f' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.lg, paddingBottom: 40, paddingTop: Spacing.md,
    maxHeight: '85%',
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontFamily: Fonts.display, fontSize: 18, letterSpacing: 2, color: Colors.text, marginBottom: Spacing.md },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bg, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md,
  },
  searchInput: { flex: 1, fontFamily: Fonts.body, fontSize: 14, color: Colors.text },
  emptySearch: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted, textAlign: 'center', paddingVertical: Spacing.md },
  gameResultItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  gameResultCover: { width: 40, height: 52, borderRadius: Radius.sm },
  gameResultTitle: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text },
  gameResultDev: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, marginTop: 2 },
  gameResultYear: { fontFamily: Fonts.mono, fontSize: 9, color: Colors.muted, marginTop: 1 },
  gameResultRating: { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.amber },
  cancelBtn: {
    marginTop: Spacing.lg, paddingVertical: 14, alignItems: 'center',
    backgroundColor: Colors.bg, borderRadius: Radius.lg,
  },
  cancelText: { fontFamily: Fonts.bodyBold, fontSize: 15, color: Colors.muted },
});
