import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { AppTextField } from '../../components/AppTextField';
import { ScreenShell } from '../../components/ScreenShell';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/authService';
import { userService } from '../../services/userService';
import { getErrorMessage } from '../../utils/errors';
import { theme } from '../../utils/theme';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const normalizeTimeValue = (value: string) => value.replace(/[^\d:]/g, '').slice(0, 5);

const isValidTimeValue = (value: string) => TIME_PATTERN.test(value);

export function CadastroFuncionarioScreen() {
  const { profile } = useAuth();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [entrada, setEntrada] = useState('08:00');
  const [saida, setSaida] = useState('17:00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => {
    if (error) setError(null);
  };

  const resetForm = () => {
    setNome('');
    setEmail('');
    setSenha('');
    setEntrada('08:00');
    setSaida('17:00');
    setError(null);
  };

  const handleSubmit = async () => {
    if (profile?.tipo !== 'gestor') return;

    const trimmedNome = nome.trim();
    const trimmedEmail = email.trim();
    const trimmedSenha = senha.trim();

    if (!trimmedNome) { setError('Informe o nome do funcionário.'); return; }
    if (!trimmedEmail) { setError('Informe o e-mail do funcionário.'); return; }
    if (!trimmedSenha) { setError('Defina uma senha inicial para o funcionário.'); return; }
    if (trimmedSenha.length < 6) { setError('A senha inicial precisa ter pelo menos 6 caracteres.'); return; }
    if (!isValidTimeValue(entrada)) { setError('Informe o horário de entrada no formato HH:MM.'); return; }
    if (!isValidTimeValue(saida)) { setError('Informe o horário de saída no formato HH:MM.'); return; }

    try {
      setLoading(true);
      setError(null);

      await authService.createEmployee(trimmedEmail, trimmedSenha, async (createdUser) => {
        await userService.createManagedProfile({
          id: createdUser.uid,
          nome: trimmedNome,
          email: trimmedEmail,
          horarioEntradaEsperado: entrada,
          horarioSaidaEsperado: saida,
          tipo: 'padrao',
        });
      });

      resetForm();
      Alert.alert(
        'Funcionário cadastrado',
        'O acesso foi criado com sucesso e a carga horária ficou vinculada ao perfil.',
        [{ text: 'OK' }, { text: 'Cadastrar outro', onPress: resetForm }],
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível cadastrar o funcionário agora.'));
    } finally {
      setLoading(false);
    }
  };

  if (profile?.tipo !== 'gestor') {
    return (
      <ScreenShell>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Acesso restrito</Text>
          <Text style={styles.cardText}>Esta tela é exclusiva para gestores.</Text>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <View style={styles.card}>
        <AppTextField
          autoCapitalize="words"
          label="Nome"
          onChangeText={(v) => { setNome(v); clearError(); }}
          placeholder="Nome completo"
          value={nome}
        />
        <AppTextField
          autoCapitalize="none"
          keyboardType="email-address"
          label="E-mail"
          onChangeText={(v) => { setEmail(v); clearError(); }}
          placeholder="funcionario@empresa.com"
          value={email}
        />
        <AppTextField
          autoCapitalize="none"
          label="Senha inicial"
          onChangeText={(v) => { setSenha(v); clearError(); }}
          placeholder="Mínimo de 6 caracteres"
          secureTextEntry
          value={senha}
        />
        <View style={styles.scheduleRow}>
          <View style={styles.scheduleField}>
            <AppTextField
              autoCapitalize="none"
              keyboardType="numbers-and-punctuation"
              label="Entrada"
              maxLength={5}
              onChangeText={(v) => { setEntrada(normalizeTimeValue(v)); clearError(); }}
              placeholder="08:00"
              value={entrada}
            />
          </View>
          <View style={styles.scheduleField}>
            <AppTextField
              autoCapitalize="none"
              keyboardType="numbers-and-punctuation"
              label="Saída"
              maxLength={5}
              onChangeText={(v) => { setSaida(normalizeTimeValue(v)); clearError(); }}
              placeholder="17:00"
              value={saida}
            />
          </View>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <AppButton loading={loading} onPress={handleSubmit} title="Cadastrar funcionário" />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadow,
  },
  scheduleRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  scheduleField: {
    flex: 1,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  cardText: {
    color: theme.colors.textMuted,
    lineHeight: 22,
  },
});
