import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Spacing, Radius } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../../components';

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

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user, logout } = useAuthStore();

  const [notifLikes, setNotifLikes] = useState(true);
  const [notifComments, setNotifComments] = useState(true);
  const [notifFollows, setNotifFollows] = useState(true);
  const [notifReleases, setNotifReleases] = useState(false);

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
            <Text style={ss.profileName}>{user?.display_name ?? user?.username}</Text>
            <Text style={ss.profileUsername}>@{user?.username}</Text>
          </View>
          <Text style={{ color: Colors.accent, fontFamily: Fonts.mono, fontSize: 12 }}>Editar →</Text>
        </TouchableOpacity>

        <Section title="CONTA">
          <Row icon="✉️" label="Email" value={user?.email ?? '—'} onPress={() => Alert.alert('Em breve', 'Troca de email em breve.')} />
          <Row icon="🔐" label="Alterar senha" onPress={() => Alert.alert('Em breve', 'Redefinição de senha em breve.')} />
          <Row icon="📱" label="Autenticação de dois fatores" onPress={() => Alert.alert('Em breve', '2FA em breve.')} />
        </Section>

        <Section title="NOTIFICAÇÕES">
          <Row icon="♥" label="Curtidas" toggle toggleValue={notifLikes} onToggle={setNotifLikes} />
          <Row icon="💬" label="Comentários" toggle toggleValue={notifComments} onToggle={setNotifComments} />
          <Row icon="👤" label="Novos seguidores" toggle toggleValue={notifFollows} onToggle={setNotifFollows} />
          <Row icon="🎮" label="Lançamentos de jogos" toggle toggleValue={notifReleases} onToggle={setNotifReleases} />
        </Section>

        <Section title="PRIVACIDADE">
          <Row icon="🌍" label="Perfil público" value="Ativado" onPress={() => {}} />
          <Row icon="📋" label="Backlogs visíveis para" value="Todos" onPress={() => {}} />
          <Row icon="🚫" label="Usuários bloqueados" onPress={() => {}} />
        </Section>

        <Section title="SOBRE">
          <Row icon="📄" label="Termos de uso" onPress={() => {}} />
          <Row icon="🔒" label="Política de privacidade" onPress={() => {}} />
          <Row icon="ℹ️" label="Versão do app" value="1.0.0" />
        </Section>

        <Section title="SESSÃO">
          <Row icon="🚪" label="Sair da conta" onPress={handleLogout} danger />
          <Row icon="💀" label="Excluir conta" onPress={handleDeleteAccount} danger />
        </Section>
      </ScrollView>
    </View>
  );
}

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
});
