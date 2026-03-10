import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  Modal, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Colors, Fonts, Spacing, Radius, Shadows } from '../../theme';
import { Avatar } from '../../components';
import { communitiesService, uploadService } from '../../services/api';

// ─── PROMPT MODAL (substitui Alert.prompt — funciona em iOS e Android) ────────
function PromptModal({
  visible, title, subtitle, placeholder, onConfirm, onCancel, confirmLabel = 'Confirmar', confirmColor,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  placeholder?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
  confirmLabel?: string;
  confirmColor?: string;
}) {
  const [value, setValue] = useState('');
  const handleConfirm = () => { onConfirm(value.trim()); setValue(''); };
  const handleCancel = () => { onCancel(); setValue(''); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <Pressable style={promptStyles.overlay} onPress={handleCancel}>
        <Pressable style={promptStyles.sheet} onPress={() => {}}>
          <Text style={promptStyles.title}>{title}</Text>
          {subtitle ? <Text style={promptStyles.subtitle}>{subtitle}</Text> : null}
          <TextInput
            style={promptStyles.input}
            value={value}
            onChangeText={setValue}
            placeholder={placeholder ?? ''}
            placeholderTextColor={Colors.muted}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleConfirm}
          />
          <View style={promptStyles.actions}>
            <TouchableOpacity style={promptStyles.cancelBtn} onPress={handleCancel}>
              <Text style={promptStyles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[promptStyles.confirmBtn, { backgroundColor: confirmColor ?? Colors.accent }]} onPress={handleConfirm}>
              <Text style={promptStyles.confirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const promptStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet: { width: '100%', backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border },
  title: { fontFamily: Fonts.display, fontSize: 18, color: Colors.text, marginBottom: Spacing.xs },
  subtitle: { fontFamily: Fonts.body, fontSize: 13, color: Colors.muted, marginBottom: Spacing.md },
  input: { backgroundColor: Colors.surface2, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 10, color: Colors.text, fontFamily: Fonts.body, fontSize: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg },
  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  cancelText: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.muted },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: Radius.lg, alignItems: 'center' },
  confirmText: { fontFamily: Fonts.monoBold, fontSize: 14, color: '#0a0a0f' },
});

// ─── SECTION HEADER ──────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
  );
}

