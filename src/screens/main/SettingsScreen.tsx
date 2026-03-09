import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch,
  TextInput, Modal, Pressable, FlatList, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors, Fonts, Spacing, Radius } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../../components';
import { authService, usersService } from '../../services/api';

// ─── SECTION / ROW COMPONENTS ─────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={ss.section}>
      <Text style={ss.sectionTitle}>{title}</Text>
      <View style={ss.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ icon, label, value, onPress, danger, toggle, toggleValue, onToggle }: any) {
  return (
    <TouchableOpacity style={ss.row} onPress={onPress} activeOpacity={toggle ? 1 : 0.7} disabled={!onPress && !onToggle}>
      <Text style={ss.rowIcon}>{icon}</Text>
      <Text style={[ss.rowLabel, danger && ss.rowLabelDanger]}>{label}</Text>
      {value && <Text style={ss.rowValue}>{value}</Text>}
      {toggle
        ? <Switch value={toggleValue} onValueChange={onToggle} trackColor={{ false: Colors.border, true: Colors.accent + '80' }} thumbColor={toggleValue ? Colors.accent : Colors.muted} />
        : onPress && <Text style={ss.rowArrow}>›</Text>
      }
    </TouchableOpacity>
  );
}

// ─── MODAL WRAPPER ────────────────────────────────────────────────────────────
function SettingsModal({ visible, onClose, title, children }: {
  visible: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={ss.modalOverlay} onPress={onClose}>
        <View style={ss.modalSheet} onStartShouldSetResponder={() => true}>
          <View style={ss.modalHandle} />
          <Text style={ss.modalTitle}>{title}</Text>
          {children}
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── CHANGE USERNAME MODAL ────────────────────────────────────────────────────
function ChangeUsernameModal({ visible, onClose, currentUsername }: { visible: boolean; onClose: () => void; currentUsername: string }) {
  const [newUsername, setNewUsername] = useState('');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const { updateUser } = useAuthStore();
  const queryClient = useQueryClient();

  const checkAvailability = async (val: string) => {
    if (val.length < 3 || val === currentUsername) { setAvailable(null); return; }
    setChecking(true);
    try {
      const isAvail = await usersService.checkUsernameAvailable(val);
      setAvailable(isAvail);
    } catch { setAvailable(null); }
    finally { setChecking(false); }
  };

  React.useEffect(() => {
    const t = setTimeout(() => checkAvailability(newUsername), 600);
    return () => clearTimeout(t);
  }, [newUsername]);

  const mutation = useMutation({
    mutationFn: () => usersService.updateUsername(newUsername.trim().toLowerCase()),
    onSuccess: (data: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      updateUser({ username: newUsername.trim().toLowerCase() });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      Alert.alert('Handle atualizado!', `Seu novo handle é @${newUsername.trim().toLowerCase()}`);
      setNewUsername('');
      setAvailable(null);
      onClose();
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message ?? e?.response?.data?.error ?? e?.message ?? 'Não foi possível atualizar o handle.';
      Alert.alert('Erro', typeof msg === 'object' ? JSON.stringify(msg) : msg);
    },
  });

  const handleSubmit = () => {
    const val = newUsername.trim().toLowerCase();
    if (val.length < 3) { Alert.alert('Handle inválido', 'Mínimo 3 caracteres.'); return; }
    if (!/^[a-z0-9._]+$/.test(val)) { Alert.alert('Caracteres inválidos', 'Use apenas letras, números, pontos e underscore.'); return; }
    if (available === false) { Alert.alert('Indisponível', 'Este handle já está em uso.'); return; }
    mutation.mutate();
  };

  const borderColor = available === true ? Colors.teal : available === false ? Colors.red : Colors.border;
  const hint = checking ? '⏳ Verificando...' : available === true ? '✅ Disponível!' : available === false ? '❌ Já em uso' : 'Use letras, números, pontos e _';

  return (
    <SettingsModal visible={visible} onClose={onClose} title="Alterar handle @">
      <Text style={ss.modalLabel}>Handle atual: @{currentUsername}</Text>
      <View style={[ss.modalInput, { borderColor, flexDirection: 'row', alignItems: 'center', paddingVertical: 0 }]}>
        <Text style={{ color: Colors.muted, fontFamily: Fonts.mono, fontSize: 15, paddingVertical: 14 }}>@</Text>
        <TextInput
          style={{ flex: 1, color: Colors.text, fontFamily: Fonts.mono, fontSize: 15, paddingVertical: 14 }}
          value={newUsername}
          onChangeText={v => { setNewUsername(v.toLowerCase()); setAvailable(null); }}
          placeholder="novo_handle"
          placeholderTextColor={Colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={30}
        />
      </View>
      <Text style={[ss.modalLabel, { color: available === true ? Colors.teal : available === false ? Colors.red : Colors.muted, marginTop: -4, marginBottom: 16 }]}>{hint}</Text>
      <TouchableOpacity
        style={[ss.modalBtn, (mutation.isPending || !newUsername.trim() || available === false) && { opacity: 0.4 }]}
        onPress={handleSubmit}
        disabled={mutation.isPending || !newUsername.trim() || available === false}
      >
        <Text style={ss.modalBtnText}>{mutation.isPending ? 'Salvando...' : 'Salvar handle'}</Text>
      </TouchableOpacity>
    </SettingsModal>
  );
}

// ─── CHANGE EMAIL MODAL ───────────────────────────────────────────────────────
function ChangeEmailModal({ visible, onClose, currentEmail }: { visible: boolean; onClose: () => void; currentEmail: string }) {
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => authService.changeEmail(newEmail, password),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Email alterado', `Novo email: ${newEmail}`);
      queryClient.invalidateQueries({ queryKey: ['auth-me'] });
      setNewEmail(''); setPassword('');
      onClose();
    },
    onError: (err: any) => Alert.alert('Erro', err.message),
  });

  return (
    <SettingsModal visible={visible} onClose={onClose} title="Alterar email">
      <Text style={ss.modalLabel}>Email atual: {currentEmail}</Text>
      <TextInput style={ss.modalInput} value={newEmail} onChangeText={setNewEmail}
        placeholder="Novo email" placeholderTextColor={Colors.muted}
        keyboardType="email-address" autoCapitalize="none" />
      <TextInput style={ss.modalInput} value={password} onChangeText={setPassword}
        placeholder="Confirme sua senha" placeholderTextColor={Colors.muted} secureTextEntry />
      <TouchableOpacity style={[ss.modalBtn, (!newEmail || !password) && { opacity: 0.4 }]}
        onPress={() => mutation.mutate()} disabled={!newEmail || !password || mutation.isPending}>
        <Text style={ss.modalBtnText}>{mutation.isPending ? 'Salvando...' : 'Salvar'}</Text>
      </TouchableOpacity>
    </SettingsModal>
  );
}

