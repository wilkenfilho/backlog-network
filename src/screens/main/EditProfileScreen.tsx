import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Alert, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors, Fonts, Spacing, Radius } from '../../theme';
import { Avatar } from '../../components';
import { usersService, uploadService } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState(user?.display_name ?? user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [website, setWebsite] = useState(user?.website ?? '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [newAvatarUrl, setNewAvatarUrl] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: (data: any) => usersService.updateProfile(data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      if (setUser) setUser({
        ...user,
        display_name: displayName,
        displayName,
        bio,
        website,
        ...(newAvatarUrl ? { avatar_url: newAvatarUrl, avatarUrl: newAvatarUrl, avatar: newAvatarUrl } : {}),
      } as any);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    },
    onError: () => Alert.alert('Erro', 'Não foi possível salvar. Tente novamente.'),
  });

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à sua galeria para trocar a foto.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setAvatarPreview(asset.uri);
    setUploadingAvatar(true);

    try {
      const base64 = asset.base64;
      if (!base64) throw new Error('Base64 não disponível');
      const uploadRes = await uploadService.uploadImage(base64);
      const url = uploadRes?.url ?? uploadRes?.image_url;
      if (!url) throw new Error('URL não retornada');
      setNewAvatarUrl(url);
    } catch (e: any) {
      setAvatarPreview(null);
      Alert.alert('Erro no upload', e?.message ?? 'Não foi possível enviar a foto.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = () => {
    if (!displayName.trim()) { Alert.alert('Nome obrigatório', 'Digite um nome de exibição.'); return; }
    saveMutation.mutate({
      display_name: displayName.trim(),
      bio: bio.trim(),
      website: website.trim(),
      ...(newAvatarUrl ? { avatar_url: newAvatarUrl } : {}),
    });
  };

  const currentAvatar = avatarPreview ?? (user as any)?.avatar_url ?? (user as any)?.avatarUrl;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>EDITAR PERFIL</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saveMutation.isPending || uploadingAvatar}
          style={[styles.saveBtn, (saveMutation.isPending || uploadingAvatar) && { opacity: 0.5 }]}
        >
          <LinearGradient colors={[Colors.accent, Colors.accentDark]} style={styles.saveGradient}>
            <Text style={styles.saveText}>{saveMutation.isPending ? '...' : 'Salvar'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          {currentAvatar ? (
            <Image source={{ uri: currentAvatar }} style={styles.avatarImage} />
          ) : (
            <Avatar user={user as any} size={80} />
          )}
          <TouchableOpacity
            style={[styles.changeAvatarBtn, uploadingAvatar && { opacity: 0.5 }]}
            onPress={handlePickAvatar}
            disabled={uploadingAvatar}
          >
            <Text style={styles.changeAvatarText}>
              {uploadingAvatar ? 'Enviando...' : 'Trocar foto'}
            </Text>
          </TouchableOpacity>
          {newAvatarUrl && (
            <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.teal }}>✓ Nova foto pronta</Text>
          )}
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
  avatarImage: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: Colors.border },
  changeAvatarBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.accent },
  changeAvatarText: { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.accent },
  field: { gap: 8 },
  fieldLabel: { fontFamily: Fonts.monoBold, fontSize: 10, letterSpacing: 2, color: Colors.muted },
  fieldHint: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  charCount: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  input: { backgroundColor: Colors.surface, borderRadius: Radius.xl, paddingHorizontal: 16, paddingVertical: 12, color: Colors.text, fontFamily: Fonts.body, fontSize: 14, borderWidth: 1, borderColor: Colors.border },
  textarea: { minHeight: 100, textAlignVertical: 'top' },
});