// ─── SETTINGS ROW ────────────────────────────────────────────────────────────
function SettingsRow({
  emoji, label, sublabel, onPress, color, showArrow = true, badge,
}: {
  emoji: string; label: string; sublabel?: string;
  onPress: () => void; color?: string; showArrow?: boolean; badge?: string;
}) {
  return (
    <TouchableOpacity style={styles.settingsRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.settingsRowIcon, { backgroundColor: (color ?? Colors.accent) + '18' }]}>
        <Text style={{ fontSize: 18 }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.settingsRowLabel, color ? { color } : {}]}>{label}</Text>
        {sublabel ? <Text style={styles.settingsRowSub}>{sublabel}</Text> : null}
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      {showArrow && <Text style={styles.settingsArrow}>›</Text>}
    </TouchableOpacity>
  );
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export default function CommunitySettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();

  const { communityId, community: routeCommunity } = route.params ?? {};

  // ── Fetch community (fresher data) ────────────────────────────────────────
  const { data: community } = useQuery({
    queryKey: ['community', communityId],
    queryFn: () => communitiesService.get(communityId),
    select: (raw: any) => raw?.community ?? raw?.data ?? raw,
    initialData: routeCommunity ?? undefined,
    enabled: !!communityId,
  });

  const myRole = community?.my_role ?? null;
  const isOwner = myRole === 'owner';
  const isAdmin = myRole === 'admin' || isOwner;

  // ── Editing state ─────────────────────────────────────────────────────────
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [descriptionEdit, setDescriptionEdit] = useState(community?.description ?? '');
  const [rulesEdit, setRulesEdit] = useState(community?.rules ?? '');

  // ── Prompt Modal state ────────────────────────────────────────────────────
  type PromptAction = 'addMod' | 'removeMember' | 'transferOwnership' | 'reportContent' | null;
  const [promptAction, setPromptAction] = useState<PromptAction>(null);
  const [pendingReportReason, setPendingReportReason] = useState<string | null>(null);

  const promptConfig: Record<Exclude<PromptAction, null>, { title: string; subtitle?: string; placeholder: string; confirmLabel?: string; confirmColor?: string }> = {
    addMod:            { title: 'Adicionar moderador',        subtitle: 'Digite o nome de usuário da pessoa:', placeholder: '@usuario', confirmLabel: 'Adicionar', confirmColor: Colors.purple },
    removeMember:      { title: 'Remover membro',             subtitle: 'Digite o nome de usuário do membro:', placeholder: '@usuario', confirmLabel: 'Remover',   confirmColor: Colors.red },
    transferOwnership: { title: 'Transferir administração',   subtitle: 'Esta ação é irreversível. Digite o nome de usuário do novo dono:', placeholder: '@usuario', confirmLabel: 'Transferir', confirmColor: Colors.amber },
    reportContent:     { title: 'ID do conteúdo',             subtitle: 'Cole o ID do comentário ou tópico a denunciar:', placeholder: 'ID do conteúdo', confirmLabel: 'Denunciar', confirmColor: Colors.amber },
  };

  // ── Cover photo ───────────────────────────────────────────────────────────
  const [newCoverUri, setNewCoverUri] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [newCoverUrl, setNewCoverUrl] = useState<string | null>(null);

  const handlePickCover = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permissão necessária', 'Permita acesso às fotos.'); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1, allowsEditing: true, aspect: [16, 9],
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setNewCoverUri(asset.uri);
    setCoverUploading(true);
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 800, height: 450 } }],
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG },
      );
      const base64 = await FileSystem.readAsStringAsync(manipulated.uri, { encoding: FileSystem.EncodingType.Base64 });
      const up = await uploadService.uploadImage(base64);
      const url = up?.url ?? up?.image_url ?? up?.cover_url ?? null;
      setNewCoverUrl(url);
    } catch (e: any) {
      Alert.alert('Erro no upload', e?.message ?? 'Não foi possível enviar a foto.');
      setNewCoverUri(null);
    } finally {
      setCoverUploading(false);
    }
  };

  // ── Save info mutation ────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (data: object) => communitiesService.update(communityId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community', communityId] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsEditingInfo(false);
      Alert.alert('Salvo!', 'As informações da comunidade foram atualizadas.');
    },
    onError: (e: any) => Alert.alert('Erro', e?.message ?? 'Não foi possível salvar.'),
  });

  const handleSaveInfo = () => {
    const payload: any = {};
    if (descriptionEdit.trim() !== community?.description) payload.description = descriptionEdit.trim();
    if (rulesEdit.trim() !== (community?.rules ?? '')) payload.rules = rulesEdit.trim();
    if (newCoverUrl) payload.cover_url = newCoverUrl;

    if (Object.keys(payload).length === 0) { setIsEditingInfo(false); return; }
    saveMutation.mutate(payload);
  };

  // ── Add moderator ─────────────────────────────────────────────────────────
  const handleAddModerator = () => setPromptAction('addMod');

  // ── Remove moderator ──────────────────────────────────────────────────────
  const handleRemoveModerator = (staffMember: any) => {
    Alert.alert(
      'Remover moderador',
      `Remover ${staffMember.display_name} (@${staffMember.username}) da moderação?`,
      [
        { text: 'Remover', style: 'destructive', onPress: async () => {
          try {
            await communitiesService.removeModerator(communityId, staffMember.id);
            queryClient.invalidateQueries({ queryKey: ['community', communityId] });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (e: any) {
            Alert.alert('Erro', e?.message ?? 'Não foi possível remover.');
          }
        }},
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  // ── Remove member ─────────────────────────────────────────────────────────
  const handleRemoveMember = () => setPromptAction('removeMember');

  // ── Transfer ownership ────────────────────────────────────────────────────
  const handleTransferOwnership = () => setPromptAction('transferOwnership');

  // ── Report content ────────────────────────────────────────────────────────
  const handleReportContent = () => {
    Alert.alert(
      'Denunciar conteúdo',
      'Selecione o motivo da denúncia:',
      [
        { text: 'Spam ou publicidade',   onPress: () => { setPendingReportReason('spam');          setPromptAction('reportContent'); } },
        { text: 'Conteúdo inapropriado', onPress: () => { setPendingReportReason('inappropriate'); setPromptAction('reportContent'); } },
        { text: 'Assédio ou abuso',      onPress: () => { setPendingReportReason('harassment');    setPromptAction('reportContent'); } },
        { text: 'Desinformação',         onPress: () => { setPendingReportReason('misinformation'); setPromptAction('reportContent'); } },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  // ── PromptModal confirm handler ───────────────────────────────────────────
  const handlePromptConfirm = async (value: string) => {
    const action = promptAction;
    setPromptAction(null);
    if (!value) return;
    try {
      if (action === 'addMod') {
        await communitiesService.addModerator(communityId, value);
        queryClient.invalidateQueries({ queryKey: ['community', communityId] });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Moderador adicionado!', `@${value} agora é moderador.`);
      } else if (action === 'removeMember') {
        Alert.alert('Confirmar remoção', `Remover @${value} da comunidade?`, [
          { text: 'Remover', style: 'destructive', onPress: async () => {
            await communitiesService.removeMember(communityId, value);
            queryClient.invalidateQueries({ queryKey: ['community-members', communityId] });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Membro removido.');
          }},
          { text: 'Cancelar', style: 'cancel' },
        ]);
      } else if (action === 'transferOwnership') {
        Alert.alert('⚠️ Atenção', `Você perderá a administração e @${value} se tornará o novo dono. Tem certeza?`, [
          { text: 'Transferir', style: 'destructive', onPress: async () => {
            await communitiesService.transferOwnership(communityId, value);
            queryClient.invalidateQueries({ queryKey: ['community', communityId] });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Transferência concluída.', '', [{ text: 'OK', onPress: () => navigation.goBack() }]);
          }},
          { text: 'Cancelar', style: 'cancel' },
        ]);
      } else if (action === 'reportContent' && pendingReportReason) {
        await communitiesService.reportContent(communityId, 'post', value, pendingReportReason);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Denúncia enviada.', 'Vamos analisar em breve.');
        setPendingReportReason(null);
      }
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível concluir a ação.');
    }
  };

    // ── Delete community ──────────────────────────────────────────────────────
  const handleDeleteCommunity = () => {
    Alert.alert(
      '🗑️ Deletar comunidade',
      `Tem certeza que deseja deletar "${community?.name}"? Esta ação é IRREVERSÍVEL e todos os tópicos serão perdidos.`,
      [
        { text: 'Deletar permanentemente', style: 'destructive', onPress: async () => {
          try {
            await communitiesService.delete(communityId);
            queryClient.invalidateQueries({ queryKey: ['communities'] });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            navigation.navigate('Communities');
          } catch (e: any) {
            Alert.alert('Erro', e?.message ?? 'Não foi possível deletar a comunidade.');
          }
        }},
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const staff = community?.staff ?? [];
  const mods = staff.filter((s: any) => s.role === 'mod' || s.role === 'admin');

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ color: Colors.text, fontSize: 18 }}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CONFIGURAÇÕES</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>

        {/* Community identity */}
        <View style={styles.communityCard}>
          <View style={styles.communityCardCover}>
            {(newCoverUri ?? community?.cover_url) ? (
              <Image source={{ uri: newCoverUri ?? community.cover_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <LinearGradient colors={['#1a1628', Colors.purple + '80']} style={StyleSheet.absoluteFill} />
            )}
            {coverUploading && (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }]}>
                <ActivityIndicator color={Colors.accent} />
              </View>
            )}
          </View>
          <View style={styles.communityCardInfo}>
            <Text style={styles.communityCardName}>{community?.name}</Text>
            <Text style={styles.communityCardRole}>
              {staff.find((s: any) => s.role === myRole)?.display_name ?? 'Você'} • {myRole === 'owner' ? '👑 Dono' : myRole === 'admin' ? '⚡ Admin' : '🛡️ Mod'}
            </Text>
          </View>
        </View>

        {/* Appearance */}
        <SectionHeader title="APARÊNCIA" subtitle="Foto e informações da comunidade" />
        <View style={styles.card}>
          <SettingsRow
            emoji="🖼️"
            label="Alterar foto de capa"
            sublabel={newCoverUrl ? '✓ Nova foto pronta para salvar' : coverUploading ? 'Enviando...' : 'JPG ou PNG, proporção 16:9'}
            onPress={handlePickCover}
          />
          <View style={styles.cardDivider} />
          <SettingsRow
            emoji="✏️"
            label="Editar descrição e regras"
            sublabel="Alterar o texto que aparece na página da comunidade"
            onPress={() => {
              setDescriptionEdit(community?.description ?? '');
              setRulesEdit(community?.rules ?? '');
              setIsEditingInfo(true);
            }}
          />
        </View>

        {/* Edit info inline */}
        {isEditingInfo && (
          <View style={styles.editCard}>
            <Text style={styles.editLabel}>DESCRIÇÃO</Text>
            <TextInput
              style={styles.editInput}
              value={descriptionEdit}
              onChangeText={setDescriptionEdit}
              multiline
              maxLength={500}
              placeholder="Descrição da comunidade..."
              placeholderTextColor={Colors.muted}
              textAlignVertical="top"
            />
            <Text style={[styles.editLabel, { marginTop: Spacing.lg }]}>REGRAS</Text>
            <TextInput
              style={styles.editInput}
              value={rulesEdit}
              onChangeText={setRulesEdit}
              multiline
              maxLength={1000}
              placeholder="Regras da comunidade (opcional)..."
              placeholderTextColor={Colors.muted}
              textAlignVertical="top"
            />
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.editCancelBtn}
                onPress={() => { setIsEditingInfo(false); setNewCoverUri(null); setNewCoverUrl(null); }}
              >
                <Text style={styles.editCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editSaveBtn, saveMutation.isPending && { opacity: 0.6 }]}
                onPress={handleSaveInfo}
                disabled={saveMutation.isPending}
              >
                <LinearGradient colors={[Colors.accent, Colors.accentDark]} style={styles.editSaveGradient}>
                  <Text style={styles.editSaveText}>{saveMutation.isPending ? 'Salvando...' : 'Salvar'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Moderation */}
        <SectionHeader title="MODERAÇÃO" subtitle="Gerenciar membros e conteúdo" />
        <View style={styles.card}>
          <SettingsRow
            emoji="👥"
            label="Gerenciar membros"
            sublabel={`${community?.members_count ?? 0} membros`}
            onPress={() => navigation.navigate('Community', { communityId, community })}
          />
          <View style={styles.cardDivider} />
          <SettingsRow
            emoji="🚨"
            label="Denunciar comentário ou tópico"
            sublabel="Reportar conteúdo que viola as regras"
            onPress={handleReportContent}
            color={Colors.amber}
          />
          <View style={styles.cardDivider} />
          <SettingsRow
            emoji="🚫"
            label="Remover membro"
            sublabel="Expulsar um membro da comunidade"
            onPress={handleRemoveMember}
            color={Colors.red}
          />
        </View>

        {/* Staff management */}
        {isAdmin && (
          <>
            <SectionHeader title="EQUIPE DE MODERAÇÃO" subtitle="Adicionar ou remover moderadores" />
            <View style={styles.card}>
              <SettingsRow
                emoji="🛡️"
                label="Adicionar moderador"
                sublabel="Dar permissões de moderação a um membro"
                onPress={handleAddModerator}
                color={Colors.purple}
              />

              {mods.length > 0 && (
                <>
                  <View style={styles.cardDivider} />
                  <View style={styles.modsListHeader}>
                    <Text style={styles.modsListTitle}>MODERADORES ATUAIS</Text>
                  </View>
                  {mods.map((m: any, i: number) => (
                    <React.Fragment key={m.id ?? i}>
                      {i > 0 && <View style={styles.cardDivider} />}
                      <View style={styles.modMemberRow}>
                        <Avatar user={{ id: m.id, username: m.username, displayName: m.display_name } as any} size={36} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.modMemberName}>{m.display_name}</Text>
                          <Text style={styles.modMemberUsername}>@{m.username}</Text>
                        </View>
                        <View style={[styles.rolePill, { borderColor: m.role === 'admin' ? Colors.amber + '60' : Colors.purple + '60', backgroundColor: m.role === 'admin' ? Colors.amber + '15' : Colors.purple + '15' }]}>
                          <Text style={[styles.rolePillText, { color: m.role === 'admin' ? Colors.amber : Colors.purple }]}>
                            {m.role === 'admin' ? '⚡ Admin' : '🛡️ Mod'}
                          </Text>
                        </View>
                        {m.role !== 'owner' && (
                          <TouchableOpacity
                            style={styles.removeModBtn}
                            onPress={() => handleRemoveModerator(m)}
                          >
                            <Text style={{ color: Colors.red, fontSize: 14 }}>✕</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </React.Fragment>
                  ))}
                </>
              )}
            </View>
          </>
        )}

        {/* Owner zone */}
        {isOwner && (
          <>
            <SectionHeader title="ADMINISTRAÇÃO" subtitle="Ações exclusivas do dono" />
            <View style={styles.card}>
              <SettingsRow
                emoji="🔄"
                label="Transferir administração"
                sublabel="Passar o controle total da comunidade para outro membro"
                onPress={handleTransferOwnership}
                color={Colors.amber}
              />
            </View>

            <SectionHeader title="ZONA DE PERIGO" />
            <View style={[styles.card, styles.dangerCard]}>
              <SettingsRow
                emoji="🗑️"
                label="Deletar comunidade"
                sublabel="Esta ação é permanente e irreversível"
                onPress={handleDeleteCommunity}
                color={Colors.red}
              />
            </View>
          </>
        )}

      </ScrollView>

      {/* PromptModal — cross-platform, substitui Alert.prompt */}
      {promptAction && promptAction in promptConfig && (
        <PromptModal
          visible
          title={promptConfig[promptAction].title}
          subtitle={promptConfig[promptAction].subtitle}
          placeholder={promptConfig[promptAction].placeholder}
          confirmLabel={promptConfig[promptAction].confirmLabel}
          confirmColor={promptConfig[promptAction].confirmColor}
          onConfirm={handlePromptConfirm}
          onCancel={() => { setPromptAction(null); setPendingReportReason(null); }}
        />
      )}
    </KeyboardAvoidingView>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.display, fontSize: 16, letterSpacing: 2, color: Colors.text },

  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.sm },

  // Community identity card
  communityCard: {
    borderRadius: Radius.xl, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm,
    ...Shadows.card,
  },
  communityCardCover: { height: 80, position: 'relative' },
  communityCardInfo: { backgroundColor: Colors.surface, padding: Spacing.md },
  communityCardName: { fontFamily: Fonts.display, fontSize: 20, letterSpacing: 1, color: Colors.text },
  communityCardRole: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted, marginTop: 2 },

  // Section header
  sectionHeader: { paddingTop: Spacing.md, paddingBottom: Spacing.xs },
  sectionTitle: { fontFamily: Fonts.monoBold, fontSize: 10, letterSpacing: 2, color: Colors.muted },
  sectionSubtitle: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, marginTop: 2, opacity: 0.7 },

  // Card
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
    ...Shadows.card,
  },
  dangerCard: { borderColor: Colors.red + '40', backgroundColor: Colors.red + '08' },
  cardDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.lg },

  // Settings row
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.lg },
  settingsRowIcon: { width: 38, height: 38, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  settingsRowLabel: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text },
  settingsRowSub: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, marginTop: 2 },
  settingsArrow: { fontFamily: Fonts.bodyBold, fontSize: 20, color: Colors.muted },

  badge: { backgroundColor: Colors.red, borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2, marginRight: 4 },
  badgeText: { fontFamily: Fonts.monoBold, fontSize: 10, color: '#fff' },

  // Edit info inline
  editCard: {
    backgroundColor: Colors.surface2, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.accent + '30', padding: Spacing.lg, gap: Spacing.sm,
  },
  editLabel: { fontFamily: Fonts.monoBold, fontSize: 10, letterSpacing: 2, color: Colors.muted },
  editInput: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    paddingHorizontal: 14, paddingVertical: 10,
    color: Colors.text, fontFamily: Fonts.body, fontSize: 14,
    borderWidth: 1, borderColor: Colors.border,
    minHeight: 80, textAlignVertical: 'top',
  },
  editActions: { flexDirection: 'row', gap: 10, marginTop: Spacing.sm },
  editCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  editCancelText: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.muted },
  editSaveBtn: { flex: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  editSaveGradient: { paddingVertical: 12, alignItems: 'center' },
  editSaveText: { fontFamily: Fonts.monoBold, fontSize: 14, color: '#0a0a0f' },

  // Mods list
  modsListHeader: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xs },
  modsListTitle: { fontFamily: Fonts.monoBold, fontSize: 9, letterSpacing: 2, color: Colors.muted },
  modMemberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.lg, paddingVertical: 12 },
  modMemberName: { fontFamily: Fonts.bodyBold, fontSize: 13, color: Colors.text },
  modMemberUsername: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  rolePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1 },
  rolePillText: { fontFamily: Fonts.monoBold, fontSize: 10 },
  removeModBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
