// ============================================================
//  BACKLOG NETWORK — NotificationsScreen
// ============================================================
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

import { Colors, Fonts, Spacing, Radius } from '../../theme';
import { Avatar, EmptyState } from '../../components';

type NotifType = 'like_post' | 'like_review' | 'comment' | 'follow' | 'new_scrap' | 'new_fan' | 'community_approved' | 'achievement' | 'game_release';

interface Notif {
  id: string; type: NotifType; is_read: boolean; created_at: string;
  message: string; actor_username?: string; actor_avatar?: string; actor_id?: string;
}

const TYPE_CONFIG: Record<NotifType, { emoji: string; color: string }> = {
  like_post:         { emoji: '♥', color: Colors.red },
  like_review:       { emoji: '♥', color: Colors.red },
  comment:           { emoji: '💬', color: Colors.purple },
  follow:            { emoji: '👤', color: Colors.accent },
  new_scrap:         { emoji: '📬', color: Colors.teal },
  new_fan:           { emoji: '⭐', color: Colors.amber },
  community_approved:{ emoji: '✅', color: Colors.accent },
  achievement:       { emoji: '🏆', color: Colors.amber },
  game_release:      { emoji: '🎮', color: Colors.purple },
};

const MOCK_NOTIFS: Notif[] = [
  { id: 'n1', type: 'new_fan',           is_read: false, created_at: new Date(Date.now() - 600000).toISOString(),    message: 'mari_rpg agora é seu fã!', actor_username: 'mari_rpg', actor_id: 'u1' },
  { id: 'n2', type: 'like_review',       is_read: false, created_at: new Date(Date.now() - 3600000).toISOString(),   message: 'luca.dev curtiu sua review de Hollow Knight', actor_username: 'luca.dev', actor_id: 'u2' },
  { id: 'n3', type: 'comment',           is_read: false, created_at: new Date(Date.now() - 7200000).toISOString(),   message: 'rodrigao comentou no seu post', actor_username: 'rodrigao', actor_id: 'u3' },
  { id: 'n4', type: 'follow',            is_read: true,  created_at: new Date(Date.now() - 86400000).toISOString(),  message: 'kae_plays começou a te seguir', actor_username: 'kae_plays', actor_id: 'u4' },
  { id: 'n5', type: 'community_approved',is_read: true,  created_at: new Date(Date.now() - 172800000).toISOString(), message: 'Você foi aprovado na comunidade Roguelikes Anônimos' },
  { id: 'n6', type: 'achievement',       is_read: true,  created_at: new Date(Date.now() - 259200000).toISOString(), message: 'Conquista desbloqueada: Crítico Estreante ✍️' },
  { id: 'n7', type: 'new_scrap',         is_read: true,  created_at: new Date(Date.now() - 345600000).toISOString(), message: 'mari_rpg deixou um recado no seu perfil', actor_username: 'mari_rpg', actor_id: 'u1' },
  { id: 'n8', type: 'like_post',         is_read: true,  created_at: new Date(Date.now() - 432000000).toISOString(), message: 'rodrigao e mais 14 curtiram seu post', actor_username: 'rodrigao', actor_id: 'u3' },
];

function timeAgo(d: string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60)    return 'agora';
  if (s < 3600)  return `${Math.floor(s/60)}min`;
  if (s < 86400) return `${Math.floor(s/3600)}h`;
  return `${Math.floor(s/86400)}d`;
}

