import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import { AppButton } from '../../components/AppButton';
import { ScreenShell } from '../../components/ScreenShell';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { FrequenciaRegistro } from '../../models/frequencia';
import { frequenciaService } from '../../services/frequenciaService';
import { formatDisplayDate, formatTime, getTodayKey } from '../../utils/date';
import { getErrorMessage } from '../../utils/errors';
import { theme } from '../../utils/theme';
import { FrequenciaStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<FrequenciaStackParamList, 'FrequenciaHome'>;

export function FrequenciaScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [record, setRecord] = useState<FrequenciaRegistro | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!profile) {
      return;
    }

    const todayRecord = await frequenciaService.getTodayRecord(profile.id);
    setRecord(todayRecord);
  }, [profile]);

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
      setLoading(true);
      const nextRecord = await frequenciaService.registerPunch(profile);
      setRecord(nextRecord);
      Alert.alert('Ponto atualizado', nextRecord.horaSaida ? 'Saída registrada.' : 'Entrada registrada.');
    } catch (error) {
      Alert.alert('Falha ao bater ponto', getErrorMessage(error, 'Tente novamente.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenShell>
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Hoje</Text>
        <Text style={styles.heroSubtitle}>{formatDisplayDate(getTodayKey())}</Text>
        <StatusBadge pending={Boolean(record?.horaEntrada && !record?.horaSaida)} status={record?.status ?? 'falta'} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Horários registrados</Text>
        <Text style={styles.cardText}>Entrada: {formatTime(record?.horaEntrada)}</Text>
        <Text style={styles.cardText}>Saída: {formatTime(record?.horaSaida)}</Text>
        <AppButton loading={loading} onPress={handlePunch} title="Bater ponto" />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ações</Text>
        <AppButton onPress={() => navigation.navigate('Registro', { date: getTodayKey(), userId: profile?.id })} title="Detalhar registro do dia" variant="secondary" />
        <AppButton onPress={() => navigation.navigate('Historico')} title="Ver histórico" variant="ghost" />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    ...theme.shadow,
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 15,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadow,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  cardText: {
    color: theme.colors.textMuted,
    fontSize: 16,
  },
});