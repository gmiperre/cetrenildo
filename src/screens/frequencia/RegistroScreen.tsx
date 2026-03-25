import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Timestamp } from 'firebase/firestore';

import { AppButton } from '../../components/AppButton';
import { AppTextField } from '../../components/AppTextField';
import { ScreenShell } from '../../components/ScreenShell';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { getJustificativaStatusLabel } from '../../domain/frequencia';
import { FrequenciaRegistro } from '../../models/frequencia';
import { frequenciaService } from '../../services/frequenciaService';
import { formatDisplayDate, formatTime } from '../../utils/date';
import { getErrorMessage } from '../../utils/errors';
import { theme } from '../../utils/theme';
import { FrequenciaStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<FrequenciaStackParamList, 'Registro'>;

export function RegistroScreen({ route }: Props) {
  const { date, userId } = route.params;
  const { profile } = useAuth();
  const targetUserId = userId ?? profile?.id;
  const [record, setRecord] = useState<FrequenciaRegistro | null>(null);
  const [justificativaTexto, setJustificativaTexto] = useState('');
  const [emailEnviado, setEmailEnviado] = useState(false);
  const [emailAssunto, setEmailAssunto] = useState('');
  const [emailProtocolo, setEmailProtocolo] = useState('');
  const [observacaoGestor, setObservacaoGestor] = useState('');
  const [saving, setSaving] = useState(false);

  const loadRecord = useCallback(async () => {
    if (!targetUserId) {
      return;
    }

    const nextRecord = await frequenciaService.getRecordByDate(targetUserId, date);
    setRecord(nextRecord);
    setJustificativaTexto(nextRecord?.justificativaTexto ?? '');
    setEmailEnviado(nextRecord?.justificativaEmailEnviado ?? false);
    setEmailAssunto(nextRecord?.justificativaEmailAssunto ?? '');
    setEmailProtocolo(nextRecord?.justificativaEmailProtocolo ?? '');
    setObservacaoGestor(nextRecord?.justificativaObservacaoGestor ?? '');
  }, [date, targetUserId]);

  useFocusEffect(
    useCallback(() => {
      loadRecord().catch(() => undefined);
    }, [loadRecord]),
  );

  const handleSave = async () => {
    if (!profile || !targetUserId) {
      return;
    }

    if (!justificativaTexto.trim() && (record?.status === 'falta' || record?.status === 'abono')) {
      Alert.alert('Validação', 'Preencha a justificativa para continuar.');
      return;
    }

    if (emailEnviado && !emailAssunto.trim()) {
      Alert.alert('Validação', 'Informe o assunto do e-mail enviado.');
      return;
    }

    try {
      setSaving(true);
      const saved = await frequenciaService.updateRegistro({
        actorId: profile.id,
        data: date,
        userId: targetUserId,
        justificativaTexto,
        justificativaCanal: justificativaTexto.trim() ? 'email' : null,
        justificativaEmailEnviado: emailEnviado,
        justificativaEmailEm: emailEnviado ? (record?.justificativaEmailEm ?? Timestamp.now()) : null,
        justificativaEmailAssunto: emailEnviado ? emailAssunto.trim() : null,
        justificativaEmailProtocolo: emailEnviado ? (emailProtocolo.trim() || null) : null,
        justificativaObservacaoGestor: record?.justificativaObservacaoGestor ?? null,
        status: record?.status,
      });
      setRecord(saved);
      Alert.alert('Justificativa salva', 'Dados de justificativa registrados com sucesso.');
    } catch (error) {
      Alert.alert('Falha ao salvar', getErrorMessage(error, 'Não foi possível salvar.'));
    } finally {
      setSaving(false);
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

    if (!record.justificativaEmailEnviado) {
      Alert.alert('Validação', 'Marque que o comprovante foi enviado por e-mail.');
      return;
    }

    if (!record.justificativaEmailAssunto?.trim()) {
      Alert.alert('Validação', 'Informe o assunto do e-mail enviado.');
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

  const statusJustificativaLabel = getJustificativaStatusLabel(record?.justificativaStatus);

  return (
    <ScreenShell>
      <View style={styles.card}>
        <Text style={styles.title}>{formatDisplayDate(date)}</Text>
        <StatusBadge pending={Boolean(record?.horaEntrada && !record?.horaSaida)} status={record?.status ?? 'falta'} />
        <Text style={styles.line}>Entrada: {formatTime(record?.horaEntrada)}</Text>
        <Text style={styles.line}>Saída: {formatTime(record?.horaSaida)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.subtitle}>Justificativa da ocorrência</Text>
        <AppTextField
          label="Justificativa"
          multiline
          onChangeText={setJustificativaTexto}
          placeholder="Descreva de forma objetiva o motivo da ausência/ajuste deste dia."
          value={justificativaTexto}
        />

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Envio de comprovante por e-mail (obrigatório)</Text>
          <Text style={styles.infoText}>Anexos não são enviados pelo app nesta fase. Envie o comprovante para o e-mail oficial do RH e registre abaixo os dados de envio.</Text>
          <Text style={styles.infoText}>Destinatário RH: rh@empresa.com</Text>
          <Text style={styles.infoText}>Use este assunto: JUSTIFICATIVA | MATRÍCULA | YYYY-MM-DD | TIPO</Text>
        </View>

        <Pressable onPress={() => setEmailEnviado((previous) => !previous)} style={[styles.checkboxRow, emailEnviado && styles.checkboxRowActive]}>
          <Text style={[styles.checkboxMark, emailEnviado && styles.checkboxMarkActive]}>{emailEnviado ? '✓' : ''}</Text>
          <Text style={styles.checkboxLabel}>Comprovante enviado por e-mail</Text>
        </Pressable>

        <AppTextField label="Assunto do e-mail" onChangeText={setEmailAssunto} placeholder="Cole aqui o assunto enviado" value={emailAssunto} />
        <AppTextField label="Protocolo/message-id" onChangeText={setEmailProtocolo} placeholder="Opcional, mas recomendado" value={emailProtocolo} />

        <Text style={styles.line}>Status da justificativa: {statusJustificativaLabel}</Text>
        {record?.justificativaObservacaoGestor ? <Text style={styles.line}>Observação do gestor: {record.justificativaObservacaoGestor}</Text> : null}

        <AppButton loading={saving} onPress={handleSave} title="Salvar justificativa" />
      </View>

      <View style={styles.card}>
        <Text style={styles.subtitle}>Assinaturas</Text>
        <Text style={styles.line}>Usuário: {record?.assinaturaUsuario.confirmado ? 'Confirmado' : 'Pendente'}</Text>
        <Text style={styles.line}>Gestor: {record?.assinaturaGestor.confirmado ? 'Validado' : 'Pendente'}</Text>
        {profile?.id === targetUserId ? <AppButton onPress={handleConfirm} title="Confirmar registro" variant="secondary" /> : null}
        {profile?.tipo === 'gestor' ? (
          <>
            <AppButton onPress={handleValidate} title="Validar justificativa" variant="ghost" />
            <AppTextField
              label="Observação do gestor"
              multiline
              onChangeText={setObservacaoGestor}
              placeholder="Descreva de forma objetiva o motivo da recusa para orientar o colaborador."
              value={observacaoGestor}
            />
            <AppButton onPress={handleReject} title="Recusar justificativa" variant="secondary" />
          </>
        ) : null}
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  checkboxRowActive: {
    borderColor: theme.colors.primary,
  },
  checkboxMark: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    textAlign: 'center',
    color: '#FFFFFF',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  checkboxMarkActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkboxLabel: {
    color: theme.colors.text,
    fontWeight: '600',
    flex: 1,
  },
});