function NotifItem({ notif, onPress, onRead }: { notif: Notif; onPress: () => void; onRead: () => void }) {
  const cfg = TYPE_CONFIG[notif.type];
  return (
    <TouchableOpacity
      style={[styles.notifItem, !notif.is_read && styles.notifItemUnread]}
      onPress={() => { onRead(); onPress(); }}
      activeOpacity={0.8}
    >
      {!notif.is_read && <View style={styles.unreadDot} />}
      <View style={[styles.notifIcon, { backgroundColor: cfg.color + '20', borderColor: cfg.color + '40' }]}>
        {notif.actor_username
          ? <Avatar user={{ id: notif.actor_id!, username: notif.actor_username, displayName: notif.actor_username } as any} size={36} />
          : <Text style={{ fontSize: 18 }}>{cfg.emoji}</Text>
        }
        <View style={[styles.notifTypeDot, { backgroundColor: cfg.color }]}>
          <Text style={{ fontSize: 8 }}>{cfg.emoji}</Text>
        </View>
      </View>
      <View style={styles.notifContent}>
        <Text style={styles.notifMsg}>{notif.message}</Text>
        <Text style={styles.notifTime}>{timeAgo(notif.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );
}

export function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [notifs, setNotifs] = useState<Notif[]>(MOCK_NOTIFS);
  const [refreshing, setRefreshing] = useState(false);
  const unreadCount = notifs.filter(n => !n.is_read).length;

  const markAllRead = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const markRead = (id: string) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>NOTIFICAÇÕES</Text>
          {unreadCount > 0 && (
            <Text style={styles.headerSub}>{unreadCount} não lida{unreadCount > 1 ? 's' : ''}</Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead}>
            <Text style={styles.markAllText}>Marcar todas como lidas</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifs}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <NotifItem notif={item} onPress={() => {}} onRead={() => markRead(item.id)} />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await new Promise(r => setTimeout(r, 600)); setRefreshing(false); }} tintColor={Colors.accent} />}
        ListEmptyComponent={() => <EmptyState emoji="🔔" title="Sem notificações" subtitle="Quando alguém interagir com você, aparece aqui." />}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: Colors.border }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontFamily: Fonts.display, fontSize: 26, letterSpacing: 3, color: Colors.text },
  headerSub: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.accent, marginTop: 2 },
  markAllBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, marginTop: 4 },
  markAllText: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },

  notifItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.lg, paddingVertical: 14, position: 'relative' },
  notifItemUnread: { backgroundColor: Colors.accent + '06' },
  unreadDot: { position: 'absolute', left: 8, top: '50%', width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accent },
  notifIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, position: 'relative' },
  notifTypeDot: { position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.bg },
  notifContent: { flex: 1 },
  notifMsg: { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.text, lineHeight: 19, marginBottom: 3 },
  notifTime: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
});

// ============================================================
//  BACKLOG NETWORK — ReviewCreateScreen
// ============================================================
import React2, { useState as useState2 } from 'react';
import {
  View as View2, Text as Text2, StyleSheet as StyleSheet2,
  ScrollView as ScrollView2, TouchableOpacity as TouchableOpacity2,
  TextInput as TextInput2, KeyboardAvoidingView as KAV, Platform as Platform2, Alert as Alert2,
} from 'react-native';
import { LinearGradient as LG2 } from 'expo-linear-gradient';
import * as Haptics2 from 'expo-haptics';

