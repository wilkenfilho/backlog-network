import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
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

export default function CreatePostScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const inputRef = useRef<TextInput>(null);
  const [content, setContent] = useState('');

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
    createMutation.mutate({ content: content.trim(), type: 'post' });
  };

  const displayName = user?.displayName ?? (user as any)?.display_name ?? user?.username ?? '';

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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

      <View style={styles.composerRow}>
        <Avatar user={user as any} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={styles.authorName}>{displayName}</Text>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={content}
            onChangeText={setContent}
            placeholder="No que você está pensando?"
            placeholderTextColor={Colors.muted}
            multiline
            maxLength={500}
            autoFocus
          />
        </View>
      </View>

      <Text style={styles.charCount}>{content.length}/500</Text>
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
  composerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  authorName: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text, marginBottom: 6 },
  input: { flex: 1, fontFamily: Fonts.body, fontSize: 16, color: Colors.text, lineHeight: 24, minHeight: 120 },
  charCount: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, textAlign: 'right', paddingHorizontal: Spacing.lg, marginTop: 4 },
});
