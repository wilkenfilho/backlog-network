import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors, Fonts, Spacing, Radius } from '../../theme';
import { listsService } from '../../services/api';

const LIST_TYPES = [
  { value: 'custom',    label: '📋 Lista livre',     desc: 'Qualquer jogo que você quiser' },
  { value: 'wishlist',  label: '⭐ Lista de desejos', desc: 'Jogos que você quer comprar' },
  { value: 'favorites', label: '❤️ Favoritos',        desc: 'Os melhores de todos os tempos' },
  { value: 'ranked',    label: '🏆 Ranking pessoal',  desc: 'Do melhor ao pior' },
];

export default function CreateListScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [listType, setListType] = useState('custom');
  const [isPublic, setIsPublic] = useState(true);

  const createMutation = useMutation({
    mutationFn: (data: any) => listsService.create(data),
    onSuccess: (newList: any) => {
      // Invalidate all user-lists queries so profile tab refreshes immediately
      queryClient.invalidateQueries({ queryKey: ['user-lists'] });
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    },
    onError: (e: any) => Alert.alert('Erro ao criar lista', e?.message ?? 'Não foi possível criar a lista.'),
  });

  const handleSubmit = () => {
    if (!title.trim()) { Alert.alert('Título obrigatório', 'Dê um nome para sua lista.'); return; }
    createMutation.mutate({
      title: title.trim(),
      description: description.trim() || null,
      list_type: listType,
      is_public: isPublic,
    });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>NOVA LISTA</Text>
        <TouchableOpacity onPress={handleSubmit} disabled={createMutation.isPending || !title.trim()} style={[styles.createBtn, (!title.trim() || createMutation.isPending) && { opacity: 0.4 }]}>
          <LinearGradient colors={[Colors.accent, Colors.accentDark]} style={styles.createGradient}>
            <Text style={styles.createText}>{createMutation.isPending ? '...' : 'Criar'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>TIPO DE LISTA</Text>
          {LIST_TYPES.map(t => (
            <TouchableOpacity
              key={t.value}
              style={[styles.typeOption, listType === t.value && styles.typeOptionActive]}
              onPress={() => { Haptics.selectionAsync(); setListType(t.value); }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.typeLabel, listType === t.value && styles.typeLabelActive]}>{t.label}</Text>
                <Text style={styles.typeDesc}>{t.desc}</Text>
              </View>
              <View style={[styles.radio, listType === t.value && styles.radioActive]}>
                {listType === t.value && <View style={styles.radioDot} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>TÍTULO</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Ex: RPGs que me quebraram emocionalmente"
            placeholderTextColor={Colors.muted}
            maxLength={80}
            autoFocus
          />
        </View>

        <View style={styles.field}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
            <Text style={styles.fieldLabel}>DESCRIÇÃO (opcional)</Text>
            <Text style={styles.charCount}>{description.length}/300</Text>
          </View>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Qual é o critério dessa lista?"
            placeholderTextColor={Colors.muted}
            multiline
            maxLength={300}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity style={[styles.toggleRow, !isPublic && styles.toggleRowPrivate]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsPublic(!isPublic); }}>
          <View>
            <Text style={styles.toggleTitle}>{isPublic ? '🌍 Lista pública' : '🔒 Lista privada'}</Text>
            <Text style={styles.toggleSub}>{isPublic ? 'Qualquer pessoa pode ver' : 'Só você pode ver'}</Text>
          </View>
          <View style={[styles.toggle, isPublic && styles.toggleActive]}>
            <View style={[styles.toggleThumb, isPublic && styles.toggleThumbActive]} />
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
  headerTitle: { fontFamily: Fonts.display, fontSize: 18, letterSpacing: 2, color: Colors.text },
  createBtn: { borderRadius: Radius.md, overflow: 'hidden' },
  createGradient: { paddingHorizontal: 18, paddingVertical: 9 },
  createText: { fontFamily: Fonts.monoBold, fontSize: 13, color: '#0a0a0f' },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.xl, paddingBottom: 100 },
  field: { gap: 8 },
  fieldLabel: { fontFamily: Fonts.monoBold, fontSize: 10, letterSpacing: 2, color: Colors.muted },
  charCount: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  input: { backgroundColor: Colors.surface, borderRadius: Radius.xl, paddingHorizontal: 16, paddingVertical: 12, color: Colors.text, fontFamily: Fonts.body, fontSize: 14, borderWidth: 1, borderColor: Colors.border },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  typeOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  typeOptionActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '08' },
  typeLabel: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.textSecondary, marginBottom: 2 },
  typeLabelActive: { color: Colors.text },
  typeDesc: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: Colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.accent },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  toggleRowPrivate: { borderColor: Colors.amber + '40' },
  toggleTitle: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text },
  toggleSub: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, marginTop: 2 },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: Colors.border, padding: 3 },
  toggleActive: { backgroundColor: Colors.accent },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.text },
  toggleThumbActive: { transform: [{ translateX: 18 }] },
});