export function ReviewCreateScreen() {
  const insets2 = useSafeAreaInsets();
  const navigation2 = useNavigation<any>();
  const [rating, setRating] = useState2(0);
  const [hoverRating, setHoverRating] = useState2(0);
  const [title, setTitle] = useState2('');
  const [body, setBody] = useState2('');
  const [spoiler, setSpoiler] = useState2(false);
  const [platform, setPlatform] = useState2('');
  const [hours, setHours] = useState2('');
  const [selectedGame] = useState2({ id: 'g1', title: 'Elden Ring', developer: 'FromSoftware' });
  const PLATFORMS = ['PC', 'PS5', 'PS4', 'Xbox', 'Nintendo Switch', 'Mobile'];

  const handleSubmit = () => {
    if (rating === 0) { Alert2.alert('Nota obrigatória', 'Dê uma nota antes de enviar.'); return; }
    if (body.trim().length < 30) { Alert2.alert('Review muito curta', 'Escreva pelo menos 30 caracteres.'); return; }
    Haptics2.notificationAsync(Haptics2.NotificationFeedbackType.Success);
    navigation2.goBack();
  };

  const getRatingLabel = (r: number) => {
    if (r === 0)  return 'Toque para avaliar';
    if (r <= 2)   return '💀 Terrível';
    if (r <= 4)   return '😞 Ruim';
    if (r <= 5)   return '😐 Mediano';
    if (r <= 6)   return '🙂 Ok';
    if (r <= 7)   return '😊 Bom';
    if (r <= 8)   return '😄 Muito bom';
    if (r <= 9)   return '🔥 Excelente';
    return '🏆 Obra-prima';
  };

  const getRatingColor = (r: number) => {
    if (r <= 3) return Colors.red;
    if (r <= 5) return Colors.amber;
    if (r <= 7) return Colors.accent;
    return Colors.teal;
  };

  return (
    <KAV style={{ flex: 1, backgroundColor: Colors.bg }} behavior={Platform2.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView2 showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Header */}
        <View2 style={[rs.header, { paddingTop: insets2.top + 10 }]}>
          <TouchableOpacity2 onPress={() => navigation2.goBack()} style={rs.cancelBtn}>
            <Text2 style={rs.cancelText}>Cancelar</Text2>
          </TouchableOpacity2>
          <Text2 style={rs.headerTitle}>NOVA REVIEW</Text2>
          <TouchableOpacity2 onPress={handleSubmit} style={[rs.submitBtn, rating === 0 && { opacity: 0.4 }]}>
            <LG2 colors={[Colors.accent, Colors.accentDark]} style={rs.submitGradient}>
              <Text2 style={rs.submitText}>Publicar</Text2>
            </LG2>
          </TouchableOpacity2>
        </View2>

        <View2 style={rs.content}>
          {/* Game chip */}
          <TouchableOpacity2 style={rs.gameChip} onPress={() => {}}>
            <Text2 style={{ fontSize: 20 }}>🎮</Text2>
            <View2 style={{ flex: 1 }}>
              <Text2 style={rs.gameChipTitle}>{selectedGame.title}</Text2>
              <Text2 style={rs.gameChipDev}>{selectedGame.developer}</Text2>
            </View2>
            <Text2 style={rs.changeGame}>Trocar →</Text2>
          </TouchableOpacity2>

          {/* RATING */}
          <View2 style={rs.ratingSection}>
            <Text2 style={rs.sectionLabel}>SUA NOTA</Text2>
            <View2 style={rs.starsRow}>
              {Array(10).fill(0).map((_, i) => {
                const val = i + 1;
                const active = (hoverRating || rating) >= val;
                return (
                  <TouchableOpacity2
                    key={i}
                    onPress={() => { Haptics2.impactAsync(Haptics2.ImpactFeedbackStyle.Light); setRating(val); }}
                    onPressIn={() => setHoverRating(val)}
                    onPressOut={() => setHoverRating(0)}
                    style={rs.starBtn}
                  >
                    <Text2 style={[rs.star, active && { color: getRatingColor(hoverRating || rating) }]}>★</Text2>
                  </TouchableOpacity2>
                );
              })}
            </View2>
            <View2 style={rs.ratingDisplay}>
              <Text2 style={[rs.ratingNum, rating > 0 && { color: getRatingColor(rating) }]}>
                {rating > 0 ? `${rating}.0` : '—'}
              </Text2>
              <Text2 style={rs.ratingLabel}>{getRatingLabel(hoverRating || rating)}</Text2>
            </View2>
          </View2>

          {/* TITLE (opcional) */}
          <View2 style={rs.field}>
            <Text2 style={rs.sectionLabel}>TÍTULO (opcional)</Text2>
            <TextInput2
              style={rs.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Ex: Uma obra-prima do gênero"
              placeholderTextColor={Colors.muted}
              maxLength={150}
            />
          </View2>

          {/* BODY */}
          <View2 style={rs.field}>
            <View2 style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
              <Text2 style={rs.sectionLabel}>SUA REVIEW</Text2>
              <Text2 style={rs.charCount}>{body.length}/2000</Text2>
            </View2>
            <TextInput2
              style={[rs.input, rs.textarea]}
              value={body}
              onChangeText={setBody}
              placeholder="O que você achou? Conta tudo — história, gameplay, gráficos, trilha sonora..."
              placeholderTextColor={Colors.muted}
              multiline
              maxLength={2000}
              textAlignVertical="top"
            />
          </View2>

          {/* PLATFORM */}
          <View2 style={rs.field}>
            <Text2 style={rs.sectionLabel}>PLATAFORMA</Text2>
            <ScrollView2 horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {PLATFORMS.map(p => (
                <TouchableOpacity2
                  key={p}
                  style={[rs.platformChip, platform === p && rs.platformChipActive]}
                  onPress={() => { Haptics2.selectionAsync(); setPlatform(platform === p ? '' : p); }}
                >
                  <Text2 style={[rs.platformChipText, platform === p && rs.platformChipTextActive]}>{p}</Text2>
                </TouchableOpacity2>
              ))}
            </ScrollView2>
          </View2>

          {/* HOURS */}
          <View2 style={rs.field}>
            <Text2 style={rs.sectionLabel}>HORAS JOGADAS (opcional)</Text2>
            <TextInput2
              style={[rs.input, { width: 120 }]}
              value={hours}
              onChangeText={setHours}
              placeholder="Ex: 48"
              placeholderTextColor={Colors.muted}
              keyboardType="numeric"
              maxLength={4}
            />
          </View2>

          {/* SPOILER TOGGLE */}
          <TouchableOpacity2
            style={[rs.spoilerToggle, spoiler && rs.spoilerToggleActive]}
            onPress={() => { Haptics2.impactAsync(Haptics2.ImpactFeedbackStyle.Light); setSpoiler(!spoiler); }}
          >
            <View2>
              <Text2 style={rs.spoilerTitle}>⚠️ Contém spoilers</Text2>
              <Text2 style={rs.spoilerSub}>A review será exibida com aviso</Text2>
            </View2>
            <View2 style={[rs.toggle, spoiler && rs.toggleActive]}>
              <View2 style={[rs.toggleThumb, spoiler && rs.toggleThumbActive]} />
            </View2>
          </TouchableOpacity2>
        </View2>
      </ScrollView2>
    </KAV>
  );
}

const rs = StyleSheet2.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cancelBtn: { paddingVertical: 8 },
  cancelText: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.muted },
  headerTitle: { fontFamily: Fonts.display, fontSize: 18, letterSpacing: 2, color: Colors.text },
  submitBtn: { borderRadius: Radius.md, overflow: 'hidden' },
  submitGradient: { paddingHorizontal: 18, paddingVertical: 9 },
  submitText: { fontFamily: Fonts.monoBold, fontSize: 13, color: '#0a0a0f' },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.xl },
  gameChip: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  gameChipTitle: { fontFamily: Fonts.bodyBold, fontSize: 15, color: Colors.text },
  gameChipDev: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  changeGame: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.accent },
  sectionLabel: { fontFamily: Fonts.monoBold, fontSize: 10, letterSpacing: 2, color: Colors.muted, marginBottom: Spacing.sm },
  ratingSection: {},
  starsRow: { flexDirection: 'row', gap: 4, marginBottom: Spacing.md },
  starBtn: { padding: 4 },
  star: { fontSize: 28, color: Colors.border },
  ratingDisplay: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ratingNum: { fontFamily: Fonts.display, fontSize: 40, letterSpacing: -1, color: Colors.muted },
  ratingLabel: { fontFamily: Fonts.bodyMedium, fontSize: 16, color: Colors.textSecondary },
  field: {},
  input: { backgroundColor: Colors.surface, borderRadius: Radius.xl, paddingHorizontal: 16, paddingVertical: 12, color: Colors.text, fontFamily: Fonts.body, fontSize: 14, borderWidth: 1, borderColor: Colors.border },
  textarea: { minHeight: 140, textAlignVertical: 'top' },
  charCount: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  platformChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  platformChipActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '15' },
  platformChipText: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted },
  platformChipTextActive: { color: Colors.accent },
  spoilerToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  spoilerToggleActive: { borderColor: Colors.amber + '60', backgroundColor: Colors.amber + '08' },
  spoilerTitle: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.text },
  spoilerSub: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, marginTop: 2 },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: Colors.border, padding: 3 },
  toggleActive: { backgroundColor: Colors.amber },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.text },
  toggleThumbActive: { transform: [{ translateX: 18 }] },
});

