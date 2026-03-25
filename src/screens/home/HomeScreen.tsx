import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';

import { AppButton } from '../../components/AppButton';
import { ScreenShell } from '../../components/ScreenShell';
import { StatusBadge } from '../../components/StatusBadge';
import { SummaryCard } from '../../components/SummaryCard';
import { useAuth } from '../../hooks/useAuth';
import { useMonthlySummary } from '../../hooks/useMonthlySummary';
import { frequenciaService } from '../../services/frequenciaService';
import { getErrorMessage } from '../../utils/errors';
import { theme } from '../../utils/theme';
import { AppTabParamList } from '../../navigation/types';

type Props = BottomTabScreenProps<AppTabParamList, 'HomeTab'>;

export function HomeScreen({ navigation }: Props) {
  const { logout, profile } = useAuth();
  const { records, workedDays, missedDays, refresh } = useMonthlySummary(profile?.id);
  const [punchLoading, setPunchLoading] = useState(false);
  const pendingEmailCount = records.filter((record) => record.justificativaStatus === 'pendente_envio').length;
  const rejectedCount = records.filter((record) => record.justificativaStatus === 'recusada').length;

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => undefined);
    }, [refresh]),
  );

  const handlePunch = async () => {
    if (!profile) {
      return;
    }

    try {
      setPunchLoading(true);
      const record = await frequenciaService.registerPunch(profile);
      Alert.alert('Registro atualizado', record.horaSaida ? 'Saída registrada com sucesso.' : 'Entrada registrada com sucesso.');
      await refresh();
    } catch (error) {
      Alert.alert('Falha ao bater ponto', getErrorMessage(error, 'Tente novamente.'));
    } finally {
      setPunchLoading(false);
    }
  };

  if (!profile) {
    return null;
  }

  return (
    <ScreenShell>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.greeting}>Olá, {profile.nome}</Text>
          <Text style={styles.meta}>{profile.email}</Text>
        </View>
        <StatusBadge pending={profile.tipo === 'gestor'} status={profile.tipo === 'gestor' ? 'abono' : 'presente'} />
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Módulo de frequência</Text>
        <Text style={styles.heroText}>Use o botão único para registrar entrada e saída. Gestores também podem validar ocorrências e acompanhar o time.</Text>
        <AppButton loading={punchLoading} onPress={handlePunch} title="Bater ponto" />
      </View>

      <View style={styles.summaryRow}>
        <SummaryCard accent={theme.colors.success} label="Dias trabalhados" value={workedDays} />
        <SummaryCard accent={theme.colors.danger} label="Faltas" value={missedDays} />
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Perfil</Text>
        <Text style={styles.sectionText}>Tipo de acesso: {profile.tipo}</Text>
        <Text style={styles.sectionText}>Horário esperado: {profile.horarioEntradaEsperado} às {profile.horarioSaidaEsperado}</Text>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Avisos</Text>
        <Text style={styles.sectionText}>• Confirme seus registros pendentes no detalhe do dia.</Text>
        {pendingEmailCount > 0 ? <Text style={styles.sectionText}>• Você tem justificativas pendentes de envio por e-mail.</Text> : null}
        {rejectedCount > 0 ? <Text style={styles.sectionText}>• Existe justificativa recusada aguardando correção.</Text> : null}
        <Text style={styles.sectionText}>• Gestores podem validar registros e justificar ausências diretamente no módulo.</Text>
      </View>

      <AppButton onPress={() => navigation.navigate('FrequenciaTab')} title="Abrir módulo de frequência" variant="secondary" />
      <AppButton onPress={() => logout()} title="Sair" variant="ghost" />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    ...theme.shadow,
  },
  headerContent: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.text,
  },
  meta: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  heroCard: {
    backgroundColor: theme.colors.primaryDark,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  heroText: {
    color: '#D7F4E6',
    lineHeight: 22,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    ...theme.shadow,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  sectionText: {
    color: theme.colors.textMuted,
    lineHeight: 22,
  },
});