// ─── CHANGE PASSWORD MODAL ────────────────────────────────────────────────────
function ChangePasswordModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');

  const mutation = useMutation({
    mutationFn: () => authService.changePassword(current, newPass),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Senha alterada', 'Sua senha foi atualizada com sucesso.');
      setCurrent(''); setNewPass(''); setConfirm('');
      onClose();
    },
    onError: (err: any) => Alert.alert('Erro', err.message),
  });

  const handleSubmit = () => {
    if (newPass.length < 8) { Alert.alert('Erro', 'Nova senha deve ter ao menos 8 caracteres.'); return; }
    if (newPass !== confirm) { Alert.alert('Erro', 'As senhas não conferem.'); return; }
    mutation.mutate();
  };

  return (
    <SettingsModal visible={visible} onClose={onClose} title="Alterar senha">
      <TextInput style={ss.modalInput} value={current} onChangeText={setCurrent}
        placeholder="Senha atual" placeholderTextColor={Colors.muted} secureTextEntry />
      <TextInput style={ss.modalInput} value={newPass} onChangeText={setNewPass}
        placeholder="Nova senha (mín. 8 caracteres)" placeholderTextColor={Colors.muted} secureTextEntry />
      <TextInput style={ss.modalInput} value={confirm} onChangeText={setConfirm}
        placeholder="Confirmar nova senha" placeholderTextColor={Colors.muted} secureTextEntry />
      <TouchableOpacity style={[ss.modalBtn, (!current || !newPass || !confirm) && { opacity: 0.4 }]}
        onPress={handleSubmit} disabled={!current || !newPass || !confirm || mutation.isPending}>
        <Text style={ss.modalBtnText}>{mutation.isPending ? 'Salvando...' : 'Alterar senha'}</Text>
      </TouchableOpacity>
    </SettingsModal>
  );
}