// ============================================================
//  BACKLOG NETWORK — LoginScreen
// ============================================================
import React3, { useState as useState3, useRef as useRef3 } from 'react';
import {
  View as View3, Text as Text3, StyleSheet as StyleSheet3,
  TouchableOpacity as TO3, TextInput as TI3,
  KeyboardAvoidingView as KAV3, Platform as P3, ScrollView as SV3, Alert as Al3,
} from 'react-native';
import { LinearGradient as LG3 } from 'expo-linear-gradient';
import * as Haptics3 from 'expo-haptics';
import { useAuthStore as useAuth3 } from '../../store/authStore';

export function LoginScreen() {
  const insets3 = useSafeAreaInsets();
  const navigation3 = useNavigation<any>();
  const { login } = useAuth3();

  const [mode, setMode] = useState3<'login' | 'register'>('login');
  const [email, setEmail] = useState3('');
  const [password, setPassword] = useState3('');
  const [username, setUsername] = useState3('');
  const [displayName, setDisplayName] = useState3('');
  const [showPass, setShowPass] = useState3(false);
  const [loading, setLoading] = useState3(false);
  const passRef = useRef3<TI3>(null);
  const emailRef = useRef3<TI3>(null);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) { Al3.alert('Campos obrigatórios', 'Preencha email e senha.'); return; }
    if (mode === 'register' && username.trim().length < 3) { Al3.alert('Username inválido', 'Mínimo 3 caracteres.'); return; }
    Haptics3.impactAsync(Haptics3.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      await new Promise(r => setTimeout(r, 1000)); // simula chamada API
      // await login(email, password);
    } catch (e) {
      Al3.alert('Erro', 'Email ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KAV3 style={{ flex: 1, backgroundColor: Colors.bg }} behavior={P3.OS === 'ios' ? 'padding' : undefined}>
      <SV3 showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        {/* BG gradient */}
        <LG3 colors={['#0f0720', Colors.bg, Colors.bg]} style={ls.bg} />

        <View3 style={[ls.container, { paddingTop: insets3.top + 20 }]}>
          {/* Logo */}
          <View3 style={ls.logoSection}>
            <Text3 style={ls.logo}>BACKLOG NETWORK</Text3>
            <Text3 style={ls.logoSub}>sua biblioteca gamer definitiva</Text3>
          </View3>

          {/* Mode toggle */}
          <View3 style={ls.modeToggle}>
            {(['login', 'register'] as const).map(m => (
              <TO3
                key={m}
                style={[ls.modeBtn, mode === m && ls.modeBtnActive]}
                onPress={() => { Haptics3.selectionAsync(); setMode(m); }}
              >
                <Text3 style={[ls.modeBtnText, mode === m && ls.modeBtnTextActive]}>
                  {m === 'login' ? 'Entrar' : 'Criar conta'}
                </Text3>
              </TO3>
            ))}
          </View3>

          {/* Form */}
          <View3 style={ls.form}>
            {mode === 'register' && (
              <>
                <View3 style={ls.field}>
                  <Text3 style={ls.fieldLabel}>NOME DE EXIBIÇÃO</Text3>
                  <TI3
                    style={ls.input}
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="Ex: Wilken Perez"
                    placeholderTextColor={Colors.muted}
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                  />
                </View3>
                <View3 style={ls.field}>
                  <Text3 style={ls.fieldLabel}>USERNAME</Text3>
                  <View3 style={ls.inputWrapper}>
                    <Text3 style={ls.inputPrefix}>@</Text3>
                    <TI3
                      style={[ls.input, { paddingLeft: 32, flex: 1 }]}
                      value={username}
                      onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                      placeholder="seunome"
                      placeholderTextColor={Colors.muted}
                      autoCapitalize="none"
                      returnKeyType="next"
                      onSubmitEditing={() => emailRef.current?.focus()}
                    />
                  </View3>
                  <Text3 style={ls.fieldHint}>Só letras, números, _ e .</Text3>
                </View3>
              </>
            )}

            <View3 style={ls.field}>
              <Text3 style={ls.fieldLabel}>EMAIL</Text3>
              <TI3
                ref={emailRef}
                style={ls.input}
                value={email}
                onChangeText={setEmail}
                placeholder="voce@email.com"
                placeholderTextColor={Colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => passRef.current?.focus()}
              />
            </View3>

            <View3 style={ls.field}>
              <Text3 style={ls.fieldLabel}>SENHA</Text3>
              <View3 style={ls.inputWrapper}>
                <TI3
                  ref={passRef}
                  style={[ls.input, { flex: 1 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={mode === 'register' ? 'Mínimo 8 caracteres' : '••••••••'}
                  placeholderTextColor={Colors.muted}
                  secureTextEntry={!showPass}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
                <TO3 style={ls.showPassBtn} onPress={() => setShowPass(!showPass)}>
                  <Text3 style={{ fontSize: 18 }}>{showPass ? '🙈' : '👁'}</Text3>
                </TO3>
              </View3>
            </View3>

            {mode === 'login' && (
              <TO3 style={ls.forgotBtn} onPress={() => {}}>
                <Text3 style={ls.forgotText}>Esqueci minha senha</Text3>
              </TO3>
            )}

            {/* Submit */}
            <TO3 style={[ls.submitBtn, loading && { opacity: 0.7 }]} onPress={handleSubmit} disabled={loading}>
              <LG3 colors={[Colors.accent, Colors.accentDark]} style={ls.submitGradient}>
                <Text3 style={ls.submitText}>
                  {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
                </Text3>
              </LG3>
            </TO3>

            {/* Divider */}
            <View3 style={ls.divider}>
              <View3 style={ls.dividerLine} />
              <Text3 style={ls.dividerText}>ou continue com</Text3>
              <View3 style={ls.dividerLine} />
            </View3>

            {/* Social */}
            <View3 style={ls.socialRow}>
              <TO3 style={ls.socialBtn} onPress={() => {}}>
                <Text3 style={ls.socialIcon}>🍎</Text3>
                <Text3 style={ls.socialText}>Apple</Text3>
              </TO3>
              <TO3 style={ls.socialBtn} onPress={() => {}}>
                <Text3 style={ls.socialIcon}>G</Text3>
                <Text3 style={ls.socialText}>Google</Text3>
              </TO3>
            </View3>
          </View3>

          {/* Footer */}
          <Text3 style={ls.terms}>
            Ao continuar, você concorda com os{' '}
            <Text3 style={ls.termsLink}>Termos de Uso</Text3>
            {' '}e a{' '}
            <Text3 style={ls.termsLink}>Política de Privacidade</Text3>
          </Text3>
        </View3>
      </SV3>
    </KAV3>
  );
}

const ls = StyleSheet3.create({
  bg: { position: 'absolute', top: 0, left: 0, right: 0, height: 300 },
  container: { flex: 1, paddingHorizontal: Spacing.xl, paddingBottom: 40 },
  logoSection: { alignItems: 'center', marginBottom: Spacing.xxl * 1.5 },
  logo: { fontFamily: Fonts.display, fontSize: 52, letterSpacing: 8, color: Colors.text },
  logoSub: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted, letterSpacing: 1, marginTop: 4 },
  modeToggle: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 4, marginBottom: Spacing.xl, borderWidth: 1, borderColor: Colors.border },
  modeBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: Radius.lg },
  modeBtnActive: { backgroundColor: Colors.accent },
  modeBtnText: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.muted },
  modeBtnTextActive: { color: '#0a0a0f' },
  form: { gap: Spacing.md },
  field: { gap: 6 },
  fieldLabel: { fontFamily: Fonts.monoBold, fontSize: 10, letterSpacing: 2, color: Colors.muted },
  fieldHint: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  inputPrefix: { position: 'absolute', left: 14, zIndex: 1, fontFamily: Fonts.bodyBold, fontSize: 16, color: Colors.muted },
  input: { backgroundColor: Colors.surface, borderRadius: Radius.xl, paddingHorizontal: 16, paddingVertical: 14, color: Colors.text, fontFamily: Fonts.body, fontSize: 15, borderWidth: 1, borderColor: Colors.border, width: '100%' },
  showPassBtn: { position: 'absolute', right: 14 },
  forgotBtn: { alignSelf: 'flex-end' },
  forgotText: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.accent },
  submitBtn: { borderRadius: Radius.xl, overflow: 'hidden', marginTop: Spacing.sm },
  submitGradient: { paddingVertical: 16, alignItems: 'center' },
  submitText: { fontFamily: Fonts.monoBold, fontSize: 15, color: '#0a0a0f', letterSpacing: 1 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  socialRow: { flexDirection: 'row', gap: 12 },
  socialBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.surface, borderRadius: Radius.xl, paddingVertical: 14, borderWidth: 1, borderColor: Colors.border },
  socialIcon: { fontFamily: Fonts.monoBold, fontSize: 18, color: Colors.text },
  socialText: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.text },
  terms: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, textAlign: 'center', lineHeight: 16, marginTop: Spacing.xl },
  termsLink: { color: Colors.accent },
});
