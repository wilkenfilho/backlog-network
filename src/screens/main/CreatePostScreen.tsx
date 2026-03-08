import React, { useState, useRef } from 'react';
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
import { Avatar } from '../../components';
import { feedService } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const STATUS_OPTIONS = [
  { value: 'playing',  label: '🎮 Jogando',  color: Colors.purple },
  { value: 'finished', label: '✅ Zerado',   color: Colors.accent },
  { value: 'backlog',  label: '📦 Backlog',  color: Colors.amber },
  { value: 'dropped',  label: '💀 Largado',  color: Colors.red },
  { value: 'wishlist', label: '⭐ Desejo',   color: Colors.teal },
];

export default function CreatePostScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [content, setContent] = useState('');
  const [gameStatus, setGameStatus] = useState<string | null>(null);
  const [gameName, setGameName] = useState('');
  const [hoursPlayed, setHoursPlayed] = useState('');
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const createMutation = useMutation({
    mutationFn: (data: any) => feedService.createPost(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      navigation.goBack();
    },
    onError: () => Alert.alert('Erro', 'Não foi possível criar o post. Tente novamente.'),
  });

  const handleSubmit = () => {
    if (!content.trim()) { Alert.alert('Post vazio', 'Escreva algo antes de publicar.'); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    createMutation.mutate({
      content: content.trim(),
      game_status: gameStatus,
      game_name: gameName.trim() || null,
      hours_played: hoursPlayed ? Number(hoursPlayed) : null,
    });
  };

  const selectedStatus = STATUS_OPTIONS.find(s => s.value === gameStatus);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>NOVO POST</Text>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={createMutation.isPending || !content.trim()}
          style={[styles.publishBtn, (!content.trim() || createMutation.isPending) && { opacity: 0.4 }]}
        >
          <LinearGradient colors={[Colors.accent, Colors.accentDark]} style={styles.publishGradient}>
            <Text style={styles.publishText}>{createMutation.isPending ? '...' : 'Publicar'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Composer */}
        <View style={styles.composerRow}>
          <Avatar user={user as any} size={44} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={content}
            onChangeText={setContent}
            placeholder="O que você tá jogando? Conta pra galera..."
            placeholderTextColor={Colors.muted}
            multiline
            maxLength={500}
            autoFocus
          />
        </View>

        <Text style={styles.charCount}>{content.length}/500</Text>

        {/* Game name */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>JOGO (opcional)</Text>
          <TextInput
            style={styles.textInput}
            value={gameName}
            onChangeText={setGameName}
            placeholder="Ex: Elden Ring"
            placeholderTextColor={Colors.muted}
          />
        </View>

        {/* Status */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>STATUS</Text>
          <TouchableOpacity
            style={[styles.statusSelector, selectedStatus && { borderColor: selectedStatus.color + '60' }]}
            onPress={() => setShowStatusPicker(!showStatusPicker)}
          >
            <Text style={[styles.statusSelectorText, selectedStatus && { color: selectedStatus.color }]}>
              {selectedStatus ? selectedStatus.label : 'Selecionar status...'}
            </Text>
            <Text style={{ color: Colors.muted }}>▾</Text>
          </TouchableOpacity>
          {showStatusPicker && (
            <View style={styles.statusPicker}>
              {STATUS_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.statusOption, gameStatus === opt.value && { backgroundColor: opt.color + '15' }]}
                  onPress={() => { Haptics.selectionAsync(); setGameStatus(gameStatus === opt.value ? null : opt.value); setShowStatusPicker(false); }}
                >
                  <Text style={[styles.statusOptionText, { color: opt.color }]}>{opt.label}</Text>
                  {gameStatus === opt.value && <Text style={{ color: opt.color }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Hours */}
        {gameStatus && gameStatus !== 'wishlist' && (
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>HORAS JOGADAS (opcional)</Text>
            <TextInput
              style={[styles.textInput, { width: 120 }]}
              value={hoursPlayed}
              onChangeText={setHoursPlayed}
              placeholder="Ex: 48"
              placeholderTextColor={Colors.muted}
              keyboardType="numeric"
              maxLength={4}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cancelBtn: { paddingVertical: 8 },
  cancelText: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.muted },
  headerTitle: { fontFamily: Fonts.display, fontSize: 18, letterSpacing: 2, color: Colors.text },
  publishBtn: { borderRadius: Radius.md, overflow: 'hidden' },
  publishGradient: { paddingHorizontal: 18, paddingVertical: 9 },
  publishText: { fontFamily: Fonts.monoBold, fontSize: 13, color: '#0a0a0f' },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.lg, paddingBottom: 100 },
  composerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  input: { flex: 1, fontFamily: Fonts.body, fontSize: 16, color: Colors.text, lineHeight: 24, minHeight: 80 },
  charCount: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, textAlign: 'right', marginTop: -8 },
  field: { gap: 8 },
  fieldLabel: { fontFamily: Fonts.monoBold, fontSize: 10, letterSpacing: 2, color: Colors.muted },
  textInput: { backgroundColor: Colors.surface, borderRadius: Radius.xl, paddingHorizontal: 16, paddingVertical: 12, color: Colors.text, fontFamily: Fonts.body, fontSize: 14, borderWidth: 1, borderColor: Colors.border },
  statusSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: Radius.xl, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border },
  statusSelectorText: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.muted },
  statusPicker: { backgroundColor: Colors.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  statusOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  statusOptionText: { fontFamily: Fonts.bodyMedium, fontSize: 14 },
});
