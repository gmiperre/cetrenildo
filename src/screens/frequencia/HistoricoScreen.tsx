import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import { getJustificativaStatusLabel } from '../../domain/frequencia';
import { ScreenShell } from '../../components/ScreenShell';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { CalendarDay } from '../../models/calendar';
import { RegistroListItem } from '../../models/frequencia';
import { UserProfile } from '../../models/user';
import { calendarService } from '../../services/calendarService';
import { frequenciaService } from '../../services/frequenciaService';
import { userService } from '../../services/userService';
import { buildMonthlyTimelineByPolicy, formatDisplayDate, formatMonthLabel, formatTime, getMonthNavigation } from '../../utils/date';
import { theme } from '../../utils/theme';
import { FrequenciaStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<FrequenciaStackParamList, 'Historico'>;

export function HistoricoScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [records, setRecords] = useState<RegistroListItem[]>([]);
  const [calendarPolicies, setCalendarPolicies] = useState<Record<string, CalendarDay>>({});
  const [team, setTeam] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(profile?.id);

  const loadData = useCallback(async () => {
    if (!profile) {
      return;
    }

    const shouldLoadTeam = profile.tipo === 'gestor' && team.length === 0;
    const users = shouldLoadTeam ? await userService.listAll() : team;
    if (users.length && shouldLoadTeam) {
      setTeam(users);
    }

    const remoteRecords = await frequenciaService.getMonthlyRecords(month, year, {
      userId: selectedUserId,
      canViewAll: profile.tipo === 'gestor' && !selectedUserId,
    });

    const monthPolicies = await calendarService.getMonthlyPolicies(month, year);
    setCalendarPolicies(monthPolicies);

    setRecords(buildMonthlyTimelineByPolicy(remoteRecords, month, year, selectedUserId, monthPolicies));
  }, [month, profile, selectedUserId, year]);

  useFocusEffect(
    useCallback(() => {
      loadData().catch(() => undefined);
    }, [loadData]),
  );

  const changeMonth = (direction: 'prev' | 'next') => {
    const next = getMonthNavigation(month, year, direction);
    setMonth(next.month);
    setYear(next.year);
  };

  const renderHeader = () => (
    <View style={styles.filterCard}>
      <View style={styles.monthHeader}>
        <Pressable onPress={() => changeMonth('prev')} style={styles.monthButton}>
          <Text style={styles.monthButtonText}>Anterior</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{formatMonthLabel(month, year)}</Text>
        <Pressable onPress={() => changeMonth('next')} style={styles.monthButton}>
          <Text style={styles.monthButtonText}>Próximo</Text>
        </Pressable>
      </View>

      {profile?.tipo === 'gestor' ? (
        <View style={styles.chipsRow}>
          <Pressable onPress={() => setSelectedUserId(undefined)} style={[styles.chip, !selectedUserId && styles.chipActive]}>
            <Text style={[styles.chipText, !selectedUserId && styles.chipTextActive]}>Equipe</Text>
          </Pressable>
          {team.map((user) => (
            <Pressable key={user.id} onPress={() => setSelectedUserId(user.id)} style={[styles.chip, selectedUserId === user.id && styles.chipActive]}>
              <Text style={[styles.chipText, selectedUserId === user.id && styles.chipTextActive]}>{user.nome}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <ScreenShell contentStyle={styles.screenContent} scrollable={false}>
      <FlatList
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        data={records}
        initialNumToRender={12}
        keyExtractor={(item) => item.id}
        removeClippedSubviews
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate('Registro', { date: item.data, userId: item.userId })} style={styles.recordCard}>
            <View style={styles.recordHeader}>
              <View style={styles.recordTitleWrapper}>
                <Text style={styles.recordTitle}>{formatDisplayDate(item.data)}</Text>
                {!selectedUserId ? <Text style={styles.recordSub}>{item.userId}</Text> : null}
              </View>
              <StatusBadge pending={Boolean(item.horaEntrada && !item.horaSaida)} status={item.status} />
            </View>
            {calendarPolicies[item.data] ? (
              <Text style={styles.recordPolicy}>
                {calendarPolicies[item.data].tipo === 'feriado'
                  ? 'Feriado'
                  : calendarPolicies[item.data].tipo === 'ponto_facultativo'
                  ? 'Ponto facultativo'
                  : calendarPolicies[item.data].tipo === 'sem_expediente'
                  ? 'Sem expediente'
                  : 'Dia útil com política'}
              </Text>
            ) : null}
            <Text style={styles.recordText}>Entrada: {formatTime(item.horaEntrada)}</Text>
            <Text style={styles.recordText}>Saída: {formatTime(item.horaSaida)}</Text>
            <Text style={styles.recordText}>Justificativa: {getJustificativaStatusLabel(item.justificativaStatus)}</Text>
          </Pressable>
        )}
        showsVerticalScrollIndicator={false}
        windowSize={8}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    padding: 0,
  },
  filterCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadow,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  monthLabel: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  monthButton: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  monthButtonText: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surfaceMuted,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  recordCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    ...theme.shadow,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  recordTitleWrapper: {
    flex: 1,
  },
  recordTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  recordSub: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  recordText: {
    color: theme.colors.textMuted,
  },
  recordPolicy: {
    color: theme.colors.info,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
  },
});