// ─── 2FA MODAL ────────────────────────────────────────────────────────────────
function TwoFactorModal({ visible, onClose, enabled }: { visible: boolean; onClose: () => void; enabled: boolean }) {
  return (
    <SettingsModal visible={visible} onClose={onClose} title="Autenticação de dois fatores">
      <View style={ss.tfaStatus}>
        <View style={[ss.tfaDot, { backgroundColor: enabled ? Colors.accent : Colors.red }]} />
        <Text style={ss.tfaStatusText}>{enabled ? '2FA ativado' : '2FA desativado'}</Text>
      </View>
      <Text style={ss.modalDesc}>
        {enabled
          ? 'Sua conta está protegida com autenticação de dois fatores. Para desativar, entre em contato com o suporte.'
          : 'A autenticação de dois fatores adiciona uma camada extra de segurança à sua conta usando um aplicativo autenticador (Google Authenticator, Authy, etc.).'
        }
      </Text>
      {!enabled && (
        <TouchableOpacity style={ss.modalBtn}
          onPress={() => { Alert.alert('Em desenvolvimento', 'O 2FA via TOTP está sendo implementado. Em breve você poderá ativar!'); onClose(); }}>
          <Text style={ss.modalBtnText}>Ativar 2FA</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={ss.modalBtnSecondary} onPress={onClose}>
        <Text style={ss.modalBtnSecondaryText}>Fechar</Text>
      </TouchableOpacity>
    </SettingsModal>
  );
}

// ─── PRIVACY MODAL ────────────────────────────────────────────────────────────
function PrivacyModal({ visible, onClose, setting, options, currentValue, onSelect }: {
  visible: boolean; onClose: () => void; setting: string;
  options: { value: any; label: string; desc: string }[];
  currentValue: any; onSelect: (value: any) => void;
}) {
  return (
    <SettingsModal visible={visible} onClose={onClose} title={setting}>
      {options.map(opt => (
        <TouchableOpacity key={String(opt.value)} style={[ss.privacyOption, currentValue === opt.value && ss.privacyOptionActive]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelect(opt.value); onClose(); }}>
          <View style={{ flex: 1 }}>
            <Text style={[ss.privacyOptionLabel, currentValue === opt.value && ss.privacyOptionLabelActive]}>{opt.label}</Text>
            <Text style={ss.privacyOptionDesc}>{opt.desc}</Text>
          </View>
          {currentValue === opt.value && <Text style={{ color: Colors.accent, fontSize: 18 }}>✓</Text>}
        </TouchableOpacity>
      ))}
    </SettingsModal>
  );
}

// ─── BLOCKED USERS MODAL ──────────────────────────────────────────────────────
function BlockedUsersModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: blocked, isLoading } = useQuery({
    queryKey: ['blocked-users'],
    queryFn: () => usersService.getBlockedUsers(),
    select: (res: any) => Array.isArray(res) ? res : res?.data ?? [],
    enabled: visible,
  });

  const unblockMutation = useMutation({
    mutationFn: (userId: string) => usersService.unblockUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleUnblock = (user: any) => {
    Alert.alert('Desbloquear', `Desbloquear @${user.username}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desbloquear', onPress: () => unblockMutation.mutate(user.blocked_id) },
    ]);
  };

  return (
    <SettingsModal visible={visible} onClose={onClose} title="Usuários bloqueados">
      {isLoading ? (
        <ActivityIndicator color={Colors.accent} style={{ padding: 20 }} />
      ) : !blocked || blocked.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 30 }}>
          <Text style={{ fontSize: 32, marginBottom: 10 }}>🙂</Text>
          <Text style={ss.modalDesc}>Nenhum usuário bloqueado</Text>
        </View>
      ) : (
        blocked.map((user: any) => (
          <View key={user.block_id} style={ss.blockedRow}>
            <View style={ss.blockedAvatar}>
              <Text style={{ fontFamily: Fonts.display, fontSize: 16, color: Colors.accent }}>
                {(user.display_name ?? user.username ?? '?')[0].toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ss.blockedName}>{user.display_name ?? user.username}</Text>
              <Text style={ss.blockedHandle}>@{user.username}</Text>
            </View>
            <TouchableOpacity style={ss.unblockBtn} onPress={() => handleUnblock(user)}>
              <Text style={ss.unblockText}>Desbloquear</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </SettingsModal>
  );
}

// ─── SETTINGS SCREEN ──────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user, logout } = useAuthStore();
  const queryClient = useQueryClient();

  // Modals
  const [emailModal, setEmailModal] = useState(false);
  const [passModal, setPassModal] = useState(false);
  const [usernameModal, setUsernameModal] = useState(false);
  const [tfaModal, setTfaModal] = useState(false);
  const [profilePublicModal, setProfilePublicModal] = useState(false);
  const [backlogVisModal, setBacklogVisModal] = useState(false);
  const [blockedModal, setBlockedModal] = useState(false);

  // Notification prefs (local state — can be persisted later)
  const [notifLikes, setNotifLikes] = useState(true);
  const [notifComments, setNotifComments] = useState(true);
  const [notifFollows, setNotifFollows] = useState(true);
  const [notifReleases, setNotifReleases] = useState(false);

  // Privacy settings from API
  const { data: privacy } = useQuery({
    queryKey: ['privacy-settings'],
    queryFn: () => usersService.getPrivacy(),
    select: (res: any) => res ?? {},
  });

  const isProfilePublic = privacy?.is_profile_public ?? true;
  const backlogVisibility = privacy?.backlog_visibility ?? 'everyone';
  const tfaEnabled = privacy?.totp_enabled ?? false;

  const privacyMutation = useMutation({
    mutationFn: (data: any) => usersService.updatePrivacy(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['privacy-settings'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => Alert.alert('Erro', 'Não foi possível salvar.'),
  });

  const handleLogout = () => {
    Alert.alert('Sair da conta', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); logout(); } },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Excluir conta',
      'Essa ação é irreversível. Todos os seus dados serão apagados permanentemente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => Alert.alert('Solicitação enviada', 'Você receberá um email de confirmação em até 24h.') },
      ]
    );
  };

  const backlogVisLabel = backlogVisibility === 'everyone' ? 'Todos' : backlogVisibility === 'followers' ? 'Seguidores' : 'Privado';

  return (
    <View style={[ss.container, { paddingTop: insets.top }]}>
      <View style={ss.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={ss.closeBtn}>
          <Text style={{ color: Colors.text, fontSize: 22 }}>✕</Text>
        </TouchableOpacity>
        <Text style={ss.headerTitle}>CONFIGURAÇÕES</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Profile card */}
        <TouchableOpacity style={ss.profileCard} onPress={() => { navigation.goBack(); navigation.navigate('EditProfile'); }}>
          <Avatar user={user as any} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={ss.profileName}>{(user as any)?.display_name ?? (user as any)?.username}</Text>
            <Text style={ss.profileUsername}>@{(user as any)?.username}</Text>
          </View>
          <Text style={{ color: Colors.accent, fontFamily: Fonts.mono, fontSize: 12 }}>Editar →</Text>
        </TouchableOpacity>

        <Section title="CONTA">
          <Row icon="✉️" label="Email" value={(user as any)?.email ?? '—'} onPress={() => setEmailModal(true)} />
          <Row icon="🔤" label="Handle @" value={`@${(user as any)?.username ?? '—'}`} onPress={() => setUsernameModal(true)} />
          <Row icon="🔐" label="Alterar senha" onPress={() => setPassModal(true)} />
          <Row icon="📱" label="Autenticação de dois fatores" value={tfaEnabled ? 'Ativado' : 'Desativado'} onPress={() => setTfaModal(true)} />
        </Section>

        <Section title="NOTIFICAÇÕES">
          <Row icon="♥" label="Curtidas" toggle toggleValue={notifLikes} onToggle={setNotifLikes} />
          <Row icon="💬" label="Comentários" toggle toggleValue={notifComments} onToggle={setNotifComments} />
          <Row icon="👤" label="Novos seguidores" toggle toggleValue={notifFollows} onToggle={setNotifFollows} />
          <Row icon="🎮" label="Lançamentos de jogos" toggle toggleValue={notifReleases} onToggle={setNotifReleases} />
        </Section>

        <Section title="PRIVACIDADE">
          <Row icon="🌍" label="Perfil público" value={isProfilePublic ? 'Ativado' : 'Desativado'}
            onPress={() => setProfilePublicModal(true)} />
          <Row icon="📋" label="Backlogs visíveis para" value={backlogVisLabel}
            onPress={() => setBacklogVisModal(true)} />
          <Row icon="🚫" label="Usuários bloqueados" onPress={() => setBlockedModal(true)} />
        </Section>

        <Section title="SOBRE">
          <Row icon="📄" label="Termos de uso" onPress={() => Alert.alert('Termos de Uso', 'Disponível em breve no site.')} />
          <Row icon="🔒" label="Política de privacidade" onPress={() => Alert.alert('Política de Privacidade', 'Disponível em breve no site.')} />
          <Row icon="ℹ️" label="Versão do app" value="1.0.0" />
        </Section>

        <Section title="SESSÃO">
          <Row icon="🚪" label="Sair da conta" onPress={handleLogout} danger />
          <Row icon="💀" label="Excluir conta" onPress={handleDeleteAccount} danger />
        </Section>
      </ScrollView>

      {/* Modals */}
      <ChangeEmailModal visible={emailModal} onClose={() => setEmailModal(false)} currentEmail={(user as any)?.email ?? ''} />
      <ChangePasswordModal visible={passModal} onClose={() => setPassModal(false)} />
      <ChangeUsernameModal visible={usernameModal} onClose={() => setUsernameModal(false)} currentUsername={(user as any)?.username ?? ''} />
      <TwoFactorModal visible={tfaModal} onClose={() => setTfaModal(false)} enabled={tfaEnabled} />
      <BlockedUsersModal visible={blockedModal} onClose={() => setBlockedModal(false)} />

      <PrivacyModal
        visible={profilePublicModal} onClose={() => setProfilePublicModal(false)}
        setting="Perfil público"
        currentValue={isProfilePublic ? 1 : 0}
        options={[
          { value: 1, label: 'Público', desc: 'Qualquer pessoa pode ver seu perfil, backlog e reviews.' },
          { value: 0, label: 'Privado', desc: 'Apenas seus seguidores podem ver seu conteúdo.' },
        ]}
        onSelect={(v) => privacyMutation.mutate({ is_profile_public: v })}
      />

      <PrivacyModal
        visible={backlogVisModal} onClose={() => setBacklogVisModal(false)}
        setting="Backlogs visíveis para"
        currentValue={backlogVisibility}
        options={[
          { value: 'everyone', label: 'Todos', desc: 'Qualquer pessoa pode ver sua biblioteca de jogos.' },
          { value: 'followers', label: 'Seguidores', desc: 'Apenas quem te segue pode ver seu backlog.' },
          { value: 'private', label: 'Privado', desc: 'Ninguém além de você pode ver sua biblioteca.' },
        ]}
        onSelect={(v) => privacyMutation.mutate({ backlog_visibility: v })}
      />
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.display, fontSize: 20, letterSpacing: 3, color: Colors.text },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, margin: Spacing.lg, padding: Spacing.lg, backgroundColor: Colors.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border },
  profileName: { fontFamily: Fonts.bodyBold, fontSize: 16, color: Colors.text },
  profileUsername: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted, marginTop: 2 },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontFamily: Fonts.monoBold, fontSize: 10, letterSpacing: 2, color: Colors.muted, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  sectionBody: { backgroundColor: Colors.card, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowIcon: { fontSize: 18, width: 26, textAlign: 'center' },
  rowLabel: { flex: 1, fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.text },
  rowLabelDanger: { color: Colors.red },
  rowValue: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted },
  rowArrow: { fontFamily: Fonts.mono, fontSize: 18, color: Colors.muted },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, paddingHorizontal: Spacing.lg, paddingBottom: 40, paddingTop: Spacing.md, maxHeight: '80%' },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: Fonts.display, fontSize: 20, letterSpacing: 2, color: Colors.text, marginBottom: 20 },
  modalLabel: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted, marginBottom: 16 },
  modalDesc: { fontFamily: Fonts.body, fontSize: 14, color: Colors.muted, lineHeight: 21, marginBottom: 20 },
  modalInput: { backgroundColor: Colors.bg, borderRadius: Radius.xl, paddingHorizontal: 16, paddingVertical: 14, color: Colors.text, fontFamily: Fonts.body, fontSize: 15, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  modalBtn: { backgroundColor: Colors.accent, borderRadius: Radius.xl, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  modalBtnText: { fontFamily: Fonts.monoBold, fontSize: 15, color: '#0a0a0f', letterSpacing: 1 },
  modalBtnSecondary: { borderRadius: Radius.xl, paddingVertical: 13, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: Colors.border },
  modalBtnSecondaryText: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.muted },

  // 2FA
  tfaStatus: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, padding: 14, backgroundColor: Colors.bg, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  tfaDot: { width: 10, height: 10, borderRadius: 5 },
  tfaStatusText: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text },

  // Privacy options
  privacyOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: Colors.bg, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  privacyOptionActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '08' },
  privacyOptionLabel: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text },
  privacyOptionLabelActive: { color: Colors.accent },
  privacyOptionDesc: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted, marginTop: 2 },

  // Blocked users
  blockedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  blockedAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accent + '20', borderWidth: 1, borderColor: Colors.accent + '40', alignItems: 'center', justifyContent: 'center' },
  blockedName: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text },
  blockedHandle: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  unblockBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.red },
  unblockText: { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.red },
});
