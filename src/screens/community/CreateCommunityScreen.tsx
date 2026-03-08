import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors, Fonts, Spacing, Radius } from '../../theme';
import { communitiesService } from '../../services/api';

const GENRES = ['RPG', 'Action', 'Indie', 'Roguelike', 'Platformer', 'Soulsborne', 'Strategy', 'Horror', 'Puzzle', 'Sports', 'FPS', 'Racing'];
const ICONS  = ['🎮', '⚔️', '🏹', '🧙', '🤖', '👾', '🎲', '🌍', '🔫', '🏎️', '⚽', '🧩'];

export default function CreateCommunityScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [icon, setIcon] = useState('🎮');
  const [isPrivate, setIsPrivate] = useState(false);

  const createMutation = useMutation({
    mutationFn: (data: any) => communitiesService.create(data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    },
    onError: () => Alert.alert('Erro', 'Não foi possível criar a comunidade.'),
  });

  const handleSubmit = () => {
    if (!name.trim()) { Alert.alert('Nome obrigatório', 'Dê um nome para a comunidade.'); return; }
    if (description.trim().length < 10) { Alert.alert('Descrição curta', 'Mínimo 10 caracteres.'); return; }
    createMutation.mutate({ name: name.trim(), description: description.trim(), genre, icon, is_private: isPrivate });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>NOVA COMUNIDADE</Text>
        <TouchableOpacity onPress={handleSubmit} disabled={createMutation.isPending} style={[styles.createBtn, createMutation.isPending && { opacity: 0.5 }]}>
          <LinearGradient colors={[Colors.accent, Colors.accentDark]} style={styles.createGradient}>
            <Text style={styles.createText}>{createMutation.isPending ? '...' : 'Criar'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Icon selector */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>ÍCONE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {ICONS.map(ic => (
              <TouchableOpacity key={ic} style={[styles.iconOption, icon === ic && styles.iconOptionActive]} onPress={() => { Haptics.selectionAsync(); setIcon(ic); }}>
                <Text style={{ fontSize: 24 }}>{ic}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>NOME DA COMUNIDADE</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ex: Roguelikes Anônimos" placeholderTextColor={Colors.muted} maxLength={60} />
        </View>

        <View style={styles.field}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
            <Text style={styles.fieldLabel}>DESCRIÇÃO</Text>
            <Text style={styles.charCount}>{description.length}/500</Text>
          </View>
          <TextInput style={[styles.input, styles.textarea]} value={description} onChangeText={setDescription} placeholder="Sobre o que é essa comunidade? Quem pode participar?" placeholderTextColor={Colors.muted} multiline maxLength={500} textAlignVertical="top" />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>GÊNERO (opcional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {GENRES.map(g => (
              <TouchableOpacity key={g} style={[styles.genreChip, genre === g && styles.genreChipActive]} onPress={() => { Haptics.selectionAsync(); setGenre(genre === g ? '' : g); }}>
                <Text style={[styles.genreChipText, genre === g && styles.genreChipTextActive]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <TouchableOpacity style={[styles.toggleRow, isPrivate && styles.toggleRowActive]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsPrivate(!isPrivate); }}>
          <View>
            <Text style={styles.toggleTitle}>🔒 Comunidade privada</Text>
            <Text style={styles.toggleSub}>Novos membros precisam de aprovação</Text>
          </View>
          <View style={[styles.toggle, isPrivate && styles.toggleActive]}>
            <View style={[styles.toggleThumb, isPrivate && styles.toggleThumbActive]} />
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
  createBtn: { borderRadius: Radius.md, overflow: 'hidden' },
  createGradient: { paddingHorizontal: 18, paddingVertical: 9 },
  createText: { fontFamily: Fonts.monoBold, fontSize: 13, color: '#0a0a0f' },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.xl, paddingBottom: 100 },
  field: { gap: 8 },
  fieldLabel: { fontFamily: Fonts.monoBold, fontSize: 10, letterSpacing: 2, color: Colors.muted },
  charCount: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  input: { backgroundColor: Colors.surface, borderRadius: Radius.xl, paddingHorizontal: 16, paddingVertical: 12, color: Colors.text, fontFamily: Fonts.body, fontSize: 14, borderWidth: 1, borderColor: Colors.border },
  textarea: { minHeight: 100, textAlignVertical: 'top' },
  iconOption: { width: 52, height: 52, borderRadius: Radius.lg, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  iconOptionActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '15' },
  genreChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  genreChipActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '15' },
  genreChipText: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted },
  genreChipTextActive: { color: Colors.accent },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  toggleRowActive: { borderColor: Colors.purple + '60', backgroundColor: Colors.purple + '08' },
  toggleTitle: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text },
  toggleSub: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, marginTop: 2 },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: Colors.border, padding: 3 },
  toggleActive: { backgroundColor: Colors.purple },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.text },
  toggleThumbActive: { transform: [{ translateX: 18 }] },
});
