import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Colors, Fonts, Spacing, Radius } from '../../theme';
import { topicsService } from '../../services/api';

export default function TopicCreateScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();

  const { communityId, communityName } = route.params ?? {};

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: { community_id: string; title: string; body: string }) =>
      topicsService.create(data),
    onSuccess: (res: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['community-topics', communityId] });
      navigation.navigate('Community', { communityId, topicCreated: true });
    },
    onError: (err: any) => {
      Alert.alert('Erro', err?.message || 'Não foi possível criar o tópico.');
    },
  });

  const handleSubmit = () => {
    if (!title.trim()) {
      Alert.alert('Título obrigatório', 'Dê um título ao seu tópico.');
      return;
    }
    if (body.trim().length < 10) {
      Alert.alert('Conteúdo muito curto', 'Escreva pelo menos 10 caracteres.');
      return;
    }
    if (!communityId) {
      Alert.alert('Erro', 'Comunidade não identificada.');
      return;
    }

    createMutation.mutate({
      community_id: communityId,
      title: title.trim(),
      body: body.trim(),
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>NOVO TÓPICO</Text>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={createMutation.isPending}
          style={[styles.createBtn, createMutation.isPending && { opacity: 0.5 }]}
        >
          <LinearGradient colors={[Colors.accent, Colors.accentDark]} style={styles.createGradient}>
            {createMutation.isPending ? (
              <ActivityIndicator color="#0a0a0f" size="small" />
            ) : (
              <Text style={styles.createText}>Publicar</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.communityChip}>
          <Text style={styles.communityLabel}>Em</Text>
          <LinearGradient colors={[Colors.accent + '20', Colors.accent + '08']} style={styles.communityNameChip}>
            <Text style={styles.communityName}>{communityName || 'Comunidade'}</Text>
          </LinearGradient>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>TÍTULO</Text>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Ex: Qual a melhor build para iniciantes?"
            placeholderTextColor={Colors.muted}
            maxLength={150}
            autoFocus
          />
          <Text style={styles.charCount}>{title.length}/150</Text>
        </View>

        <View style={styles.field}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>CONTEÚDO</Text>
            <Text style={styles.charCount}>{body.length}/5000</Text>
          </View>
          <TextInput
            style={styles.bodyInput}
            value={body}
            onChangeText={setBody}
            placeholder="Escreva sua dúvida, opinião ou o que quiser compartilhar..."
            placeholderTextColor={Colors.muted}
            multiline
            maxLength={5000}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.tipBox}>
          <Text style={styles.tipText}>💡 Dicas:</Text>
          <Text style={styles.tipText}>• Seja claro e específico no título</Text>
          <Text style={styles.tipText}>• Evite spoilers sem aviso</Text>
          <Text style={styles.tipText}>• Respeite as regras da comunidade</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cancelBtn: { paddingVertical: 8 },
  cancelText: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.muted },
  headerTitle: { fontFamily: Fonts.display, fontSize: 16, letterSpacing: 2, color: Colors.text },
  createBtn: { borderRadius: Radius.md, overflow: 'hidden' },
  createGradient: { paddingHorizontal: 18, paddingVertical: 9, minWidth: 80, alignItems: 'center' },
  createText: { fontFamily: Fonts.monoBold, fontSize: 13, color: '#0a0a0f' },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.xl, paddingBottom: 100 },
  communityChip: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  communityLabel: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted },
  communityNameChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.accent + '40',
  },
  communityName: { fontFamily: Fonts.bodyBold, fontSize: 13, color: Colors.accent },
  field: { gap: 8 },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldLabel: { fontFamily: Fonts.monoBold, fontSize: 10, letterSpacing: 2, color: Colors.muted },
  charCount: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  titleInput: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.text,
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bodyInput: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.text,
    fontFamily: Fonts.body,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 200,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  tipBox: {
    backgroundColor: Colors.surface2,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tipText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted, lineHeight: 18 },
});