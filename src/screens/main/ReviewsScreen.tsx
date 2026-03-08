import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors, Fonts, Spacing, Radius, Shadows } from '../../theme';
import { EmptyState } from '../../components';
import { reviewsService } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

type Filter = 'all' | 'recent' | 'top';

function timeAgo(d: string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 86400)   return `${Math.floor(s / 3600)}h`;
  if (s < 604800)  return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / 604800)}sem`;
}

function ReviewCard({ review, onPress }: { review: any; onPress: () => void }) {
  const [liked, setLiked] = useState(review.liked_by_me ?? false);
  const [likes, setLikes] = useState(review.likes_count ?? 0);
  const likeMutation = useMutation({ mutationFn: () => reviewsService.likeReview(review.id) });

  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLiked(!liked);
    setLikes((c: number) => liked ? c - 1 : c + 1);
    likeMutation.mutate();
  };

  const ratingColor = review.rating >= 8 ? Colors.teal : review.rating >= 6 ? Colors.accent : review.rating >= 4 ? Colors.amber : Colors.red;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {/* Game cover + info */}
      <View style={styles.gameRow}>
        <View style={styles.coverWrapper}>
          {review.game_cover
            ? <Image source={{ uri: review.game_cover }} style={styles.cover} contentFit="cover" transition={300} />
            : <LinearGradient colors={['#1a1628', '#0d0d14']} style={styles.cover}><Text style={{ fontSize: 24 }}>🎮</Text></LinearGradient>
          }
          <View style={[styles.ratingBadge, { backgroundColor: ratingColor }]}>
            <Text style={styles.ratingBadgeText}>{review.rating}</Text>
          </View>
        </View>
        <View style={styles.gameInfo}>
          <Text style={styles.gameTitle} numberOfLines={2}>{review.game_title}</Text>
          <Text style={styles.gameDev} numberOfLines={1}>{review.developer}</Text>
          {review.platform && (
            <View style={styles.platformTag}>
              <Text style={styles.platformText}>{review.platform}</Text>
            </View>
          )}
          {review.hours_played > 0 && (
            <Text style={styles.hours}>⏱ {review.hours_played}h jogadas</Text>
          )}
        </View>
        <Text style={styles.cardTime}>{timeAgo(review.created_at)}</Text>
      </View>

      {/* Stars */}
      <View style={styles.starsRow}>
        {Array(10).fill(0).map((_, i) => (
          <Text key={i} style={[styles.star, i < Math.round(review.rating) && { color: ratingColor }]}>★</Text>
        ))}
      </View>

      {/* Title */}
      {review.title && <Text style={styles.reviewTitle}>"{review.title}"</Text>}

      {/* Body */}
      {review.spoiler
        ? <View style={styles.spoilerBox}><Text style={styles.spoilerText}>⚠️ Contém spoilers — toque para ver</Text></View>
        : <Text style={styles.reviewBody} numberOfLines={4}>{review.body}</Text>
      }

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
          <Text style={[styles.actionIcon, liked && { color: Colors.red }]}>{liked ? '♥' : '♡'}</Text>
          <Text style={[styles.actionCount, liked && { color: Colors.red }]}>{likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionCount}>{review.comments_count ?? 0}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={styles.readMoreBtn}
          onPress={onPress}
        >
          <Text style={styles.readMoreText}>Ler completo →</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function ReviewsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const [filter, setFilter] = useState<Filter>('all');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['reviews-feed', filter],
    queryFn: () => reviewsService.getMyReviews(1),
    select: (res: any) => res.data?.data ?? res.data ?? [],
  });

  const reviews: any[] = data ?? [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>REVIEWS</Text>
        <TouchableOpacity
          style={styles.writeBtn}
          onPress={() => navigation.navigate('ReviewCreate')}
        >
          <LinearGradient colors={[Colors.accent, Colors.accentDark]} style={styles.writeBtnGradient}>
            <Text style={styles.writeBtnText}>+ Escrever</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        {([
          { key: 'all',    label: 'Minhas reviews' },
          { key: 'recent', label: 'Recentes' },
          { key: 'top',    label: 'Mais curtidas' },
        ] as const).map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => { Haptics.selectionAsync(); setFilter(f.key); }}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={reviews}
        keyExtractor={(item: any) => item.id}
        renderItem={({ item }) => (
          <ReviewCard
            review={item}
            onPress={() => navigation.navigate('ReviewDetail', { reviewId: item.id })}
          />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.accent} />}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={() => (
          isLoading
            ? <View style={{ padding: 40, alignItems: 'center' }}><Text style={{ color: Colors.muted, fontFamily: Fonts.mono }}>Carregando...</Text></View>
            : (
              <View style={{ padding: 40, alignItems: 'center', gap: 16 }}>
                <EmptyState emoji="✍️" title="Sem reviews ainda" subtitle="Escreva sua primeira avaliação!" />
                <TouchableOpacity style={styles.writeBtnLarge} onPress={() => navigation.navigate('ReviewCreate')}>
                  <LinearGradient colors={[Colors.accent, Colors.accentDark]} style={styles.writeBtnGradient}>
                    <Text style={styles.writeBtnText}>✍️  Escrever review</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontFamily: Fonts.display, fontSize: 28, letterSpacing: 3, color: Colors.text },
  writeBtn: { borderRadius: Radius.md, overflow: 'hidden' },
  writeBtnLarge: { borderRadius: Radius.xl, overflow: 'hidden', width: 200 },
  writeBtnGradient: { paddingHorizontal: 18, paddingVertical: 10, alignItems: 'center' },
  writeBtnText: { fontFamily: Fonts.monoBold, fontSize: 13, color: '#0a0a0f' },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.lg, paddingVertical: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '15' },
  filterText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  filterTextActive: { color: Colors.accent },
  list: { paddingHorizontal: Spacing.lg, paddingTop: 4, paddingBottom: 100 },
  card: { backgroundColor: Colors.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', ...Shadows.card },
  gameRow: { flexDirection: 'row', gap: 12, padding: Spacing.md, paddingBottom: 8 },
  coverWrapper: { position: 'relative' },
  cover: { width: 72, height: 96, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  ratingBadge: { position: 'absolute', bottom: -6, right: -6, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.bg },
  ratingBadgeText: { fontFamily: Fonts.monoBold, fontSize: 11, color: '#fff' },
  gameInfo: { flex: 1, paddingTop: 4 },
  gameTitle: { fontFamily: Fonts.bodyBold, fontSize: 15, color: Colors.text, lineHeight: 20, marginBottom: 3 },
  gameDev: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted, marginBottom: 6 },
  platformTag: { backgroundColor: Colors.surface, borderRadius: Radius.xs, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', borderWidth: 1, borderColor: Colors.border, marginBottom: 4 },
  platformText: { fontFamily: Fonts.monoBold, fontSize: 9, color: Colors.muted },
  hours: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  cardTime: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  starsRow: { flexDirection: 'row', gap: 2, paddingHorizontal: Spacing.md, paddingTop: 8, paddingBottom: 4 },
  star: { fontSize: 13, color: Colors.border },
  reviewTitle: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text, fontStyle: 'italic', paddingHorizontal: Spacing.md, paddingVertical: 6 },
  reviewBody: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textSecondary, lineHeight: 20, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  spoilerBox: { margin: Spacing.md, backgroundColor: Colors.amber + '15', borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.amber + '40' },
  spoilerText: { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.amber, textAlign: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: 10, gap: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6 },
  actionIcon: { fontSize: 18, color: Colors.muted },
  actionCount: { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.muted },
  readMoreBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  readMoreText: { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.accent },
});
