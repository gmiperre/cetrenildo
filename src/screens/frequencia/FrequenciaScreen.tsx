import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import { AppButton } from '../../components/AppButton';
import { AppTextField } from '../../components/AppTextField';
import { ScreenShell } from '../../components/ScreenShell';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { getJustificativaGuidance, getRegistroVisualStatus } from '../../domain/frequencia';
import { CalendarDay } from '../../models/calendar';
import { FrequenciaRegistro } from '../../models/frequencia';
import { calendarService } from '../../services/calendarService';
import { frequenciaService } from '../../services/frequenciaService';
import { formatDisplayDate, formatTime, getTodayKey, isWorkdayForDate } from '../../utils/date';
import { getErrorMessage } from '../../utils/errors';
import { theme } from '../../utils/theme';
import { FrequenciaStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<FrequenciaStackParamList, 'FrequenciaHome'>;

const TIME_INPUT_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const toInputTime = (value?: Date | null) => {
  if (!value) {
    return '';
  }

  const hour = `${value.getHours()}`.padStart(2, '0');
  const minute = `${value.getMinutes()}`.padStart(2, '0');
  return `${hour}:${minute}`;
};

const toMinutes = (value: string) => {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
};

export function FrequenciaScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [record, setRecord] = useState<FrequenciaRegistro | null>(null);
  const [dayPolicy, setDayPolicy] = useState<CalendarDay | null>(null);
  const [loading, setLoading] = useState(false);
  const [entradaInformada, setEntradaInformada] = useState('');
  const [saidaInformada, setSaidaInformada] = useState('');
  const today = getTodayKey();
  const isWorkday = isWorkdayForDate(today, dayPolicy);
  const statusPresentation = getRegistroVisualStatus(record);

  const refresh = useCallback(async () => {
    if (!profile) {
      return;
    }

    const [todayRecord, policy] = await Promise.all([
      frequenciaService.getTodayRecord(profile.id),
      calendarService.getByDate(getTodayKey()),
    ]);
    setRecord(todayRecord);
    setDayPolicy(policy);

    if (todayRecord?.horaEntrada && todayRecord?.horaSaida) {
      setEntradaInformada(toInputTime(todayRecord.horaEntrada.toDate()));
      setSaidaInformada(toInputTime(todayRecord.horaSaida.toDate()));
      return;
    }

    setEntradaInformada(profile.horarioEntradaEsperado);
    setSaidaInformada(profile.horarioSaidaEsperado);
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

    if (!TIME_INPUT_REGEX.test(entradaInformada) || !TIME_INPUT_REGEX.test(saidaInformada)) {
      Alert.alert('Validação', 'Informe horários válidos no formato HH:mm.');
      return;
    }

    if (toMinutes(entradaInformada) >= toMinutes(saidaInformada)) {
      Alert.alert('Validação', 'A entrada deve ser anterior à saída.');
      return;
    }

    try {
      setLoading(true);
      const nextRecord = await frequenciaService.registerPunch(profile, getTodayKey(), {
        entryTime: entradaInformada,
        exitTime: saidaInformada,
      });
      setRecord(nextRecord);
      Alert.alert('Ponto atualizado', 'Horários salvos com sucesso.');
    } catch (error) {
      Alert.alert('Falha ao bater ponto', getErrorMessage(error, 'Tente novamente.'));
    } finally {
      setLoading(false);
    }
  };

  const applyExpectedSchedule = () => {
    if (!profile) {
      return;
    }

    setEntradaInformada(profile.horarioEntradaEsperado);
    setSaidaInformada(profile.horarioSaidaEsperado);
  };

  return (
    <ScreenShell>
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Hoje</Text>
        <Text style={styles.heroSubtitle}>{formatDisplayDate(today)}</Text>
        {isWorkday ? (
          <StatusBadge
            labelOverride={statusPresentation.label}
            pending={Boolean(record?.horaEntrada && !record?.horaSaida)}
            status={statusPresentation.status}
          />
        ) : (
          <StatusBadge labelOverride="Sem expediente" status="abono" />
        )}
        {isWorkday ? <Text style={styles.heroHint}>{getJustificativaGuidance(record, false)}</Text> : null}
      </View>

      {isWorkday ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Horários do dia</Text>
          <Text style={styles.cardText}>Esperado: {profile?.horarioEntradaEsperado ?? '--:--'} às {profile?.horarioSaidaEsperado ?? '--:--'}</Text>
          <AppTextField
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            label="Entrada"
            maxLength={5}
            onChangeText={setEntradaInformada}
            placeholder="08:00"
            value={entradaInformada}
          />
          <AppTextField
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            label="Saída"
            maxLength={5}
            onChangeText={setSaidaInformada}
            placeholder="17:00"
            value={saidaInformada}
          />
          <AppButton onPress={applyExpectedSchedule} title="Usar horário esperado" variant="secondary" />
          <AppButton loading={loading} onPress={handlePunch} title="Bater ponto" />
          <Text style={styles.cardText}>Último registro salvo: Entrada {formatTime(record?.horaEntrada)} | Saída {formatTime(record?.horaSaida)}</Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sem expediente</Text>
          <Text style={styles.cardText}>Hoje é fim de semana e não há expediente previsto. Para registrar presença em dias atípicos, o gestor deve criar uma exceção no calendário.</Text>
        </View>
      )}

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
  heroHint: {
    color: theme.colors.textMuted,
    lineHeight: 22,
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