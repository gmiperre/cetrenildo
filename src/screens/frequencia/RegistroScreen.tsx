import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Timestamp } from 'firebase/firestore';
import * as DocumentPicker from 'expo-document-picker';

import { AppButton } from '../../components/AppButton';
import { AppTextField } from '../../components/AppTextField';
import { ScreenShell } from '../../components/ScreenShell';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { getContestacaoGuidance, getJustificativaGuidance, getJustificativaStatusLabel, getRegistroVisualStatus } from '../../domain/frequencia';
import { CalendarDay } from '../../models/calendar';
import { FrequenciaRegistro } from '../../models/frequencia';
import { calendarService } from '../../services/calendarService';
import { frequenciaService } from '../../services/frequenciaService';
import { absenceDocumentService } from '../../services/absenceDocumentService';
import { formatDisplayDate, formatTime, getTodayKey, isWorkdayForDate } from '../../utils/date';
import { getErrorMessage } from '../../utils/errors';
import { theme } from '../../utils/theme';
import { FrequenciaStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<FrequenciaStackParamList, 'Registro'>;
const MAX_ABSENCE_PDF_BYTES = 1 * 1024 * 1024;
const TIME_INPUT_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

type AttachedPdf = {
  name: string;
  mimeType: string;
  sizeBytes: number | null;
  uri?: string;
};

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

export function RegistroScreen({ route }: Props) {
  const { date, userId } = route.params;
  const { profile } = useAuth();
  const targetUserId = userId ?? profile?.id;
  const [record, setRecord] = useState<FrequenciaRegistro | null>(null);
  const [absenceExpanded, setAbsenceExpanded] = useState(false);
  const [absenceReason, setAbsenceReason] = useState('');
  const [attachedPdf, setAttachedPdf] = useState<AttachedPdf | null>(null);
  const [pickedNewPdf, setPickedNewPdf] = useState(false);
  const [declaringAbsence, setDeclaringAbsence] = useState(false);
  const [openingPdf, setOpeningPdf] = useState(false);
  const [observacaoGestor, setObservacaoGestor] = useState('');
  const [registeringPunch, setRegisteringPunch] = useState(false);
  const [dayPolicy, setDayPolicy] = useState<CalendarDay | null>(null);
  const [entradaInformada, setEntradaInformada] = useState('');
  const [saidaInformada, setSaidaInformada] = useState('');
  const [contestacaoResposta, setContestacaoResposta] = useState('');
  const [sendingContestacaoResposta, setSendingContestacaoResposta] = useState(false);
  const isOwnRecord = profile?.id === targetUserId;
  const hasRegisteredTimes = Boolean(record?.horaEntrada || record?.horaSaida);
  const justificativaStatus = record?.justificativaStatus ?? 'sem_justificativa';
  const hasActiveAbsenceFlow = justificativaStatus === 'em_analise' || justificativaStatus === 'validada';
  const hasRejectedAbsence = justificativaStatus === 'recusada';
  const hasDeclaredAbsence = Boolean(record?.justificativaTexto?.trim() && hasActiveAbsenceFlow);
  const contestacaoStatus = record?.contestacaoStatus ?? 'sem_contestacao';
  const hasOpenContestacao = contestacaoStatus === 'em_contestacao' || contestacaoStatus === 'respondida';
  const canRegisterPunchForDate = Boolean(isOwnRecord && date <= getTodayKey() && isWorkdayForDate(date, dayPolicy) && !hasDeclaredAbsence && !hasOpenContestacao && contestacaoStatus === 'sem_contestacao');
  const canDeclareAbsenceForDate = Boolean(isOwnRecord && date <= getTodayKey() && isWorkdayForDate(date, dayPolicy) && !hasRegisteredTimes);
  const statusPresentation = getRegistroVisualStatus(record);
  const canManagerReview = Boolean(profile?.tipo === 'gestor' && record?.justificativaTexto?.trim() && justificativaStatus === 'em_analise');
  const expectedEntryForDate = dayPolicy?.horarioEntradaOverride ?? profile?.horarioEntradaEsperado ?? '--:--';
  const expectedExitForDate = dayPolicy?.horarioSaidaOverride ?? profile?.horarioSaidaEsperado ?? '--:--';

  const loadRecord = useCallback(async () => {
    if (!targetUserId) {
      return;
    }

    const nextRecord = await frequenciaService.getRecordByDate(targetUserId, date);
    const nextDayPolicy = await calendarService.getByDate(date);
    setRecord(nextRecord);
    setDayPolicy(nextDayPolicy);
    setAbsenceReason(nextRecord?.justificativaTexto ?? '');
      setContestacaoResposta(nextRecord?.contestacaoRespostaFuncionario ?? '');
    setAttachedPdf(
      nextRecord?.justificativaDocumentoNome
        ? {
            name: nextRecord.justificativaDocumentoNome,
            mimeType: nextRecord.justificativaDocumentoMime ?? 'application/pdf',
            sizeBytes: nextRecord.justificativaDocumentoTamanhoBytes ?? null,
            uri: undefined,
          }
        : null,
    );
    setPickedNewPdf(false);
    setObservacaoGestor(nextRecord?.justificativaObservacaoGestor ?? '');
    if (nextRecord?.horaEntrada && nextRecord?.horaSaida) {
      setEntradaInformada(toInputTime(nextRecord.horaEntrada.toDate()));
      setSaidaInformada(toInputTime(nextRecord.horaSaida.toDate()));
      return;
    }

    setEntradaInformada(nextDayPolicy?.horarioEntradaOverride ?? profile?.horarioEntradaEsperado ?? '');
    setSaidaInformada(nextDayPolicy?.horarioSaidaOverride ?? profile?.horarioSaidaEsperado ?? '');
  }, [date, profile?.horarioEntradaEsperado, profile?.horarioSaidaEsperado, targetUserId]);

  useFocusEffect(
    useCallback(() => {
      loadRecord().catch(() => undefined);
    }, [loadRecord]),
  );

  const handlePickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: 'application/pdf',
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    const name = asset.name ?? 'comprovante.pdf';
    const mimeType = asset.mimeType ?? 'application/pdf';
    const isPdf = mimeType === 'application/pdf' || name.toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      Alert.alert('Arquivo inválido', 'Selecione um arquivo em formato .pdf.');
      return;
    }

    if (typeof asset.size === 'number' && asset.size > MAX_ABSENCE_PDF_BYTES) {
      Alert.alert('Arquivo muito grande', 'O comprovante deve ter no máximo 1 MB.');
      return;
    }

    setAttachedPdf({
      name,
      mimeType,
      sizeBytes: typeof asset.size === 'number' ? asset.size : null,
      uri: asset.uri,
    });
    setPickedNewPdf(true);
  };

  const handleDeclareAbsence = async () => {
    if (!profile || !targetUserId) {
      Alert.alert('Aguarde', 'Ainda estamos carregando seu perfil. Tente novamente em instantes.');
      return;
    }

    if (hasRegisteredTimes) {
      Alert.alert('Validação', 'Não é possível declarar ausência quando já existem horários registrados.');
      return;
    }

    if (!absenceReason.trim()) {
      Alert.alert('Validação', 'Descreva a justificativa da ausência.');
      return;
    }

    if (!attachedPdf) {
      Alert.alert('Validação', 'Anexe um comprovante em PDF para efetivar a ausência.');
      return;
    }

    if (attachedPdf.sizeBytes && attachedPdf.sizeBytes > MAX_ABSENCE_PDF_BYTES) {
      Alert.alert('Validação', 'O comprovante deve ter no máximo 1 MB.');
      return;
    }

    try {
      setDeclaringAbsence(true);
      let storagePath = record?.justificativaDocumentoStoragePath ?? null;
      const shouldUploadNewPdf = pickedNewPdf || !storagePath;

      if (shouldUploadNewPdf) {
        if (!attachedPdf.uri) {
          Alert.alert('Validação', 'Selecione novamente o PDF para efetivar a ausência.');
          return;
        }

        storagePath = await absenceDocumentService.uploadAbsencePdf({
          date,
          fileName: attachedPdf.name,
          fileUri: attachedPdf.uri,
          mimeType: attachedPdf.mimeType,
          userId: targetUserId,
        });
      }

      if (!storagePath) {
        Alert.alert('Validação', 'Selecione novamente o PDF para efetivar a ausência.');
        return;
      }

      const saved = await frequenciaService.updateRegistro({
        actorId: profile.id,
        data: date,
        userId: targetUserId,
        justificativaTexto: absenceReason.trim(),
        justificativaCanal: 'pdf',
        justificativaStatus: 'em_analise',
        justificativaEmailEnviado: false,
        justificativaEmailEm: null,
        justificativaEmailAssunto: null,
        justificativaEmailProtocolo: null,
        justificativaDocumentoNome: attachedPdf.name,
        justificativaDocumentoMime: attachedPdf.mimeType,
        justificativaDocumentoTamanhoBytes: attachedPdf.sizeBytes,
        justificativaDocumentoAnexadoEm: Timestamp.now(),
        justificativaDocumentoStoragePath: storagePath,
        justificativaObservacaoGestor: null,
        justificativaValidadaPor: null,
        justificativaValidadaEm: null,
      });
      const refreshed = await frequenciaService.getRecordByDate(targetUserId, date);
      setRecord(refreshed ?? saved);
      setPickedNewPdf(false);
      setAbsenceExpanded(false);
      Alert.alert('Enviado para análise', 'A justificativa foi reenviada com sucesso e voltou para análise do gestor.');
    } catch (error) {
      Alert.alert('Falha ao declarar ausência', getErrorMessage(error, 'Não foi possível salvar a declaração.'));
    } finally {
      setDeclaringAbsence(false);
    }
  };

  const handleOpenPdf = async () => {
    const path = record?.justificativaDocumentoStoragePath;
    if (!path) {
      Alert.alert('Comprovante indisponível', 'Este registro ainda não possui arquivo para download.');
      return;
    }

    try {
      setOpeningPdf(true);
      const url = await absenceDocumentService.createDownloadUrl(path);
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Falha ao abrir comprovante', getErrorMessage(error, 'Não foi possível gerar o link do PDF.'));
    } finally {
      setOpeningPdf(false);
    }
  };

  const handleConfirm = async () => {
    if (!profile || !targetUserId) {
      return;
    }

    try {
      const nextRecord = await frequenciaService.confirmRegistro(targetUserId, date, profile.id);
      setRecord(nextRecord);
      Alert.alert('Registro confirmado', 'Sua assinatura foi registrada.');
    } catch (error) {
      Alert.alert('Falha ao confirmar', getErrorMessage(error, 'Tente novamente.'));
    }
  };

  const handleValidate = async () => {
    if (!profile || !targetUserId) {
      return;
    }

    if (!record?.justificativaTexto?.trim()) {
      Alert.alert('Validação', 'Preencha a justificativa para continuar.');
      return;
    }

    const hasEmailProof = record.justificativaEmailEnviado && Boolean(record.justificativaEmailAssunto?.trim());
    const hasPdfProof = Boolean(record.justificativaDocumentoNome?.trim());
    if (!hasEmailProof && !hasPdfProof) {
      Alert.alert('Validação', 'É necessário ter um comprovante (e-mail ou PDF) para validação.');
      return;
    }

    try {
      const nextRecord = await frequenciaService.validateRegistro(targetUserId, date, profile.id);
      setRecord(nextRecord);
      Alert.alert('Justificativa validada', 'Justificativa validada pelo gestor.');
    } catch (error) {
      Alert.alert('Falha ao validar', getErrorMessage(error, 'Tente novamente.'));
    }
  };

  const handleRegisterPunchForDate = async () => {
    if (!profile || !isOwnRecord) {
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
      setRegisteringPunch(true);
      const nextRecord = await frequenciaService.registerPunch(profile, date, {
        entryTime: entradaInformada,
        exitTime: saidaInformada,
      });
      setRecord(nextRecord);

      const isRetroactive = date < getTodayKey();
      Alert.alert(
        'Ponto registrado',
        isRetroactive
          ? 'Presença registrada com horário esperado para o dia selecionado.'
          : (nextRecord.horaSaida ? 'Saída registrada com sucesso.' : 'Entrada registrada com sucesso.'),
      );
    } catch (error) {
      Alert.alert('Falha ao bater ponto', getErrorMessage(error, 'Não foi possível registrar o ponto.'));
    } finally {
      setRegisteringPunch(false);
    }
  };

  const handleUseExpectedSchedule = () => {
    setEntradaInformada(expectedEntryForDate === '--:--' ? '' : expectedEntryForDate);
    setSaidaInformada(expectedExitForDate === '--:--' ? '' : expectedExitForDate);
  };

  const handleReject = async () => {
    if (!profile || !targetUserId) {
      return;
    }

    if (!observacaoGestor.trim()) {
      Alert.alert('Validação', 'Informe o motivo da recusa.');
      return;
    }

    try {
      const nextRecord = await frequenciaService.rejectRegistro(targetUserId, date, profile.id, observacaoGestor);
      setRecord(nextRecord);
      Alert.alert('Justificativa recusada', 'Justificativa recusada. Verifique a observação do gestor.');
    } catch (error) {
      Alert.alert('Falha ao recusar', getErrorMessage(error, 'Tente novamente.'));
    }
  };

  const handleSendContestacaoResposta = async () => {
    if (!profile || !targetUserId) return;
    if (!contestacaoResposta.trim()) {
      Alert.alert('Atenção', 'Descreva sua resposta antes de enviar.');
      return;
    }
    try {
      setSendingContestacaoResposta(true);
      const nextRecord = await frequenciaService.respondContestacao(targetUserId, date, contestacaoResposta);
      setRecord(nextRecord);
      Alert.alert('Resposta enviada', 'Sua resposta foi registrada e encaminhada ao gestor para decisão final.');
    } catch (error) {
      Alert.alert('Falha ao enviar resposta', getErrorMessage(error, 'Tente novamente.'));
    } finally {
      setSendingContestacaoResposta(false);
    }
  };

  const statusJustificativaLabel = getJustificativaStatusLabel(record?.justificativaStatus);
  const contestacaoGuidance = getContestacaoGuidance(record, profile?.tipo === 'gestor');

  return (
    <ScreenShell>
      <View style={styles.card}>
        <Text style={styles.title}>{formatDisplayDate(date)}</Text>
        {dayPolicy ? (
          <Text style={styles.policyText}>
            {dayPolicy.tipo === 'feriado'
              ? 'Feriado'
              : dayPolicy.tipo === 'ponto_facultativo'
              ? 'Ponto facultativo'
              : dayPolicy.tipo === 'sem_expediente'
              ? 'Sem expediente'
              : 'Dia útil com política'}
            {dayPolicy.motivo ? ` - ${dayPolicy.motivo}` : ''}
          </Text>
        ) : null}
        <StatusBadge
          labelOverride={statusPresentation.label}
          pending={Boolean(record?.horaEntrada && !record?.horaSaida)}
          status={statusPresentation.status}
        />
        <Text style={styles.line}>Entrada: {formatTime(record?.horaEntrada)}</Text>
        <Text style={styles.line}>Saída: {formatTime(record?.horaSaida)}</Text>
        {canRegisterPunchForDate ? (
          <View style={styles.manualTimeBox}>
            <Text style={styles.manualTimeTitle}>Preenchimento manual</Text>
            <Text style={styles.line}>Esperado para o dia: {expectedEntryForDate} às {expectedExitForDate}</Text>
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
            <AppButton onPress={handleUseExpectedSchedule} title="Usar horário esperado" variant="secondary" />
          </View>
        ) : null}
        <View style={styles.guidanceBox}>
          <Text style={styles.guidanceTitle}>{profile?.tipo === 'gestor' ? 'Situação da análise' : 'Situação da sua solicitação'}</Text>
          <Text style={styles.guidanceText}>{getJustificativaGuidance(record, profile?.tipo === 'gestor')}</Text>
        </View>
        {canRegisterPunchForDate ? (
          <View style={styles.actionRow}>
            <View style={styles.actionColumn}>
              <AppButton
                loading={registeringPunch}
                onPress={handleRegisterPunchForDate}
                title={date < getTodayKey() ? 'Registrar presença' : 'Bater ponto'}
              />
            </View>
            <View style={styles.actionColumn}>
              <AppButton
                onPress={() => setAbsenceExpanded((previous) => !previous)}
                title={absenceExpanded ? 'Fechar ausência' : 'Declarar ausência'}
                variant="secondary"
              />
            </View>
          </View>
        ) : null}

        {canDeclareAbsenceForDate && absenceExpanded ? (
          <View style={styles.absenceBox}>
            <Text style={styles.subtitle}>Declarar ausência</Text>
            <AppTextField
              label="Justificativa"
              multiline
              onChangeText={setAbsenceReason}
              placeholder="Descreva de forma objetiva o motivo da ausência deste dia."
              value={absenceReason}
            />

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Comprovante obrigatório</Text>
              <Text style={styles.infoText}>Para efetivar a ausência, anexe um arquivo em PDF com tamanho máximo de 1 MB.</Text>
            </View>

            <AppButton onPress={handlePickPdf} title={attachedPdf ? 'Trocar PDF' : 'Anexar PDF'} variant="ghost" />

            {attachedPdf ? (
              <View style={styles.fileSummary}>
                <Text style={styles.fileSummaryText}>Arquivo: {attachedPdf.name}</Text>
                <Text style={styles.fileSummaryText}>
                  Tamanho: {typeof attachedPdf.sizeBytes === 'number' ? `${(attachedPdf.sizeBytes / 1024).toFixed(0)} KB` : 'Não informado pelo dispositivo'}
                </Text>
              </View>
            ) : (
              <Text style={styles.helperText}>Nenhum PDF anexado.</Text>
            )}

            <AppButton
              loading={declaringAbsence}
              onPress={handleDeclareAbsence}
              title="Enviar para análise do gestor"
            />
          </View>
        ) : null}

        {hasDeclaredAbsence && !absenceExpanded ? (
          <View style={styles.submittedBox}>
            <Text style={styles.submittedTitle}>{justificativaStatus === 'validada' ? 'Ausência justificada' : 'Ausência declarada'}</Text>
            <Text style={styles.submittedText}>
              {justificativaStatus === 'validada'
                ? 'A justificativa foi aprovada pelo gestor.'
                : 'Justificativa enviada e aguardando decisão do gestor.'}
            </Text>
            {record?.justificativaDocumentoNome ? <Text style={styles.submittedText}>PDF anexado: {record.justificativaDocumentoNome}</Text> : null}
          </View>
        ) : null}

        {hasRejectedAbsence && !absenceExpanded ? (
          <View style={styles.rejectedBox}>
            <Text style={styles.rejectedTitle}>Justificativa recusada</Text>
            <Text style={styles.rejectedText}>Você pode ajustar a justificativa, trocar o PDF e reenviar para nova análise.</Text>
            <AppButton onPress={() => setAbsenceExpanded(true)} title="Reenviar justificativa" variant="secondary" />
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.subtitle}>Justificativa e análise</Text>
        <Text style={styles.line}>Status da justificativa: {statusJustificativaLabel}</Text>
        {record?.justificativaTexto ? (
          <View style={styles.justificativaBox}>
            <Text style={styles.justificativaLabel}>Justificativa enviada</Text>
            <Text style={styles.justificativaText}>{record.justificativaTexto}</Text>
          </View>
        ) : null}
        {record?.justificativaDocumentoNome ? (
          <Text style={styles.line}>Comprovante PDF: {record.justificativaDocumentoNome}</Text>
        ) : null}
        {profile?.tipo === 'gestor' && record?.justificativaDocumentoStoragePath ? (
          <AppButton loading={openingPdf} onPress={handleOpenPdf} title="Baixar comprovante (PDF)" variant="ghost" />
        ) : null}
        {record?.justificativaObservacaoGestor && record?.justificativaStatus === 'recusada' ? (
          <View style={styles.managerNoteBox}>
            <Text style={styles.managerNoteTitle}>Observação do gestor</Text>
            <Text style={styles.managerNoteText}>{record.justificativaObservacaoGestor}</Text>
          </View>
        ) : null}
        {isOwnRecord && !hasDeclaredAbsence && contestacaoStatus === 'sem_contestacao' ? <AppButton onPress={handleConfirm} title="Confirmar registro" variant="secondary" /> : null}
        {canManagerReview ? (
          <>
            <View style={styles.reviewDivider} />
            <Text style={styles.subtitle}>Decisão do gestor</Text>
            <Text style={styles.helperText}>Revise a justificativa e o comprovante antes de aprovar ou recusar.</Text>
            <AppButton onPress={handleValidate} title="Aprovar justificativa" />
            <AppTextField
              label="Observação do gestor"
              multiline
              onChangeText={setObservacaoGestor}
              placeholder="Descreva de forma objetiva o motivo da recusa para orientar o colaborador."
              value={observacaoGestor}
            />
            <AppButton disabled={!observacaoGestor.trim()} onPress={handleReject} title="Recusar justificativa" variant="secondary" />
          </>
        ) : null}
      </View>

      {hasOpenContestacao || contestacaoStatus === 'encerrada' ? (
        <View style={[styles.card, styles.contestacaoCard]}>
          <Text style={styles.contestacaoTitle}>Contestação de presença</Text>
          <Text style={styles.contestacaoText}>Ciclo atual: {record?.contestacaoCiclo ?? 0}</Text>
          <Text style={styles.contestacaoText}>{contestacaoGuidance}</Text>
          {record?.contestacaoReaberturaMotivo ? (
            <Text style={styles.contestacaoText}>Última reabertura: {record.contestacaoReaberturaMotivo}</Text>
          ) : null}
          {record?.contestacaoRespostaFuncionario ? (
            <View style={styles.contestacaoRespostaBox}>
              <Text style={styles.contestacaoRespostaLabel}>Resposta do funcionário</Text>
              <Text style={styles.contestacaoText}>{record.contestacaoRespostaFuncionario}</Text>
            </View>
          ) : null}
          {isOwnRecord && contestacaoStatus === 'em_contestacao' ? (
            <>
              <AppTextField
                label="Sua resposta"
                multiline
                onChangeText={setContestacaoResposta}
                placeholder="Descreva sua versão dos fatos de forma objetiva..."
                value={contestacaoResposta}
              />
              <AppButton
                loading={sendingContestacaoResposta}
                onPress={handleSendContestacaoResposta}
                title="Enviar resposta ao gestor"
              />
            </>
          ) : null}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.subtitle}>Assinaturas</Text>
        <Text style={styles.line}>Usuário: {record?.assinaturaUsuario.confirmado ? 'Confirmado' : 'Pendente'}</Text>
        <Text style={styles.line}>Gestor: {record?.assinaturaGestor.confirmado ? 'Validado' : 'Pendente'}</Text>
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
  title: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  line: {
    color: theme.colors.textMuted,
    fontSize: 15,
  },
  manualTimeBox: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  manualTimeTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  guidanceBox: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#E4D4AF',
    backgroundColor: '#FFF7E8',
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  guidanceTitle: {
    color: '#8A5A12',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  guidanceText: {
    color: '#6E4A10',
    lineHeight: 21,
  },
  policyText: {
    color: theme.colors.info,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  infoBox: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  infoTitle: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  infoText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionColumn: {
    flex: 1,
  },
  absenceBox: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  helperText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  fileSummary: {
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.sm,
    gap: 2,
  },
  fileSummaryText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  submittedBox: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#D7E6D3',
    backgroundColor: '#F1F8EF',
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  submittedTitle: {
    color: theme.colors.success,
    fontSize: 14,
    fontWeight: '700',
  },
  submittedText: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  rejectedBox: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#F1C5BE',
    backgroundColor: '#FFF1EE',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  rejectedTitle: {
    color: theme.colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  rejectedText: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  justificativaBox: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  justificativaLabel: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  justificativaText: {
    color: theme.colors.textMuted,
    lineHeight: 21,
  },
  contestacaoCard: {
    borderColor: '#DDD0F7',
    borderWidth: 1,
    backgroundColor: '#F5F0FF',
  },
  contestacaoTitle: {
    color: '#5B21B6',
    fontSize: 15,
    fontWeight: '700',
  },
  contestacaoText: {
    color: '#4C1D95',
    lineHeight: 21,
    fontSize: 14,
  },
  contestacaoRespostaBox: {
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: '#DDD0F7',
    backgroundColor: '#EDE9FE',
    padding: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  contestacaoRespostaLabel: {
    color: '#5B21B6',
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  managerNoteBox: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#F1C5BE',
    backgroundColor: '#FFF1EE',
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  managerNoteTitle: {
    color: theme.colors.danger,
    fontWeight: '700',
    fontSize: 13,
  },
  managerNoteText: {
    color: theme.colors.textMuted,
    lineHeight: 21,
  },
  reviewDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.xs,
  },
});