import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { AppTextField } from '../../components/AppTextField';
import { ScreenShell } from '../../components/ScreenShell';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/authService';
import { getErrorMessage } from '../../utils/errors';
import { theme } from '../../utils/theme';

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (loginError) {
      setLoginError(null);
    }
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (loginError) {
      setLoginError(null);
    }
  };

  const handleLogin = async () => {
    if (!email.trim()) {
      setLoginError('Informe seu e-mail para continuar.');
      return;
    }

    if (!password.trim()) {
      setLoginError('Informe sua senha para continuar.');
      return;
    }

    try {
      setLoading(true);
      setLoginError(null);
      await login(email, password);
    } catch (error) {
      setLoginError(getErrorMessage(error, 'Não foi possível autenticar.'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Recuperar senha', 'Informe seu e-mail para receber o link de redefinição.');
      return;
    }

    try {
      await authService.resetPassword(email);
      Alert.alert('Recuperar senha', 'Se o e-mail estiver cadastrado, o link de redefinição foi enviado.');
    } catch (error) {
      Alert.alert('Recuperar senha', getErrorMessage(error, 'Não foi possível enviar o e-mail de redefinição.'));
    }
  };

  return (
    <ScreenShell>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Equipe Cetreina</Text>
        <Text style={styles.title}>Controle de frequência para RH administrativo</Text>
        <Text style={styles.subtitle}>Entre com seu e-mail e senha para registrar presença, enviar justificativas por e-mail e acompanhar o histórico mensal.</Text>
      </View>

      <View style={styles.card}>
        <AppTextField label="E-mail" onChangeText={handleEmailChange} placeholder="voce@empresa.com" value={email} />
        <AppTextField label="Senha" onChangeText={handlePasswordChange} secureTextEntry value={password} />
        {loginError ? <Text style={styles.loginErrorText}>{loginError}</Text> : null}
        <Pressable onPress={handleForgotPassword} style={styles.linkButton}>
          <Text style={styles.linkText}>Esqueceu a senha?</Text>
        </Pressable>
        <AppButton loading={loading} onPress={handleLogin} title="Entrar" />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
  },
  eyebrow: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  title: {
    color: theme.colors.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  card: {
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    ...theme.shadow,
  },
  loginErrorText: {
    color: theme.colors.danger,
    fontSize: 13,
    fontWeight: '600',
    marginTop: -4,
  },
  linkButton: {
    alignSelf: 'flex-start',
  },
  linkText: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
});