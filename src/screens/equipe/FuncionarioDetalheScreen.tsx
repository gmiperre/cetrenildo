import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';

import { AppButton } from '../../components/AppButton';
import { AppTextField } from '../../components/AppTextField';
import { ScreenShell } from '../../components/ScreenShell';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { useFolhaMensal } from '../../hooks/useFolhaMensal';
import { CONTESTACAO_STATUS_LABELS, getJustificativaStatusLabel } from '../../domain/frequencia';
import { RegistroListItem } from '../../models/frequencia';
import { UserProfile } from '../../models/user';
import { calendarService } from '../../services/calendarService';
import { folhaDocumentService } from '../../services/folhaDocumentService';
import { frequenciaService } from '../../services/frequenciaService';
import { userService } from '../../services/userService';
import { buildMonthlyTimelineByPolicy, formatDisplayDate, formatMonthLabel, formatTime, getMonthNavigation } from '../../utils/date';
import { getErrorMessage } from '../../utils/errors';
import { theme } from '../../utils/theme';
import { AppStackParamList, EquipeStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<EquipeStackParamList, 'FuncionarioDetalhe'>;
const MAX_FOLHA_PDF_BYTES = 10 * 1024 * 1024;

export function FuncionarioDetalheScreen({ navigation, route }: Props) {
  const { profile } = useAuth();
  const [employee, setEmployee] = useState<UserProfile | null>(null);
  const [records, setRecords] = useState<RegistroListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [rejectingDate, setRejectingDate] = useState<string | null>(null);
  const [rejectObservacao, setRejectObservacao] = useState('');
  const [contestingDate, setContestingDate] = useState<string | null>(null);
  const [contestMotivo, setContestMotivo] = useState('');
  const [reopeningDate, setReopeningDate] = useState<string | null>(null);
  const [reopenMotivo, setReopenMotivo] = useState('');
  const [folhaRejectMotivo, setFolhaRejectMotivo] = useState('');
  const [showFolhaRejectForm, setShowFolhaRejectForm] = useState(false);
  const [reviewingFolha, setReviewingFolha] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const { folha, refreshFolha, reviewFolhaGestor, uploadFolhaFinalGestor } = useFolhaMensal(route.params.userId);

  const folhaStatusLabel: Record<string, string> = {
    emitida: 'Emitida (pendente de sincronização)',
    aguardando_upload_funcionario: 'Aguardando upload do funcionário',
    enviada_funcionario: 'Aguardando revisão da chefia',
    em_revisao_gestor: 'Revisão da chefia concluída',
    rejeitada_gestor: 'Rejeitada pela chefia',
    final_assinada_gestor: 'Versão final assinada pela chefia',
    concluida: 'Concluída',
  };

  const presentCount = useMemo(() => records.filter((r) => r.status === 'presente').length, [records]);
  const justifiedCount = useMemo(() => records.filter((r) => r.status === 'falta_justificada').length, [records]);
  const missedCount = useMemo(() => records.filter((r) => r.status === 'falta').length, [records]);
  const pendingCount = useMemo(() => records.filter((r) => !r.isSynthetic && r.justificativaStatus === 'em_analise').length, [records]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [nextEmployee, remoteRecords, monthPolicies] = await Promise.all([
        userService.getById(route.params.userId),
        frequenciaService.getMonthlyRecords(month, year, { userId: route.params.userId }),
        calendarService.getMonthlyPolicies(month, year),
      ]);
      setEmployee(nextEmployee);
      setRecords(buildMonthlyTimelineByPolicy(remoteRecords, month, year, route.params.userId, monthPolicies));
      await refreshFolha(month, year);
    } finally {
      setLoading(false);
    }
  }, [month, refreshFolha, route.params.userId, year]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadData().catch(() => undefined);
      return () => { active = false; };
    }, [loadData]),
  );

  const handleChangeMonth = (direction: 'prev' | 'next') => {
    const next = getMonthNavigation(month, year, direction);
    setMonth(next.month);
    setYear(next.year);
    setRejectingDate(null);
    setRejectObservacao('');
    setContestingDate(null);
    setContestMotivo('');
    setReopeningDate(null);
    setReopenMotivo('');
  };

  const handleOpenRecord = (date: string) => {
    if (!employee) return;
    navigation
      .getParent<NativeStackNavigationProp<AppStackParamList>>()
      ?.navigate('FrequenciaModule', { screen: 'Registro', params: { date, userId: employee.id } } as never);
  };

  const handleFolhaAprovar = async () => {
    if (!profile) {
      return;
    }

    setReviewingFolha(true);
    try {
      await reviewFolhaGestor(route.params.userId, month, year, profile.id, 'aprovar');
      await refreshFolha(month, year);
      setShowFolhaRejectForm(false);
      setFolhaRejectMotivo('');
      Alert.alert('Sucesso', 'Revisão da folha concluída.');
    } catch (err) {
      Alert.alert('Erro na revisão', getErrorMessage(err, 'Não foi possível aprovar a folha.'));
    } finally {
      setReviewingFolha(false);
    }
  };

  const handleFolhaRejeitar = async () => {
    if (!profile) {
      return;
    }

    if (!folhaRejectMotivo.trim()) {
      Alert.alert('Atenção', 'Informe o motivo da rejeição da folha.');
      return;
    }

    setReviewingFolha(true);
    try {
      await reviewFolhaGestor(route.params.userId, month, year, profile.id, 'rejeitar', folhaRejectMotivo.trim());
      await refreshFolha(month, year);
      setShowFolhaRejectForm(false);
      setFolhaRejectMotivo('');
      Alert.alert('Folha rejeitada', 'A rejeição foi registrada e o funcionário foi notificado.');
    } catch (err) {
      Alert.alert('Erro na revisão', getErrorMessage(err, 'Não foi possível rejeitar a folha.'));
    } finally {
      setReviewingFolha(false);
    }
  };

  const handleUploadFolhaFinal = async () => {
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
    const name = asset.name ?? 'folha-final-assinada.pdf';
    const mimeType = asset.mimeType ?? 'application/pdf';
    const isPdf = mimeType === 'application/pdf' || name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      Alert.alert('Arquivo inválido', 'Selecione um arquivo em formato .pdf.');
      return;
    }

    if (typeof asset.size === 'number' && asset.size > MAX_FOLHA_PDF_BYTES) {
      Alert.alert('Arquivo muito grande', 'O PDF final deve ter no máximo 10 MB.');
      return;
    }

    setReviewingFolha(true);
    try {
      const upload = await folhaDocumentService.uploadFolhaGestorFinal({
        userId: route.params.userId,
        month,
        year,
        fileName: name,
        mimeType,
        fileUri: asset.uri,
      });

      await uploadFolhaFinalGestor(route.params.userId, month, year, profile.id, upload.path, upload.hash);
      await refreshFolha(month, year);
      Alert.alert('Sucesso', 'Versão final assinada enviada ao funcionário.');
    } catch (err) {
      Alert.alert('Erro no envio final', getErrorMessage(err, 'Não foi possível enviar a versão final da folha.'));
    } finally {
      setReviewingFolha(false);
    }
  };

  const handleValidate = async (date: string) => {
    if (!profile || !employee) return;
    setActionLoading((prev) => ({ ...prev, [date]: true }));
    try {
      await frequenciaService.validateRegistro(employee.id, date, profile.id);
      const [remoteRecords, monthPolicies] = await Promise.all([
        frequenciaService.getMonthlyRecords(month, year, { userId: employee.id }),
        calendarService.getMonthlyPolicies(month, year),
      ]);
      setRecords(buildMonthlyTimelineByPolicy(remoteRecords, month, year, employee.id, monthPolicies));
    } catch (err) {
      Alert.alert('Erro ao validar', getErrorMessage(err, 'Não foi possível validar o registro.'));
    } finally {
      setActionLoading((prev) => ({ ...prev, [date]: false }));
    }
  };

  const handleRejectConfirm = async (date: string) => {
    if (!profile || !employee) return;
    if (!rejectObservacao.trim()) {
      Alert.alert('Atenção', 'Informe o motivo da recusa antes de continuar.');
      return;
    }
    setActionLoading((prev) => ({ ...prev, [date]: true }));
    try {
      await frequenciaService.rejectRegistro(employee.id, date, profile.id, rejectObservacao.trim());
      setRejectingDate(null);
      setRejectObservacao('');
      setContestingDate(null);
      setContestMotivo('');
      const [remoteRecords, monthPolicies] = await Promise.all([
        frequenciaService.getMonthlyRecords(month, year, { userId: employee.id }),
        calendarService.getMonthlyPolicies(month, year),
      ]);
      setRecords(buildMonthlyTimelineByPolicy(remoteRecords, month, year, employee.id, monthPolicies));
    } catch (err) {
      Alert.alert('Erro ao recusar', getErrorMessage(err, 'Não foi possível recusar a justificativa.'));
    } finally {
      setActionLoading((prev) => ({ ...prev, [date]: false }));
    }
  };

  const handleContestConfirm = async (date: string) => {
    if (!profile || !employee) return;
    if (!contestMotivo.trim()) {
      Alert.alert('Atenção', 'Descreva o motivo da contestação antes de continuar.');
      return;
    }
    setActionLoading((prev) => ({ ...prev, [date]: true }));
    try {
      await frequenciaService.contestPresenca(employee.id, date, profile.id, contestMotivo.trim());
      setContestingDate(null);
      setContestMotivo('');
      const [remoteRecords, monthPolicies] = await Promise.all([
        frequenciaService.getMonthlyRecords(month, year, { userId: employee.id }),
        calendarService.getMonthlyPolicies(month, year),
      ]);
      setRecords(buildMonthlyTimelineByPolicy(remoteRecords, month, year, employee.id, monthPolicies));
    } catch (err) {
      Alert.alert('Erro ao contestar', getErrorMessage(err, 'Não foi possível contestar a presença.'));
    } finally {
      setActionLoading((prev) => ({ ...prev, [date]: false }));
    }
  };

  const handleEncerrar = async (date: string, decisao: 'mantida_falta' | 'revertida_presente') => {
    if (!profile || !employee) return;
    setActionLoading((prev) => ({ ...prev, [date]: true }));
    try {
      await frequenciaService.encerrarContestacao(employee.id, date, profile.id, decisao);
      const [remoteRecords, monthPolicies] = await Promise.all([
        frequenciaService.getMonthlyRecords(month, year, { userId: employee.id }),
        calendarService.getMonthlyPolicies(month, year),
      ]);
      setRecords(buildMonthlyTimelineByPolicy(remoteRecords, month, year, employee.id, monthPolicies));
    } catch (err) {
      Alert.alert('Erro ao encerrar contestação', getErrorMessage(err, 'Não foi possível encerrar a contestação.'));
    } finally {
      setActionLoading((prev) => ({ ...prev, [date]: false }));
    }
  };

  const handleReopenConfirm = async (date: string) => {
    if (!profile || !employee) return;
    if (!reopenMotivo.trim()) {
      Alert.alert('Atenção', 'Informe o motivo da reabertura da contestação.');
      return;
    }

    setActionLoading((prev) => ({ ...prev, [date]: true }));
    try {
      await frequenciaService.reopenContestacao(employee.id, date, profile.id, reopenMotivo.trim());
      setReopeningDate(null);
      setReopenMotivo('');
      const [remoteRecords, monthPolicies] = await Promise.all([
        frequenciaService.getMonthlyRecords(month, year, { userId: employee.id }),
        calendarService.getMonthlyPolicies(month, year),
      ]);
      setRecords(buildMonthlyTimelineByPolicy(remoteRecords, month, year, employee.id, monthPolicies));
    } catch (err) {
      Alert.alert('Erro ao reabrir contestação', getErrorMessage(err, 'Não foi possível reabrir a contestação.'));
    } finally {
      setActionLoading((prev) => ({ ...prev, [date]: false }));
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
      {/* Perfil do funcionário */}
      <View style={styles.card}>
        {loading && !employee ? (
          <Text style={styles.cardText}>Carregando dados do funcionário...</Text>
        ) : !employee ? (
          <Text style={styles.cardText}>Funcionário não encontrado.</Text>
        ) : (
          <>
            <Text style={styles.cardTitle}>{employee.nome}</Text>
            <Text style={styles.cardText}>{employee.email}</Text>
            <Text style={styles.cardText}>
              {employee.tipo === 'gestor' ? 'Gestor' : 'Padrão'} · Horário:{' '}
              {employee.horarioEntradaEsperado} às {employee.horarioSaidaEsperado}
            </Text>
          </>
        )}
      </View>

      {/* Navegação de mês */}
      <View style={styles.monthBar}>
        <Pressable onPress={() => handleChangeMonth('prev')} style={styles.monthBtn}>
          <Text style={styles.monthBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{formatMonthLabel(month, year)}</Text>
        <Pressable onPress={() => handleChangeMonth('next')} style={styles.monthBtn}>
          <Text style={styles.monthBtnText}>›</Text>
        </Pressable>
      </View>

      {/* Resumo do mês */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryChip, { backgroundColor: '#21813818' }]}>
          <Text style={[styles.summaryNum, { color: theme.colors.success }]}>{presentCount}</Text>
          <Text style={[styles.summaryLbl, { color: theme.colors.success }]}>Presenças</Text>
        </View>
        <View style={[styles.summaryChip, { backgroundColor: '#C4453618' }]}>
          <Text style={[styles.summaryNum, { color: theme.colors.danger }]}>{missedCount}</Text>
          <Text style={[styles.summaryLbl, { color: theme.colors.danger }]}>Faltas</Text>
        </View>
        <View style={[styles.summaryChip, { backgroundColor: '#B7791F18' }]}>
          <Text style={[styles.summaryNum, { color: '#B7791F' }]}>{justifiedCount}</Text>
          <Text style={[styles.summaryLbl, { color: '#B7791F' }]}>Justificadas</Text>
        </View>
        {pendingCount > 0 ? (
          <View style={[styles.summaryChip, { backgroundColor: '#D5A02118' }]}>
            <Text style={[styles.summaryNum, { color: theme.colors.warning }]}>{pendingCount}</Text>
            <Text style={[styles.summaryLbl, { color: theme.colors.warning }]}>Pendentes</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Folha mensal do funcionário</Text>
        {!folha ? (
          <Text style={styles.cardText}>Nenhuma folha emitida para este período.</Text>
        ) : (
          <>
            <Text style={styles.recordTimeText}>Status: {folhaStatusLabel[folha.status] ?? folha.status}</Text>
            <Text style={styles.recordTimeText}>Resumo: {folha.snapshotResumo.presentes} presenças · {folha.snapshotResumo.faltas} faltas</Text>
            {folha.pdfFuncionarioAssinadoPath ? (
              <Text style={styles.recordHint}>Arquivo assinado: {folha.pdfFuncionarioAssinadoPath}</Text>
            ) : null}
            {folha.pdfGestorFinalPath ? <Text style={styles.recordHint}>Versão final: {folha.pdfGestorFinalPath}</Text> : null}
            {folha.motivoRejeicao ? <Text style={styles.observacao}>Motivo da última rejeição: {folha.motivoRejeicao}</Text> : null}

            {folha.status === 'enviada_funcionario' ? (
              <View style={styles.actionRow}>
                <AppButton
                  title="Aprovar revisão"
                  onPress={handleFolhaAprovar}
                  loading={reviewingFolha}
                  disabled={reviewingFolha}
                />
                <AppButton
                  title="Rejeitar"
                  variant="secondary"
                  onPress={() => setShowFolhaRejectForm(true)}
                  disabled={reviewingFolha}
                />
              </View>
            ) : null}

            {showFolhaRejectForm ? (
              <View style={styles.rejectForm}>
                <AppTextField
                  label="Motivo da rejeição"
                  multiline
                  onChangeText={setFolhaRejectMotivo}
                  placeholder="Explique o que o funcionário deve corrigir no envio..."
                  value={folhaRejectMotivo}
                />
                <View style={styles.actionRow}>
                  <AppButton
                    title="Confirmar rejeição"
                    onPress={handleFolhaRejeitar}
                    loading={reviewingFolha}
                    disabled={reviewingFolha}
                  />
                  <AppButton
                    title="Cancelar"
                    variant="secondary"
                    onPress={() => {
                      setShowFolhaRejectForm(false);
                      setFolhaRejectMotivo('');
                    }}
                    disabled={reviewingFolha}
                  />
                </View>
              </View>
            ) : null}

            {folha.status === 'em_revisao_gestor' ? (
              <AppButton
                title="Anexar versão final assinada"
                onPress={handleUploadFolhaFinal}
                variant="secondary"
                loading={reviewingFolha}
                disabled={reviewingFolha}
              />
            ) : null}
          </>
        )}
      </View>

      {/* Lista de registros */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Registros do mês</Text>

        {loading ? (
          <Text style={styles.cardText}>Carregando registros...</Text>
        ) : records.length === 0 ? (
          <Text style={styles.cardText}>Nenhum registro neste mês.</Text>
        ) : (
          records.map((record) => {
            const canReview = !record.isSynthetic && record.justificativaStatus === 'em_analise';
            const isRejecting = rejectingDate === record.data;
            const isContesting = contestingDate === record.data;
            const isReopening = reopeningDate === record.data;
            const contestacaoStatus = record.contestacaoStatus ?? 'sem_contestacao';
            const canContest = !record.isSynthetic && record.status === 'presente' && contestacaoStatus === 'sem_contestacao';
            const hasOpenContestacao = contestacaoStatus === 'em_contestacao' || contestacaoStatus === 'respondida';
            const canReopenContestacao = !record.isSynthetic && contestacaoStatus === 'encerrada';
            const isActing = Boolean(actionLoading[record.data]);

            return (
              <View key={record.id} style={styles.recordRow}>
                <View style={styles.recordHeader}>
                  <Text style={styles.recordDate}>{formatDisplayDate(record.data)}</Text>
                  <StatusBadge
                    pending={!record.isSynthetic && record.justificativaStatus === 'em_analise'}
                    status={record.status}
                  />
                </View>

                <Text style={styles.recordTimeText}>
                  Entrada: {formatTime(record.horaEntrada)} · Saída: {formatTime(record.horaSaida)}
                </Text>

                {record.justificativaStatus !== 'sem_justificativa' && record.justificativaStatus !== 'em_analise' ? (
                  <Text style={styles.recordHint}>
                    Justificativa: {getJustificativaStatusLabel(record.justificativaStatus)}
                  </Text>
                ) : null}

                {record.justificativaObservacaoGestor ? (
                  <Text style={styles.observacao}>Obs. gestor: {record.justificativaObservacaoGestor}</Text>
                ) : null}

                {record.contestacaoStatus && record.contestacaoStatus !== 'sem_contestacao' ? (
                  <Text style={styles.contestacaoHint}>
                    {CONTESTACAO_STATUS_LABELS[record.contestacaoStatus]}
                    {record.contestacaoCiclo ? ` · Ciclo ${record.contestacaoCiclo}` : ''}
                  </Text>
                ) : null}

                {record.contestacaoMotivo ? (
                  <Text style={styles.recordHint}>Motivo: {record.contestacaoMotivo}</Text>
                ) : null}

                {record.contestacaoRespostaFuncionario ? (
                  <View style={styles.respostaBox}>
                    <Text style={styles.respostaLabel}>Resposta do funcionário</Text>
                    <Text style={styles.respostaText}>{record.contestacaoRespostaFuncionario}</Text>
                  </View>
                ) : null}

                {record.contestacaoReaberturaMotivo ? (
                  <Text style={styles.recordHint}>Última reabertura: {record.contestacaoReaberturaMotivo}</Text>
                ) : null}

                {canReview && !isRejecting ? (
                  <View style={styles.actionRow}>
                    <AppButton
                      disabled={isActing}
                      loading={isActing}
                      onPress={() => handleValidate(record.data)}
                      title="Validar"
                    />
                    <AppButton
                      disabled={isActing}
                      onPress={() => { setRejectingDate(record.data); setRejectObservacao(''); }}
                      title="Recusar"
                      variant="secondary"
                    />
                  </View>
                ) : null}

                {isRejecting ? (
                  <View style={styles.rejectForm}>
                    <AppTextField
                      label="Motivo da recusa"
                      multiline
                      onChangeText={setRejectObservacao}
                      placeholder="Descreva o motivo..."
                      value={rejectObservacao}
                    />
                    <View style={styles.actionRow}>
                      <AppButton
                        disabled={isActing}
                        loading={isActing}
                        onPress={() => handleRejectConfirm(record.data)}
                        title="Confirmar recusa"
                      />
                      <AppButton
                        disabled={isActing}
                        onPress={() => { setRejectingDate(null); setRejectObservacao(''); }}
                        title="Cancelar"
                        variant="secondary"
                      />
                    </View>
                  </View>
                ) : null}

                {canContest && !isContesting ? (
                  <AppButton
                    disabled={isActing}
                    onPress={() => { setContestingDate(record.data); setContestMotivo(''); }}
                    title="Contestar presença"
                    variant="secondary"
                  />
                ) : null}

                {isContesting ? (
                  <View style={styles.rejectForm}>
                    <AppTextField
                      label="Motivo da contestação"
                      multiline
                      onChangeText={setContestMotivo}
                      placeholder="Descreva o motivo pelo qual a presença está sendo contestada..."
                      value={contestMotivo}
                    />
                    <View style={styles.actionRow}>
                      <AppButton
                        disabled={isActing}
                        loading={isActing}
                        onPress={() => handleContestConfirm(record.data)}
                        title="Confirmar contestação"
                      />
                      <AppButton
                        disabled={isActing}
                        onPress={() => { setContestingDate(null); setContestMotivo(''); }}
                        title="Cancelar"
                        variant="secondary"
                      />
                    </View>
                  </View>
                ) : null}

                {hasOpenContestacao ? (
                  <View style={styles.actionRow}>
                    <AppButton
                      disabled={isActing}
                      loading={isActing}
                      onPress={() => handleEncerrar(record.data, 'mantida_falta')}
                      title="Confirmar falta"
                    />
                    <AppButton
                      disabled={isActing}
                      loading={isActing}
                      onPress={() => handleEncerrar(record.data, 'revertida_presente')}
                      title="Reverter presença"
                      variant="secondary"
                    />
                  </View>
                ) : null}

                {canReopenContestacao && !isReopening ? (
                  <AppButton
                    disabled={isActing}
                    onPress={() => {
                      setReopeningDate(record.data);
                      setReopenMotivo('');
                    }}
                    title="Reabrir contestação"
                    variant="secondary"
                  />
                ) : null}

                {isReopening ? (
                  <View style={styles.rejectForm}>
                    <AppTextField
                      label="Motivo da reabertura"
                      multiline
                      onChangeText={setReopenMotivo}
                      placeholder="Descreva por que este caso precisa de nova rodada de análise..."
                      value={reopenMotivo}
                    />
                    <View style={styles.actionRow}>
                      <AppButton
                        disabled={isActing}
                        loading={isActing}
                        onPress={() => handleReopenConfirm(record.data)}
                        title="Confirmar reabertura"
                      />
                      <AppButton
                        disabled={isActing}
                        onPress={() => {
                          setReopeningDate(null);
                          setReopenMotivo('');
                        }}
                        title="Cancelar"
                        variant="secondary"
                      />
                    </View>
                  </View>
                ) : null}

                <Pressable onPress={() => handleOpenRecord(record.data)} style={styles.openLink}>
                  <Text style={styles.openLinkText}>Ver registro completo →</Text>
                </Pressable>
              </View>
            );
          })
        )}
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
  cardTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  cardText: {
    color: theme.colors.textMuted,
    lineHeight: 22,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    ...theme.shadow,
  },
  monthBtn: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  monthBtnText: {
    color: theme.colors.primary,
    fontSize: 24,
    fontWeight: '700',
  },
  monthLabel: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  summaryChip: {
    flex: 1,
    minWidth: 72,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    alignItems: 'center',
  },
  summaryNum: {
    fontSize: 22,
    fontWeight: '800',
  },
  summaryLbl: {
    fontSize: 11,
    fontWeight: '600',
  },
  recordRow: {
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  recordDate: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  recordTimeText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  recordHint: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
  },
  observacao: {
    color: theme.colors.danger,
    fontSize: 12,
    fontStyle: 'italic',
  },
  contestacaoHint: {
    color: '#7C3AED',
    fontSize: 12,
    fontWeight: '700',
  },
  respostaBox: {
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: '#DDD0F7',
    backgroundColor: '#F5F0FF',
    padding: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  respostaLabel: {
    color: '#5B21B6',
    fontWeight: '700',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  respostaText: {
    color: '#4C1D95',
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  rejectForm: {
    gap: theme.spacing.sm,
  },
  openLink: {
    alignSelf: 'flex-start',
  },
  openLinkText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});
