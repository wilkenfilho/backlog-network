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
import { Avatar } from '../../components';
import { usersService } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState(user?.display_name ?? user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [website, setWebsite] = useState(user?.website ?? '');

  const saveMutation = useMutation({
    mutationFn: (data: any) => usersService.updateProfile(data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      if (setUser) setUser({ ...user, display_name: displayName, bio, website } as any);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    },
    onError: () => Alert.alert('Erro', 'Não foi possível salvar. Tente novamente.'),
  });

  const handleSave = () => {
    if (!displayName.trim()) { Alert.alert('Nome obrigatório', 'Digite um nome de exibição.'); return; }
    saveMutation.mutate({ display_name: displayName.trim(), bio: bio.trim(), website: website.trim() });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>EDITAR PERFIL</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saveMutation.isPending}
          style={[styles.saveBtn, saveMutation.isPending && { opacity: 0.5 }]}
        >
          <LinearGradient colors={[Colors.accent, Colors.accentDark]} style={styles.saveGradient}>
            <Text style={styles.saveText}>{saveMutation.isPending ? '...' : 'Salvar'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <Avatar user={user as any} size={80} />
          <TouchableOpacity style={styles.changeAvatarBtn} onPress={() => Alert.alert('Em breve', 'Upload de foto em breve.')}>
            <Text style={styles.changeAvatarText}>Trocar foto</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>NOME DE EXIBIÇÃO</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Como você quer ser chamado?"
            placeholderTextColor={Colors.muted}
            maxLength={50}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>USERNAME</Text>
          <View style={[styles.input, { opacity: 0.5, flexDirection: 'row', alignItems: 'center' }]}>
            <Text style={{ color: Colors.muted, fontFamily: Fonts.mono }}>@{user?.username}</Text>
          </View>
          <Text style={styles.fieldHint}>Username não pode ser alterado por aqui</Text>
        </View>

        <View style={styles.field}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
            <Text style={styles.fieldLabel}>BIO</Text>
            <Text style={styles.charCount}>{bio.length}/200</Text>
          </View>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={bio}
            onChangeText={setBio}
            placeholder="Conte um pouco sobre você e seus jogos..."
            placeholderTextColor={Colors.muted}
            multiline
            maxLength={200}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>WEBSITE / REDES SOCIAIS</Text>
          <TextInput
            style={styles.input}
            value={website}
            onChangeText={setWebsite}
            placeholder="https://"
            placeholderTextColor={Colors.muted}
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cancelBtn: { paddingVertical: 8 },
  cancelText: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.muted },
  headerTitle: { fontFamily: Fonts.display, fontSize: 16, letterSpacing: 2, color: Colors.text },
  saveBtn: { borderRadius: Radius.md, overflow: 'hidden' },
  saveGradient: { paddingHorizontal: 18, paddingVertical: 9 },
  saveText: { fontFamily: Fonts.monoBold, fontSize: 13, color: '#0a0a0f' },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, gap: Spacing.xl, paddingBottom: 100 },
  avatarSection: { alignItems: 'center', gap: 12, marginBottom: Spacing.md },
  changeAvatarBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.accent },
  changeAvatarText: { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.accent },
  field: { gap: 8 },
  fieldLabel: { fontFamily: Fonts.monoBold, fontSize: 10, letterSpacing: 2, color: Colors.muted },
  fieldHint: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  charCount: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  input: { backgroundColor: Colors.surface, borderRadius: Radius.xl, paddingHorizontal: 16, paddingVertical: 12, color: Colors.text, fontFamily: Fonts.body, fontSize: 14, borderWidth: 1, borderColor: Colors.border },
  textarea: { minHeight: 100, textAlignVertical: 'top' },
});
