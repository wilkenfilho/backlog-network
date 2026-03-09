import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, RefreshControl, FlatList, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { WebView } from 'react-native-webview';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { Colors, Fonts, Spacing, Radius, Shadows } from '../../theme';
import { Avatar, EmptyState } from '../../components';
import { usersService, communitiesService, rawgService, steamService } from '../../services/api';

type Tab = 'games' | 'twitch' | 'steam' | 'communities' | 'users';

// Genre → RAWG slug mapping
const GENRES: { label: string; slug: string }[] = [
  { label: 'Todos',         slug: '' },
  { label: 'RPG',           slug: 'role-playing-games-rpg' },
  { label: 'Action',        slug: 'action' },
  { label: 'Indie',         slug: 'indie' },
  { label: 'Adventure',     slug: 'adventure' },
  { label: 'Strategy',      slug: 'strategy' },
  { label: 'Shooter',       slug: 'shooter' },
  { label: 'Puzzle',        slug: 'puzzle' },
  { label: 'Racing',        slug: 'racing' },
  { label: 'Sports',        slug: 'sports' },
  { label: 'Horror',        slug: 'action' },
  { label: 'Platformer',    slug: 'platformer' },
  { label: 'Fighting',      slug: 'fighting' },
  { label: 'Simulation',    slug: 'simulation' },
  { label: 'Arcade',        slug: 'arcade' },
  { label: 'Card',          slug: 'card' },
  { label: 'Family',        slug: 'family' },
  { label: 'Board Games',   slug: 'board-games' },
  { label: 'Educational',   slug: 'educational' },
  { label: 'Casual',        slug: 'casual' },
];

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ─── GAME CARD ────────────────────────────────────────────────────────────────
function GameCard({ game, onPress }: { game: any; onPress: () => void }) {
  const cover = game.cover_url ?? game.coverUrl;
  return (
    <TouchableOpacity style={styles.gameCard} onPress={onPress} activeOpacity={0.85}>
      {cover
        ? <Image source={{ uri: cover }} style={styles.gameCover} contentFit="cover" transition={300} />
        : <LinearGradient colors={['#1a1628', '#0d0d14']} style={[styles.gameCover, { alignItems: 'center', justifyContent: 'center' }]}><Text style={{ fontSize: 28 }}>🎮</Text></LinearGradient>
      }
      <View style={styles.gameCardInfo}>
        <Text style={styles.gameCardTitle} numberOfLines={2}>{game.title ?? game.name}</Text>
        {Number(game.rawg_rating ?? game.rating ?? 0) > 0 && (
          <Text style={styles.gameRating}>⭐ {Number(game.rawg_rating ?? game.rating ?? 0).toFixed(1)}</Text>
        )}
        {game.genres && game.genres.length > 0 && (
          <View style={styles.genreTagsRow}>
            {game.genres.slice(0, 2).map((g: any, i: number) => (
              <View key={i} style={styles.genreTag}>
                <Text style={styles.genreTagText}>{typeof g === 'string' ? g : g.name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── STEAM GAME CARD ──────────────────────────────────────────────────────────
function SteamGameCard({ game, onPress }: { game: any; onPress?: () => void }) {
  const cover = game.cover_url ?? `https://cdn.akamai.steamstatic.com/steam/apps/${game.steam_id}/header.jpg`;
  return (
    <TouchableOpacity style={styles.steamCard} onPress={onPress} activeOpacity={0.9}>
      <Image source={{ uri: cover }} style={styles.steamCover} contentFit="cover" transition={300} />
      <LinearGradient colors={['transparent', 'rgba(10,10,15,0.97)']} style={styles.steamGradient} />
      <View style={styles.steamInfo}>
        <Text style={styles.steamTitle} numberOfLines={2}>{game.title ?? game.name}</Text>
        {game.price ? <Text style={styles.steamPrice}>{game.price}</Text> : null}
        {game.description ? <Text style={styles.steamDesc} numberOfLines={2}>{game.description}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── EXPLORE SCREEN ───────────────────────────────────────────────────────────
export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<Tab>('games');
  const [search, setSearch] = useState('');
  const [activeGenreSlug, setActiveGenreSlug] = useState('');
  const [gamesPage, setGamesPage] = useState(1);
  const [allGames, setAllGames] = useState<any[]>([]);
  const debouncedSearch = useDebounce(search, 400);

  const isSearching = debouncedSearch.length >= 2;

  // ─── GAMES queries ────────────────────────────────────────────────────────
  const { data: trendingGames, isLoading: trendingLoading, refetch: refetchTrending } = useQuery({
    queryKey: ['games-trending', gamesPage],
    queryFn: () => rawgService.getTrending(gamesPage),
    select: (raw: any) => Array.isArray(raw) ? raw : [],
    enabled: activeTab === 'games' && !isSearching && !activeGenreSlug,
    onSuccess: (data: any[]) => {
      setAllGames(prev => gamesPage === 1 ? data : [...prev, ...data]);
    },
  } as any);

  const { data: genreGames, isLoading: genreLoading } = useQuery({
    queryKey: ['games-genre', activeGenreSlug],
    queryFn: () => rawgService.getByGenre(activeGenreSlug),
    select: (raw: any) => Array.isArray(raw) ? raw : [],
    enabled: activeTab === 'games' && !!activeGenreSlug && !isSearching,
  });

  const { data: searchResults, isLoading: searchLoading, isFetching: searchFetching } = useQuery({
    queryKey: ['games-search', debouncedSearch],
    queryFn: () => rawgService.search(debouncedSearch),
    select: (raw: any) => Array.isArray(raw) ? raw : [],
    enabled: isSearching && activeTab === 'games',
  });

  const games = isSearching
    ? (searchResults ?? [])
    : activeGenreSlug
      ? (genreGames ?? [])
      : allGames.length > 0 ? allGames : (trendingGames ?? []);
  const gamesLoading = isSearching ? searchLoading : activeGenreSlug ? genreLoading : trendingLoading;

  // ─── STEAM query ──────────────────────────────────────────────────────────
  const { data: steamData, isLoading: steamLoading, refetch: refetchSteam } = useQuery({
    queryKey: ['steam-top'],
    queryFn: () => steamService.getTopGames(),
    select: (raw: any) => Array.isArray(raw) ? raw.filter(Boolean) : [],
    enabled: activeTab === 'steam',
  });

  // ─── COMMUNITIES query ────────────────────────────────────────────────────
  const { data: communitiesData, refetch: refetchCommunities } = useQuery({
    queryKey: ['communities'],
    queryFn: () => communitiesService.getAll(),
    select: (res: any) => {
      const raw = res.data?.data ?? res.data ?? res ?? [];
      return Array.isArray(raw) ? raw : [];
    },
    enabled: activeTab === 'communities',
  });

  // ─── USERS queries ────────────────────────────────────────────────────────
  const { data: suggestedUsers, isLoading: suggestedLoading } = useQuery({
    queryKey: ['users-all'],
    queryFn: async () => {
      // Try suggested first, fall back to a general users search
      try {
        const res = await usersService.getSuggested();
        const raw = res?.data?.data ?? res?.data ?? res ?? [];
        if (Array.isArray(raw) && raw.length > 0) return raw;
      } catch {}
      // Fallback: search with empty string to get all users
      try {
        const res = await usersService.search('');
        const raw = res?.data?.data ?? res?.data ?? res ?? [];
        return Array.isArray(raw) ? raw : [];
      } catch { return []; }
    },
    select: (raw: any) => Array.isArray(raw) ? raw : [],
    enabled: activeTab === 'users' && !isSearching,
  });

  const { data: userSearchResults, isLoading: userSearchLoading } = useQuery({
    queryKey: ['users-search', debouncedSearch],
    queryFn: () => usersService.search(debouncedSearch),
    select: (res: any) => {
      const raw = res.data?.data ?? res.data ?? res ?? [];
      return Array.isArray(raw) ? raw : [];
    },
    enabled: activeTab === 'users' && isSearching,
  });

  const usersToShow = isSearching ? (userSearchResults ?? []) : (suggestedUsers ?? []);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'games',       label: 'Jogos' },
    { key: 'twitch',      label: 'Twitch' },
    { key: 'steam',       label: 'Steam' },
    { key: 'communities', label: 'Comunidades' },
    { key: 'users',       label: 'Usuários' },
  ];

  const handleRefresh = async () => {
    if (activeTab === 'games') await refetchTrending();
    if (activeTab === 'steam') await refetchSteam();
    if (activeTab === 'communities') await refetchCommunities();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>EXPLORAR</Text>
      </View>

      {/* Search — hidden on Twitch tab */}
      {activeTab !== 'twitch' && (
        <View style={styles.searchRow}>
          <Text style={{ color: Colors.muted, fontSize: 16 }}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={
              activeTab === 'games' ? 'Buscar jogo...' :
              activeTab === 'steam' ? 'Buscar na Steam...' :
              activeTab === 'communities' ? 'Buscar comunidade...' :
              'Buscar usuário...'
            }
            placeholderTextColor={Colors.muted}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ color: Colors.muted }}>✕</Text>
            </TouchableOpacity>
          )}
          {(searchFetching && isSearching) && (
            <ActivityIndicator color={Colors.accent} size="small" />
          )}
        </View>
      )}

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsRow}
        contentContainerStyle={styles.tabsContent}
      >
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab(t.key);
              setSearch('');
              setActiveGenreSlug('');
              setGamesPage(1);
              setAllGames([]);
            }}
          >
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* GAMES TAB */}
      {activeTab === 'games' && (
        <View style={{ flex: 1 }}>
          {/* Genre filters */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.genreRow}
          >
            {GENRES.map(g => (
              <TouchableOpacity
                key={g.slug}
                style={[styles.genreBtn, activeGenreSlug === g.slug && styles.genreBtnActive]}
                onPress={() => { Haptics.selectionAsync(); setActiveGenreSlug(g.slug); setSearch(''); setGamesPage(1); setAllGames([]); }}
              >
                <Text style={[styles.genreBtnText, activeGenreSlug === g.slug && styles.genreBtnTextActive]}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {gamesLoading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator color={Colors.accent} size="large" />
              <Text style={[styles.loadingText, { marginTop: 12 }]}>Carregando jogos...</Text>
            </View>
          ) : games.length > 0 ? (
            <FlatList
              data={games}
              keyExtractor={(game: any, i: number) => String(game.id ?? i)}
              numColumns={2}
              renderItem={({ item: game }) => (
                <GameCard
                  game={game}
                  onPress={() => navigation.navigate('GameDetail', {
                    gameId: game.id,
                    game: { ...game, title: game.title ?? game.name, coverUrl: game.cover_url ?? game.coverUrl },
                  })}
                />
              )}
              contentContainerStyle={styles.gamesGrid}
              showsVerticalScrollIndicator={false}
              initialNumToRender={6}
              maxToRenderPerBatch={6}
              windowSize={5}
              removeClippedSubviews={true}
              refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={Colors.accent} />}
              ListFooterComponent={
                !isSearching && games.length > 0 ? (
                  <TouchableOpacity
                    style={styles.loadMoreBtn}
                    onPress={() => setGamesPage(p => p + 1)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.loadMoreText}>Carregar mais jogos</Text>
                  </TouchableOpacity>
                ) : null
              }
            />
          ) : (
            <EmptyState emoji="🎮" title="Nenhum jogo encontrado"
              subtitle={isSearching ? `Sem resultados para "${debouncedSearch}"` : 'Tente outra categoria.'} />
          )}
        </View>
      )}

      {/* TWITCH TAB — fullscreen webview, no search */}
      {activeTab === 'twitch' && (
        <View style={{ flex: 1 }}>
          <WebView
            source={{ uri: 'https://wilkenperez.com/twitch' }}
            style={{ flex: 1, backgroundColor: Colors.bg }}
            startInLoadingState
            renderLoading={() => (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg }}>
                <ActivityIndicator color={Colors.accent} size="large" />
                <Text style={[styles.loadingText, { marginTop: 12 }]}>Carregando Twitch...</Text>
              </View>
            )}
          />
        </View>
      )}

      {/* STEAM TAB */}
      {activeTab === 'steam' && (
        steamLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={Colors.accent} size="large" />
            <Text style={[styles.loadingText, { marginTop: 12 }]}>Carregando Steam...</Text>
          </View>
        ) : (
          <FlatList
            data={
              isSearching && steamData
                ? (steamData as any[]).filter((g: any) =>
                    (g.title ?? g.name ?? '').toLowerCase().includes(debouncedSearch.toLowerCase()))
                : (steamData ?? [])
            }
            keyExtractor={(item: any, i) => String(item?.steam_id ?? i)}
            renderItem={({ item }) => <SteamGameCard game={item} />}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={Colors.accent} />}
            ListEmptyComponent={() => (
              <EmptyState
                emoji="🎮"
                title={isSearching ? `Sem resultados para "${debouncedSearch}"` : 'Dados Steam indisponíveis'}
                subtitle={isSearching ? 'Tente outro termo.' : 'Tente novamente em instantes.'}
              />
            )}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          />
        )
      )}

      {/* COMMUNITIES TAB */}
      {activeTab === 'communities' && (
        <FlatList
          data={communitiesData ?? []}
          keyExtractor={(item: any) => String(item.id)}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.communityCard} onPress={() => navigation.navigate('Community', { communityId: item.id })} activeOpacity={0.85}>
              <View style={styles.communityIcon}>
                <LinearGradient colors={[Colors.purple + '40', Colors.bg]} style={StyleSheet.absoluteFill} />
                <Text style={{ fontSize: 26 }}>{item.icon_url ?? item.icon ?? '🎮'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.communityName}>{item.name}</Text>
                <Text style={styles.communityDesc} numberOfLines={1}>{item.description}</Text>
                <Text style={styles.communityMeta}>👥 {item.members_count ?? 0} membros</Text>
              </View>
              <View style={styles.joinBtn}><Text style={styles.joinText}>Ver →</Text></View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={() => (
            <TouchableOpacity style={styles.createCommunityBtn} onPress={() => navigation.navigate('CreateCommunity')}>
              <LinearGradient colors={[Colors.purple + '20', Colors.bg]} style={styles.createCommunityGradient}>
                <Text style={{ fontSize: 20 }}>🏘️</Text>
                <Text style={styles.createCommunityText}>Criar nova comunidade</Text>
                <Text style={{ color: Colors.accent }}>+</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          ListEmptyComponent={() => <EmptyState emoji="🏘️" title="Sem comunidades" subtitle="Seja o primeiro a criar uma!" />}
        />
      )}

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <FlatList
          data={usersToShow}
          keyExtractor={(item: any) => String(item.id ?? item.user_id)}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.userCard} onPress={() => navigation.navigate('UserProfile', { userId: item.id })} activeOpacity={0.85}>
              <Avatar
                user={{ id: String(item.id), username: item.username, displayName: item.display_name, avatar: item.avatar_url } as any}
                size={48}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{item.display_name ?? item.username}</Text>
                <Text style={styles.userHandle}>@{item.username} · Nível {item.level ?? 1}</Text>
              </View>
              <View style={styles.followBtn}><Text style={styles.followBtnText}>+ Seguir</Text></View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            (suggestedLoading || userSearchLoading)
              ? <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={Colors.accent} size="large" /></View>
              : <EmptyState
                  emoji="👥"
                  title={isSearching ? `Sem resultados para "${debouncedSearch}"` : 'Busque por usuários'}
                  subtitle={isSearching ? 'Tente buscar com outro nome.' : 'Digite um nome acima para buscar!'}
                />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: 14 },
  headerTitle: { fontFamily: Fonts.display, fontSize: 28, letterSpacing: 3, color: Colors.text },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontFamily: Fonts.body, fontSize: 14, color: Colors.text },
  tabsRow: { flexGrow: 0, marginBottom: Spacing.md },
  tabsContent: { paddingHorizontal: Spacing.lg, gap: 8, alignItems: 'center', paddingVertical: 4 },
  tab: {
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    minHeight: 38, justifyContent: 'center', alignItems: 'center',
  },
  tabActive: { backgroundColor: Colors.accent + '15', borderColor: Colors.accent },
  tabText: { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.muted },
  tabTextActive: { color: Colors.accent },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100, paddingTop: 4 },
  loadingText: { fontFamily: Fonts.mono, fontSize: 13, color: Colors.muted, textAlign: 'center' },
  genreRow: { paddingHorizontal: Spacing.lg, gap: 8, marginBottom: Spacing.md, paddingVertical: 2 },
  genreBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  genreBtnActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '15' },
  genreBtnText: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted },
  genreBtnTextActive: { color: Colors.accent },
  gamesGrid: { paddingHorizontal: 4, paddingBottom: 20 },
  loadMoreBtn: { marginTop: 16, marginBottom: 8, alignSelf: 'center', paddingHorizontal: 28, paddingVertical: 12, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.accent, backgroundColor: Colors.accent + '12' },
  loadMoreText: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.accent },
  gameCard: { flex: 1, margin: 6, backgroundColor: Colors.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', ...Shadows.card },
  gameCover: { width: '100%' as any, aspectRatio: 3 / 4 },
  gameCardInfo: { padding: Spacing.sm },
  gameCardTitle: { fontFamily: Fonts.bodyBold, fontSize: 13, color: Colors.text, lineHeight: 18, marginBottom: 2 },
  gameRating: { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.amber, marginTop: 4 },
  genreTagsRow: { flexDirection: 'row', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  genreTag: { backgroundColor: Colors.surface2, borderRadius: Radius.xs, paddingHorizontal: 6, paddingVertical: 1 },
  genreTagText: { fontFamily: Fonts.mono, fontSize: 9, color: Colors.muted },
  steamCard: { borderRadius: Radius.xl, overflow: 'hidden', height: 200, position: 'relative', ...Shadows.card },
  steamCover: { width: '100%' as any, height: '100%' as any },
  steamGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '70%' as any },
  steamInfo: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.md },
  steamTitle: { fontFamily: Fonts.bodyBold, fontSize: 15, color: Colors.text, marginBottom: 4 },
  steamPrice: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.accent, marginBottom: 2 },
  steamDesc: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  steamPlayers: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted, marginTop: 2 },
  communityCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, marginBottom: 10, ...Shadows.card },
  communityIcon: { width: 52, height: 52, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  communityName: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text, marginBottom: 2 },
  communityDesc: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted, marginBottom: 4 },
  communityMeta: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  joinBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.accent },
  joinText: { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.accent },
  createCommunityBtn: { borderRadius: Radius.xl, overflow: 'hidden', marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.purple + '40' },
  createCommunityGradient: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: Spacing.md },
  createCommunityText: { flex: 1, fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, marginBottom: 10 },
  userName: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text },
  userHandle: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted, marginTop: 2 },
  followBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.accent },
  followBtnText: { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.accent },
});
