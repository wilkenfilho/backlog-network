import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { Colors, Fonts, Spacing, Radius, Shadows } from '../../theme';
import { EmptyState } from '../../components';
import { communitiesService } from '../../services/api';

// Avatar da comunidade: foto se tiver, iniciais do nome como fallback
function CommunityAvatar({ coverUrl, name, size = 56 }: { coverUrl?: string; name: string; size?: number }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? '')
    .join('');

  if (coverUrl) {
    return (
      <Image
        source={{ uri: coverUrl }}
        style={{ width: size, height: size, borderRadius: size * 0.22 }}
        contentFit="cover"
      />
    );
  }

  return (
    <View style={[
      avatarStyles.fallback,
      { width: size, height: size, borderRadius: size * 0.22 },
    ]}>
      <Text style={[avatarStyles.initials, { fontSize: size * 0.35 }]}>{initials || '?'}</Text>
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  fallback: {
    backgroundColor: Colors.purple + '30',
    borderWidth: 1,
    borderColor: Colors.purple + '50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: Fonts.monoBold,
    color: Colors.accent,
    includeFontPadding: false,
  },
});

export default function CommunitiesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['communities'],
    queryFn: () => communitiesService.getAll(),
    select: (res: any) => res.data?.data ?? [],
  });

  const communities: any[] = (data ?? []).filter((c: any) =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ color: Colors.text, fontSize: 20 }}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>COMUNIDADES</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => navigation.navigate('CreateCommunity')}
        >
          <LinearGradient colors={[Colors.accent, Colors.accentDark]} style={styles.createGradient}>
            <Text style={styles.createText}>+ Nova</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <Text style={{ color: Colors.muted, fontSize: 16 }}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar comunidade..."
          placeholderTextColor={Colors.muted}
        />
      </View>

      <FlatList
        data={communities}
        keyExtractor={(item: any) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('Community', { communityId: item.id, community: item })}
            activeOpacity={0.85}
          >
            <View style={styles.cardIcon}>
              <CommunityAvatar coverUrl={item.cover_url ?? item.icon_url} name={item.name ?? ''} size={40} />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
              <View style={styles.cardMeta}>
                <Text style={styles.cardMetaText}>👥 {item.members_count ?? 0} membros</Text>
                {item.genre && <Text style={styles.cardGenre}>{item.genre}</Text>}
              </View>
            </View>
            <TouchableOpacity style={styles.joinBtn}>
              <Text style={styles.joinText}>Entrar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ padding: Spacing.lg, gap: 12, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.accent} />}
        ListEmptyComponent={() => (
          isLoading
            ? <View style={{ padding: 40, alignItems: 'center' }}><Text style={{ color: Colors.muted, fontFamily: Fonts.mono }}>Carregando...</Text></View>
            : <EmptyState emoji="" title="Nenhuma comunidade" subtitle="Seja o primeiro a criar uma!" />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontFamily: Fonts.display, fontSize: 22, letterSpacing: 3, color: Colors.text },
  createBtn: { borderRadius: Radius.md, overflow: 'hidden' },
  createGradient: { paddingHorizontal: 14, paddingVertical: 8 },
  createText: { fontFamily: Fonts.monoBold, fontSize: 12, color: '#0a0a0f' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: Spacing.lg, backgroundColor: Colors.surface, borderRadius: Radius.xl, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, fontFamily: Fonts.body, fontSize: 14, color: Colors.text },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, ...Shadows.card },
  cardIcon: { width: 56, height: 56, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  cardInfo: { flex: 1 },
  cardName: { fontFamily: Fonts.bodyBold, fontSize: 15, color: Colors.text, marginBottom: 3 },
  cardDesc: { fontFamily: Fonts.body, fontSize: 12, color: Colors.muted, lineHeight: 17, marginBottom: 6 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardMetaText: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  cardGenre: { fontFamily: Fonts.monoBold, fontSize: 9, color: Colors.accent, backgroundColor: Colors.accent + '15', paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  joinBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.accent },
  joinText: { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.accent },
});
