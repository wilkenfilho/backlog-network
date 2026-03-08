import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, RefreshControl, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { WebView } from 'react-native-webview';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { Colors, Fonts, Spacing, Radius, Shadows } from '../../theme';
import { EmptyState } from '../../components';
import { gamesService, usersService, communitiesService } from '../../services/api';

type Tab = 'games' | 'twitch' | 'steam' | 'communities' | 'users';

const GENRES = ['RPG', 'Action', 'Indie', 'Roguelike', 'Platformer', 'Soulsborne', 'Strategy', 'Horror', 'Metroidvania', 'Puzzle'];

function GameCard({ game, onPress }: { game: any; onPress: () => void }) {
  const cover = game.coverUrl ?? game.cover_url;
  return (
    <TouchableOpacity style={styles.gameCard} onPress={onPress} activeOpacity={0.85}>
      {cover
        ? <Image source={{ uri: cover }} style={styles.gameCover} contentFit="cover" transition={300} />
        : <LinearGradient colors={['#1a1628', '#0d0d14']} style={styles.gameCover}><Text style={{ fontSize: 28 }}>🎮</Text></LinearGradient>
      }
      <View style={styles.gameCardInfo}>
        <Text style={styles.gameCardTitle} numberOfLines={2}>{game.title ?? game.name}</Text>
        <Text style={styles.gameCardDev} numberOfLines={1}>{game.developer}</Text>
        {(game.rawg_rating || game.rating) > 0 && (
          <Text style={styles.gameRating}>⭐ {Number(game.rawg_rating ?? game.rating ?? 0).toFixed(1)}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function SteamGameCard({ game }: { game: any }) {
  const cover = game.cover_url ?? `https://cdn.akamai.steamstatic.com/steam/apps/${game.steam_appid}/header.jpg`;
  return (
    <View style={styles.steamCard}>
      <Image source={{ uri: cover }} style={styles.steamCover} contentFit="cover" transition={300} />
      <LinearGradient colors={['transparent', 'rgba(10,10,15,0.95)']} style={styles.steamGradient} />
      <View style={styles.steamInfo}>
        <Text style={styles.steamTitle} numberOfLines={2}>{game.title ?? game.name}</Text>
        {game.discount_percent > 0 && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{game.discount_percent}%</Text>
          </View>
        )}
        {game.final_price && (
          <Text style={styles.steamPrice}>R$ {(game.final_price / 100).toFixed(2)}</Text>
        )}
        {game.concurrent_players > 0 && (
          <Text style={styles.steamPlayers}>👥 {game.concurrent_players.toLocaleString()} jogando</Text>
        )}
      </View>
    </View>
  );
}

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<Tab>('games');
  const [search, setSearch] = useState('');
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ─── QUERIES ──────────────────────────────────────────────────────────────
  const { data: trendingGames, isLoading: trendingLoading, refetch: refetchTrending } = useQuery({
    queryKey: ['games-trending'],
    queryFn: () => gamesService.getTrending(),
    select: (res: any) => res.data?.data ?? res.data ?? [],
    enabled: activeTab === 'games',
  });

  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['games-search', searchQuery],
    queryFn: () => gamesService.search(searchQuery),
    select: (res: any) => res.data?.data ?? res.data ?? [],
    enabled: searchQuery.length >= 2 && activeTab === 'games',
  });

  const { data: steamData, refetch: refetchSteam } = useQuery({
    queryKey: ['steam-top'],
    queryFn: () => gamesService.getSteamTop(),
    select: (res: any) => res.data?.data ?? res.data ?? [],
    enabled: activeTab === 'steam',
  });

  const { data: communitiesData, refetch: refetchCommunities } = useQuery({
    queryKey: ['communities'],
    queryFn: () => communitiesService.getAll(),
    select: (res: any) => res.data?.data ?? [],
    enabled: activeTab === 'communities',
  });

  const { data: usersData } = useQuery({
    queryKey: ['users-suggested'],
    queryFn: () => usersService.getSuggested(),
    select: (res: any) => res.data?.data ?? res.data ?? [],
    enabled: activeTab === 'users',
  });

  const games = (searchQuery.length >= 2 ? searchResults : trendingGames) ?? [];
  const filteredGames = activeGenre
    ? games.filter((g: any) => g.genres?.some((genre: any) => (typeof genre === 'string' ? genre : genre.name) === activeGenre))
    : games;

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
      {/* Header + Search */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>EXPLORAR</Text>
      </View>

      <View style={styles.searchRow}>
        <Text style={{ color: Colors.muted, fontSize: 16 }}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={(t) => {
            setSearch(t);
            if (t.length >= 2) {
              setTimeout(() => setSearchQuery(t), 500);
            } else {
              setSearchQuery('');
            }
          }}
          placeholder={activeTab === 'games' ? 'Buscar jogo...' : activeTab === 'communities' ? 'Buscar comunidade...' : 'Buscar usuário...'}
          placeholderTextColor={Colors.muted}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => { setSearch(''); setSearchQuery(''); }}>
            <Text style={{ color: Colors.muted }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsRow}
        contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: 8 }}
      >
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => { Haptics.selectionAsync(); setActiveTab(t.key); }}
          >
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* GAMES TAB */}
      {activeTab === 'games' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: Spacing.md }}>
            <TouchableOpacity
              style={[styles.genreBtn, !activeGenre && styles.genreBtnActive]}
              onPress={() => { Haptics.selectionAsync(); setActiveGenre(null); }}
            >
              <Text style={[styles.genreBtnText, !activeGenre && styles.genreBtnTextActive]}>Todos</Text>
            </TouchableOpacity>
            {GENRES.map(g => (
              <TouchableOpacity
                key={g}
                style={[styles.genreBtn, activeGenre === g && styles.genreBtnActive]}
                onPress={() => { Haptics.selectionAsync(); setActiveGenre(activeGenre === g ? null : g); }}
              >
                <Text style={[styles.genreBtnText, activeGenre === g && styles.genreBtnTextActive]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {trendingLoading && !filteredGames.length
            ? <Text style={styles.loadingText}>Carregando...</Text>
            : (
              <View style={styles.gamesGrid}>
                {filteredGames.map((game: any) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    onPress={() => navigation.navigate('GameDetail', { gameId: game.id, game })}
                  />
                ))}
              </View>
            )
          }
          {!trendingLoading && filteredGames.length === 0 && (
            <EmptyState emoji="🎮" title="Nenhum jogo encontrado" subtitle="Tente buscar por outro termo." />
          )}
        </ScrollView>
      )}

      {/* TWITCH TAB — WebView do seu site */}
      {activeTab === 'twitch' && (
        <View style={{ flex: 1 }}>
          <WebView
            source={{ uri: 'https://wilkenperez.com/twitch' }}
            style={{ flex: 1, backgroundColor: Colors.bg }}
            startInLoadingState
            renderLoading={() => (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg }}>
                <Text style={{ color: Colors.accent, fontFamily: Fonts.display, fontSize: 20 }}>Carregando Twitch...</Text>
              </View>
            )}
          />
        </View>
      )}

      {/* STEAM TAB */}
      {activeTab === 'steam' && (
        <FlatList
          data={steamData ?? []}
          keyExtractor={(item: any, i) => item.steam_appid ?? i.toString()}
          renderItem={({ item }) => <SteamGameCard game={item} />}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={Colors.accent} />}
          ListEmptyComponent={() => <EmptyState emoji="🎮" title="Dados Steam indisponíveis" subtitle="Verifique a configuração da Steam API." />}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}

      {/* COMMUNITIES TAB */}
      {activeTab === 'communities' && (
        <FlatList
          data={communitiesData ?? []}
          keyExtractor={(item: any) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.communityCard} onPress={() => navigation.navigate('Community', { communityId: item.id })} activeOpacity={0.85}>
              <View style={styles.communityIcon}>
                <LinearGradient colors={[Colors.purple + '40', Colors.bg]} style={StyleSheet.absoluteFill} />
                <Text style={{ fontSize: 26 }}>{item.icon_url ?? '🎮'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.communityName}>{item.name}</Text>
                <Text style={styles.communityDesc} numberOfLines={1}>{item.description}</Text>
                <Text style={styles.communityMeta}>👥 {item.members_count ?? 0} membros</Text>
              </View>
              <TouchableOpacity style={styles.joinBtn} onPress={() => navigation.navigate('Community', { communityId: item.id })}>
                <Text style={styles.joinText}>Ver →</Text>
              </TouchableOpacity>
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
          data={usersData ?? []}
          keyExtractor={(item: any) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.userCard} onPress={() => navigation.navigate('UserProfile', { userId: item.id })} activeOpacity={0.85}>
              <View style={styles.userAvatar}>
                <Text style={{ fontFamily: Fonts.display, fontSize: 20, color: Colors.accent }}>
                  {(item.display_name ?? item.username ?? '?')[0].toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{item.display_name ?? item.username}</Text>
                <Text style={styles.userHandle}>@{item.username} · Nível {item.level ?? 1}</Text>
              </View>
              <View style={styles.followBtn}>
                <Text style={styles.followBtnText}>+ Seguir</Text>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => <EmptyState emoji="👥" title="Sem sugestões" subtitle="Explore mais para encontrar pessoas!" />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: 14 },
  headerTitle: { fontFamily: Fonts.display, fontSize: 28, letterSpacing: 3, color: Colors.text },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: Spacing.lg, marginBottom: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.xl, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, fontFamily: Fonts.body, fontSize: 14, color: Colors.text },
  tabsRow: { maxHeight: 44, marginBottom: Spacing.md },
  tab: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.accent + '15', borderColor: Colors.accent },
  tabText: { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.muted },
  tabTextActive: { color: Colors.accent },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
  loadingText: { fontFamily: Fonts.mono, fontSize: 13, color: Colors.muted, textAlign: 'center', padding: 40 },
  genreBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  genreBtnActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '15' },
  genreBtnText: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted },
  genreBtnTextActive: { color: Colors.accent },
  gamesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gameCard: { width: '47%', backgroundColor: Colors.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', ...Shadows.card },
  gameCover: { width: '100%', aspectRatio: 3/4, alignItems: 'center', justifyContent: 'center' },
  gameCardInfo: { padding: Spacing.sm },
  gameCardTitle: { fontFamily: Fonts.bodyBold, fontSize: 13, color: Colors.text, lineHeight: 18, marginBottom: 2 },
  gameCardDev: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  gameRating: { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.amber, marginTop: 4 },
  steamCard: { borderRadius: Radius.xl, overflow: 'hidden', height: 180, position: 'relative', ...Shadows.card },
  steamCover: { width: '100%', height: '100%' },
  steamGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' },
  steamInfo: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.md },
  steamTitle: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text, marginBottom: 4 },
  discountBadge: { backgroundColor: Colors.teal, borderRadius: Radius.xs, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 4 },
  discountText: { fontFamily: Fonts.monoBold, fontSize: 12, color: '#fff' },
  steamPrice: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.accent },
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
  userAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.accent + '20', borderWidth: 1, borderColor: Colors.accent + '40', alignItems: 'center', justifyContent: 'center' },
  userName: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text },
  userHandle: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted, marginTop: 2 },
  followBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.accent },
  followBtnText: { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.accent },
});
