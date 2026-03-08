import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { Colors, Fonts, Spacing, Radius } from '../../theme';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, register } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const passRef = useRef<TextInput>(null);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Campos obrigatórios', 'Preencha email e senha.');
      return;
    }
    if (mode === 'register' && (!username.trim() || !displayName.trim())) {
      Alert.alert('Campos obrigatórios', 'Preencha nome e username.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'register') {
        await register({ username: username.trim(), email: email.trim(), password, display_name: displayName.trim() });
      } else {
        await login(email, password);
      }
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Algo deu errado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        <LinearGradient colors={['#0f0720', Colors.bg, Colors.bg]} style={StyleSheet.absoluteFill} />
        <View style={[s.container, { paddingTop: insets.top + 20 }]}>

          {/* LOGO */}
          <View style={s.logoSection}>
            <Text style={s.logo}>BACKLOG{'\n'}NETWORK</Text>
            <Text style={s.logoSub}>sua biblioteca gamer definitiva</Text>
          </View>

          {/* MODE TOGGLE */}
          <View style={s.modeToggle}>
            {(['login', 'register'] as const).map(m => (
              <TouchableOpacity
                key={m}
                style={[s.modeBtn, mode === m && s.modeBtnActive]}
                onPress={() => setMode(m)}
              >
                <Text style={[s.modeBtnText, mode === m && s.modeBtnTextActive]}>
                  {m === 'login' ? 'Entrar' : 'Criar conta'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* FORM */}
          <View style={s.form}>
            {mode === 'register' && (
              <>
                <View style={s.field}>
                  <Text style={s.label}>NOME DE EXIBIÇÃO</Text>
                  <TextInput
                    style={s.input}
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="Ex: Wilken Perez"
                    placeholderTextColor={Colors.muted}
                  />
                </View>
                <View style={s.field}>
                  <Text style={s.label}>USERNAME</Text>
                  <TextInput
                    style={s.input}
                    value={username}
                    onChangeText={t => setUsername(t.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                    placeholder="seunome"
                    placeholderTextColor={Colors.muted}
                    autoCapitalize="none"
                  />
                </View>
              </>
            )}

            <View style={s.field}>
              <Text style={s.label}>EMAIL</Text>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="voce@email.com"
                placeholderTextColor={Colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => passRef.current?.focus()}
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>SENHA</Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  ref={passRef}
                  style={s.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.muted}
                  secureTextEntry={!showPass}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
                <TouchableOpacity
                  style={{ position: 'absolute', right: 14, top: 14 }}
                  onPress={() => setShowPass(!showPass)}
                >
                  <Text style={{ fontSize: 18 }}>{showPass ? '🙈' : '👁'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* BOTÃO SUBMIT */}
            <TouchableOpacity
              style={[s.submitBtn, loading && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <LinearGradient colors={[Colors.accent, Colors.accentDark]} style={s.submitGradient}>
                <Text style={s.submitText}>
                  {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <Text style={s.terms}>
            Ao continuar, você concorda com os{' '}
            <Text style={s.termsLink}>Termos de Uso</Text>
            {' '}e a{' '}
            <Text style={s.termsLink}>Política de Privacidade</Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.xl, paddingBottom: 40 },
  logoSection: { alignItems: 'center', marginBottom: 48 },
  logo: { fontFamily: Fonts.display, fontSize: 48, letterSpacing: 8, color: Colors.text, textAlign: 'center', lineHeight: 52 },
  logoSub: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted, marginTop: 8 },
  modeToggle: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 4, marginBottom: Spacing.xl, borderWidth: 1, borderColor: Colors.border },
  modeBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: Radius.lg },
  modeBtnActive: { backgroundColor: Colors.accent },
  modeBtnText: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.muted },
  modeBtnTextActive: { color: '#0a0a0f' },
  form: { gap: Spacing.md },
  field: { gap: 6 },
  label: { fontFamily: Fonts.monoBold, fontSize: 10, letterSpacing: 2, color: Colors.muted },
  input: { backgroundColor: Colors.surface, borderRadius: Radius.xl, paddingHorizontal: 16, paddingVertical: 14, paddingRight: 48, color: Colors.text, fontFamily: Fonts.body, fontSize: 15, borderWidth: 1, borderColor: Colors.border },
  submitBtn: { borderRadius: Radius.xl, overflow: 'hidden', marginTop: Spacing.sm },
  submitGradient: { paddingVertical: 16, alignItems: 'center' },
  submitText: { fontFamily: Fonts.monoBold, fontSize: 15, color: '#0a0a0f', letterSpacing: 1 },
  terms: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, textAlign: 'center', lineHeight: 16, marginTop: Spacing.xl },
  termsLink: { color: Colors.accent },
});
