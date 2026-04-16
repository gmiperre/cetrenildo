import { useCallback, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';

import { AppButton } from '../../components/AppButton';
import { getJustificativaStatusLabel, getRegistroVisualStatus } from '../../domain/frequencia';
import { ScreenShell } from '../../components/ScreenShell';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { useFolhaMensal } from '../../hooks/useFolhaMensal';
import { CalendarDay } from '../../models/calendar';
import { RegistroListItem } from '../../models/frequencia';
import { UserDirectoryEntry } from '../../models/user';
import { calendarService } from '../../services/calendarService';
import { folhaDocumentService } from '../../services/folhaDocumentService';
import { frequenciaService } from '../../services/frequenciaService';
import { userService } from '../../services/userService';
import { buildMonthlyTimelineByPolicy, formatDisplayDate, formatMonthLabel, formatTime, getMonthNavigation } from '../../utils/date';
import { theme } from '../../utils/theme';
import { FrequenciaStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<FrequenciaStackParamList, 'Historico'>;
const MAX_FOLHA_PDF_BYTES = 10 * 1024 * 1024;

export function HistoricoScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [records, setRecords] = useState<RegistroListItem[]>([]);
  const [calendarPolicies, setCalendarPolicies] = useState<Record<string, CalendarDay>>({});
  const [team, setTeam] = useState<UserDirectoryEntry[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(profile?.id);
  const [openingFolha, setOpeningFolha] = useState(false);
  const {
    folha,
    loading: folhaLoading,
    error: folhaError,
    refreshFolha,
    emitirFolha,
    confirmarCienciaFolha,
  } = useFolhaMensal(
    profile?.tipo === 'padrao' ? profile.id : undefined,
  );

  const canEmitFolha = profile?.tipo === 'padrao' && selectedUserId === profile.id;

  const folhaStatusLabel: Record<string, string> = {
    emitida: 'Emitida (sincronização pendente)',
    aguardando_upload_funcionario: 'Aguardando upload da versão assinada',
    enviada_funcionario: 'Enviada pelo funcionário',
    em_revisao_gestor: 'Revisão concluída pelo gestor',
    rejeitada_gestor: 'Rejeitada pelo gestor',
    final_assinada_gestor: 'Assinada pelo gestor',
    concluida: 'Concluída',
  };

  const handleUploadFolhaAssinada = async () => {
    if (!profile?.id) {
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: 'application/pdf',
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    const name = asset.name ?? 'folha-assinada.pdf';
    const mimeType = asset.mimeType ?? 'application/pdf';
    const isPdf = mimeType === 'application/pdf' || name.toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      Alert.alert('Arquivo inválido', 'Selecione um arquivo em formato .pdf.');
      return;
    }

    if (typeof asset.size === 'number' && asset.size > MAX_FOLHA_PDF_BYTES) {
      Alert.alert('Arquivo muito grande', 'A folha assinada deve ter no máximo 10 MB.');
      return;
    }

    try {
      const upload = await folhaDocumentService.uploadFolhaFuncionarioAssinada({
        userId: profile.id,
        month,
        year,
        fileName: name,
        mimeType,
        fileUri: asset.uri,
      });

      await frequenciaService.uploadFolhaAssinadaFuncionario(profile.id, month, year, profile.id, upload.path, upload.hash);
      await refreshFolha(month, year);
      Alert.alert('Sucesso', 'Folha assinada enviada para revisão da chefia.');
    } catch (err) {
      Alert.alert('Falha no envio', `${err}`.replace('Error: ', ''));
    }
  };

  const handleOpenFolhaEmitida = async () => {
    const path = folha?.pdfOriginalPath;
    if (!path) {
      Alert.alert('Arquivo indisponível', 'A folha emitida ainda não possui um PDF disponível para download.');
      return;
    }

    try {
      setOpeningFolha(true);
      const url = await folhaDocumentService.createDownloadUrl(path);
      await Linking.openURL(url);
    } catch (err) {
      const message = `${err}`.replace('Error: ', '');
      const objectMissing = message.toLowerCase().includes('object not found');

      if (objectMissing) {
        Alert.alert(
          'Arquivo não encontrado',
          'A folha salva para este mês aponta para um arquivo que não existe mais no storage. Reemita a folha para gerar um PDF novo.',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Reemitir agora',
              onPress: () => {
                emitirFolha(month, year)
                  .then(() => refreshFolha(month, year))
                  .then(() => {
                    Alert.alert('Folha reemitida', 'Um novo PDF foi gerado. Tente baixar novamente.');
                  })
                  .catch((emitError) => {
                    Alert.alert('Falha ao reemitir', `${emitError}`.replace('Error: ', ''));
                  });
              },
            },
          ],
        );
      } else {
        Alert.alert('Falha ao abrir arquivo', message);
      }
    } finally {
      setOpeningFolha(false);
    }
  };

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

    if (profile.tipo === 'padrao' && selectedUserId === profile.id) {
      await refreshFolha(month, year);
    }
  }, [month, profile, refreshFolha, selectedUserId, team, year]);

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

      {canEmitFolha ? (
        <View style={styles.folhaCard}>
          <Text style={styles.folhaTitle}>Folha mensal</Text>
          <Text style={styles.folhaDescription}>
            Emita a folha oficial deste mês para assinatura externa e revisão da chefia.
          </Text>
          <Text style={styles.folhaStatus}>
            Status: {folha ? folhaStatusLabel[folha.status] ?? folha.status : 'Não emitida'}
          </Text>
          {folha?.updatedAt ? (
            <Text style={styles.folhaMeta}>Última atualização: {folha.updatedAt.toDate().toLocaleString('pt-BR')}</Text>
          ) : null}
          {folha?.pdfOriginalPath ? <Text style={styles.folhaMeta}>Arquivo emitido: {folha.pdfOriginalPath}</Text> : null}
          {folha?.motivoRejeicao ? <Text style={styles.folhaError}>Motivo da rejeição: {folha.motivoRejeicao}</Text> : null}
          {folha?.pdfGestorFinalPath ? <Text style={styles.folhaMeta}>Versão final: {folha.pdfGestorFinalPath}</Text> : null}
          {folhaError ? <Text style={styles.folhaError}>{folhaError}</Text> : null}
          <AppButton
            title={folha ? 'Reemitir folha mensal' : 'Emitir folha mensal'}
            onPress={() => {
              emitirFolha(month, year)
                .then(() => refreshFolha(month, year))
                .catch(() => undefined);
            }}
            loading={folhaLoading}
          />
          {folha?.pdfOriginalPath ? (
            <AppButton
              title="Baixar folha emitida"
              onPress={handleOpenFolhaEmitida}
              variant="secondary"
              loading={openingFolha}
            />
          ) : null}
          {folha && (folha.status === 'aguardando_upload_funcionario' || folha.status === 'rejeitada_gestor') ? (
            <AppButton
              title="Anexar folha assinada (PDF)"
              onPress={handleUploadFolhaAssinada}
              variant="secondary"
              loading={folhaLoading}
            />
          ) : null}
          {folha?.status === 'final_assinada_gestor' ? (
            <AppButton
              title="Confirmar ciência e concluir"
              onPress={() => {
                confirmarCienciaFolha(month, year)
                  .then(() => refreshFolha(month, year))
                  .then(() => {
                    Alert.alert('Concluído', 'Ciência confirmada com sucesso.');
                  })
                  .catch(() => undefined);
              }}
              variant="secondary"
              loading={folhaLoading}
            />
          ) : null}
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
            {(() => {
              const statusPresentation = getRegistroVisualStatus(item);
              return (
            <View style={styles.recordHeader}>
              <View style={styles.recordTitleWrapper}>
                <Text style={styles.recordTitle}>{formatDisplayDate(item.data)}</Text>
                {!selectedUserId ? <Text style={styles.recordSub}>{item.userId}</Text> : null}
              </View>
              <StatusBadge
                labelOverride={statusPresentation.label}
                pending={Boolean(item.horaEntrada && !item.horaSaida)}
                status={statusPresentation.status}
              />
            </View>
              );
            })()}
            {item.justificativaDocumentoNome ? (
              <View style={[styles.pdfBadge, item.justificativaStatus === 'recusada' && styles.pdfBadgeRejected]}>
                <Text style={[styles.pdfBadgeText, item.justificativaStatus === 'recusada' && styles.pdfBadgeTextRejected]}>
                  {item.justificativaStatus === 'recusada' ? 'Comprovante PDF recusado' : 'Ausência declarada com PDF'}
                </Text>
              </View>
            ) : null}
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
  folhaCard: {
    marginTop: theme.spacing.sm,
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  folhaTitle: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
  folhaDescription: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  folhaStatus: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  folhaMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  folhaError: {
    color: theme.colors.danger,
    fontSize: 13,
    fontWeight: '600',
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
  pdfBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EAF7EF',
    borderColor: '#73B68B',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
  },
  pdfBadgeRejected: {
    backgroundColor: '#FFF1EE',
    borderColor: '#F1C5BE',
  },
  pdfBadgeText: {
    color: '#1C6B3A',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  pdfBadgeTextRejected: {
    color: '#A73527',
  },
});