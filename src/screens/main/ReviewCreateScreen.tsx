import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Alert, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Colors, Fonts, Spacing, Radius } from '../../theme';
import { Avatar } from '../../components';
import { reviewsService, rawgService } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export default function ReviewCreateScreen({ route }: any) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [rating, setRating] = useState(7);
  const [gameSearch, setGameSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGame, setSelectedGame] = useState<any>(route?.params?.game ?? null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [spoiler, setSpoiler] = useState(false);
  const [platform, setPlatform] = useState('');
  const [hoursPlayed, setHoursPlayed] = useState('');

  // Debounce game search
  useEffect(() => {
    if (gameSearch.length < 2) { setSearchQuery(''); return; }
    const t = setTimeout(() => setSearchQuery(gameSearch), 350);
    return () => clearTimeout(t);
  }, [gameSearch]);

  const { data: searchResults, isFetching: searchFetching } = useQuery({
    queryKey: ['game-search-review', searchQuery],
    queryFn: () => rawgService.search(searchQuery),
    select: (raw: any) => Array.isArray(raw) ? raw : [],
    enabled: searchQuery.length >= 2,
  });

  const games = searchResults ?? [];
  // Auto-show dropdown when results arrive
  useEffect(() => {
    if (games.length > 0 && !selectedGame) setShowDropdown(true);
  }, [games]);

  const createMutation = useMutation({
    mutationFn: (data: any) => reviewsService.createReview(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    },
    onError: (e: any) => {
      const status = e?.status ?? e?.response?.status;
      if (status === 409) {
        Alert.alert(
          'Review já existe',
          'Você já escreveu uma review para este jogo. Acesse seu perfil > Reviews para editá-la.',
          [{ text: 'Ver meu perfil', onPress: () => navigation.navigate('Profile') }, { text: 'OK', style: 'cancel' }]
        );
      } else {
        Alert.alert('Erro', e?.message ?? 'Não foi possível publicar a review.');
      }
    },
  });

  const handleSubmit = () => {
    if (!selectedGame) { Alert.alert('Jogo obrigatório', 'Selecione um jogo para a review.'); return; }
    if (!body.trim() || body.trim().length < 50) { Alert.alert('Review curta', 'Escreva pelo menos 50 caracteres.'); return; }
    if (rating < 0.5 || rating > 10) { Alert.alert('Nota inválida', 'Dê uma nota de 1 a 10.'); return; }
    createMutation.mutate({
      game_id: selectedGame.id,
      rating,
      title: title.trim() || null,
      body: body.trim(),
      spoiler,
      platform: platform || null,
      hours_played: hoursPlayed ? Number(hoursPlayed) : null,
    });
  };

  const selectGame = (game: any) => {
    setSelectedGame(game);
    setGameSearch(game.title ?? game.name);
    setShowDropdown(false);
    Haptics.selectionAsync();
  };

  const ratingColor = rating >= 8 ? Colors.teal : rating >= 6 ? Colors.accent : rating >= 4 ? Colors.amber : Colors.red;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ESCREVER REVIEW</Text>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={createMutation.isPending || !selectedGame || body.trim().length < 50}
          style={[styles.publishBtn, (createMutation.isPending || !selectedGame || body.trim().length < 50) && { opacity: 0.4 }]}
        >
          <LinearGradient colors={[Colors.accent, Colors.accentDark]} style={styles.publishGradient}>
            <Text style={styles.publishText}>{createMutation.isPending ? '...' : 'Publicar'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Game search with dropdown */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>JOGO *</Text>
          <View style={{ position: 'relative', zIndex: 10 }}>
            <TextInput
              style={[styles.textInput, selectedGame && { borderColor: Colors.accent + '60' }]}
              value={gameSearch}
              onChangeText={(t) => {
                setGameSearch(t);
                setSelectedGame(null);
                setShowDropdown(true);
              }}
              placeholder="Buscar jogo..."
              placeholderTextColor={Colors.muted}
            />
            {showDropdown && games.length > 0 && !selectedGame && (
              <View style={styles.dropdown}>
                {games.slice(0, 6).map((game: any) => (
                  <TouchableOpacity key={game.id} style={styles.dropdownItem} onPress={() => selectGame(game)}>
                    {game.cover_url ? (
                      <Image source={{ uri: game.cover_url }} style={styles.dropdownCover} contentFit="cover" />
                    ) : (
                      <View style={[styles.dropdownCover, { backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ fontSize: 14 }}>🎮</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dropdownTitle} numberOfLines={1}>{game.title ?? game.name}</Text>
                      <Text style={styles.dropdownDev} numberOfLines={1}>{game.developer ?? ''}</Text>
                    </View>
                    {(game.rawg_rating || game.rating) > 0 && (
                      <Text style={styles.dropdownRating}>⭐ {Number(game.rawg_rating ?? game.rating ?? 0).toFixed(1)}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          {selectedGame && (
            <View style={styles.selectedGameCard}>
              <Text style={{ fontSize: 18 }}>🎮</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedGameTitle}>{selectedGame.title ?? selectedGame.name}</Text>
                <Text style={styles.selectedGameDev}>{selectedGame.developer ?? ''}</Text>
              </View>
              <TouchableOpacity onPress={() => { setSelectedGame(null); setGameSearch(''); }}>
                <Text style={{ color: Colors.muted }}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Rating */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>NOTA *</Text>
          <View style={styles.ratingRow}>
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <TouchableOpacity
                key={n}
                style={[styles.ratingBtn, rating === n && { backgroundColor: ratingColor + '25', borderColor: ratingColor }]}
                onPress={() => { Haptics.selectionAsync(); setRating(n); }}
              >
                <Text style={[styles.ratingBtnText, rating === n && { color: ratingColor }]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={[styles.ratingDisplay, { backgroundColor: ratingColor + '15', borderColor: ratingColor + '40' }]}>
            <Text style={[styles.ratingDisplayText, { color: ratingColor }]}>{rating}/10</Text>
          </View>
        </View>

        {/* Title */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>TÍTULO DA REVIEW (opcional)</Text>
          <TextInput
            style={styles.textInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Ex: Uma obra-prima dos RPGs modernos"
            placeholderTextColor={Colors.muted}
            maxLength={150}
          />
        </View>

        {/* Body */}
        <View style={styles.field}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.fieldLabel}>REVIEW *</Text>
            <Text style={styles.charCount}>{body.length}/10.000</Text>
          </View>
          <TextInput
            style={[styles.textInput, styles.bodyInput]}
            value={body}
            onChangeText={setBody}
            placeholder="Escreva sua análise completa sobre o jogo. Fale sobre gameplay, narrativa, design, trilha sonora, performance, o que quiser..."
            placeholderTextColor={Colors.muted}
            multiline
            maxLength={10000}
            textAlignVertical="top"
          />
          {body.length > 0 && body.length < 50 && (
            <Text style={styles.minChars}>Mínimo 50 caracteres ({50 - body.length} restantes)</Text>
          )}
        </View>

        {/* Platform */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>PLATAFORMA (opcional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {['PC', 'PS5', 'PS4', 'Xbox Series', 'Xbox One', 'Nintendo Switch'].map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.platformChip, platform === p && styles.platformChipActive]}
                onPress={() => { Haptics.selectionAsync(); setPlatform(platform === p ? '' : p); }}
              >
                <Text style={[styles.platformChipText, platform === p && styles.platformChipTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Hours played */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>HORAS JOGADAS (opcional)</Text>
          <TextInput
            style={[styles.textInput, { width: 120 }]}
            value={hoursPlayed}
            onChangeText={setHoursPlayed}
            placeholder="Ex: 48"
            placeholderTextColor={Colors.muted}
            keyboardType="numeric"
            maxLength={5}
          />
        </View>

        {/* Spoiler toggle */}
        <TouchableOpacity
          style={[styles.spoilerRow, spoiler && styles.spoilerRowActive]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSpoiler(!spoiler); }}
        >
          <View>
            <Text style={styles.spoilerTitle}>⚠️ Contém spoilers</Text>
            <Text style={styles.spoilerSub}>Marcar para esconder o conteúdo por padrão</Text>
          </View>
          <View style={[styles.toggle, spoiler && styles.toggleActive]}>
            <View style={[styles.toggleThumb, spoiler && styles.toggleThumbActive]} />
          </View>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cancelBtn: { paddingVertical: 8 },
  cancelText: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.muted },
  headerTitle: { fontFamily: Fonts.display, fontSize: 16, letterSpacing: 2, color: Colors.text },
  publishBtn: { borderRadius: Radius.md, overflow: 'hidden' },
  publishGradient: { paddingHorizontal: 18, paddingVertical: 9 },
  publishText: { fontFamily: Fonts.monoBold, fontSize: 13, color: '#0a0a0f' },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.xl, paddingBottom: 100 },
  field: { gap: 8 },
  fieldLabel: { fontFamily: Fonts.monoBold, fontSize: 10, letterSpacing: 2, color: Colors.muted },
  charCount: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  minChars: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.amber },
  textInput: { backgroundColor: Colors.surface, borderRadius: Radius.xl, paddingHorizontal: 16, paddingVertical: 12, color: Colors.text, fontFamily: Fonts.body, fontSize: 14, borderWidth: 1, borderColor: Colors.border },
  bodyInput: { minHeight: 200, textAlignVertical: 'top', lineHeight: 22 },
  dropdown: { position: 'absolute', top: 50, left: 0, right: 0, backgroundColor: Colors.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', zIndex: 999, elevation: 10 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropdownCover: { width: 36, height: 48, borderRadius: 6 },
  dropdownTitle: { fontFamily: Fonts.bodyBold, fontSize: 13, color: Colors.text },
  dropdownDev: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  dropdownRating: { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.amber },
  selectedGameCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.accent + '10', borderRadius: Radius.lg, padding: 12, borderWidth: 1, borderColor: Colors.accent + '30' },
  selectedGameTitle: { fontFamily: Fonts.bodyBold, fontSize: 13, color: Colors.text },
  selectedGameDev: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  ratingRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  ratingBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  ratingBtnText: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.muted },
  ratingDisplay: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 6, borderRadius: Radius.lg, borderWidth: 1 },
  ratingDisplayText: { fontFamily: Fonts.display, fontSize: 20 },
  platformChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  platformChipActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '15' },
  platformChipText: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted },
  platformChipTextActive: { color: Colors.accent },
  spoilerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  spoilerRowActive: { borderColor: Colors.amber + '60', backgroundColor: Colors.amber + '08' },
  spoilerTitle: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text },
  spoilerSub: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, marginTop: 2 },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: Colors.border, padding: 3 },
  toggleActive: { backgroundColor: Colors.amber },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.text },
  toggleThumbActive: { transform: [{ translateX: 18 }] },
});
