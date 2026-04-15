import { Timestamp } from 'firebase/firestore';

import { FrequenciaRegistro, JustificativaStatus, RegistroStatus, RegistroUpdateInput } from '../models/frequencia';

export const JUSTIFICATIVA_STATUS_LABELS: Record<JustificativaStatus, string> = {
  sem_justificativa: 'Sem justificativa',
  pendente_envio: 'Pendente envio',
  em_analise: 'Em análise',
  validada: 'Validada',
  recusada: 'Recusada',
};

export const getJustificativaStatusLabel = (status?: JustificativaStatus | null) => {
  if (!status) {
    return JUSTIFICATIVA_STATUS_LABELS.sem_justificativa;
  }

  return JUSTIFICATIVA_STATUS_LABELS[status] ?? JUSTIFICATIVA_STATUS_LABELS.sem_justificativa;
};

export const computeJustificativaStatus = (
  explicitStatus: RegistroUpdateInput['justificativaStatus'],
  justificativaTexto: string | null | undefined,
  justificativaEmailEnviado: boolean,
): JustificativaStatus => {
  if (explicitStatus) {
    return explicitStatus;
  }

  const hasTexto = (justificativaTexto ?? '').trim().length > 0;
  if (!hasTexto) {
    return 'sem_justificativa';
  }

  return justificativaEmailEnviado ? 'em_analise' : 'pendente_envio';
};

export const buildJustificativaUpdateState = (
  baseRecord: FrequenciaRegistro,
  input: RegistroUpdateInput,
  now: Timestamp,
) => {
  const hasField = <TKey extends keyof RegistroUpdateInput>(key: TKey) => Object.prototype.hasOwnProperty.call(input, key);
  const pickField = <TKey extends keyof RegistroUpdateInput, TValue>(key: TKey, fallback: TValue) => {
    return hasField(key) ? (input[key] as TValue) : fallback;
  };

  const justificativaTexto = pickField('justificativaTexto', baseRecord.justificativaTexto);
  const justificativaEmailEnviado = pickField('justificativaEmailEnviado', baseRecord.justificativaEmailEnviado);
  const justificativaDocumentoNome = pickField('justificativaDocumentoNome', baseRecord.justificativaDocumentoNome);
  const justificativaDocumentoMime = pickField('justificativaDocumentoMime', baseRecord.justificativaDocumentoMime);
  const justificativaDocumentoTamanhoBytes = pickField('justificativaDocumentoTamanhoBytes', baseRecord.justificativaDocumentoTamanhoBytes);
  const justificativaDocumentoAnexadoEm = hasField('justificativaDocumentoAnexadoEm')
    ? (input.justificativaDocumentoAnexadoEm as Timestamp | null)
    : (justificativaDocumentoNome ? (baseRecord.justificativaDocumentoAnexadoEm ?? now) : null);
  const justificativaDocumentoStoragePath = pickField('justificativaDocumentoStoragePath', baseRecord.justificativaDocumentoStoragePath);
  const justificativaStatus = computeJustificativaStatus(
    input.justificativaStatus,
    justificativaTexto,
    justificativaEmailEnviado,
  );
  const hasTexto = (justificativaTexto ?? '').trim().length > 0;

  return {
    justificativaTexto,
    justificativaCanal: input.justificativaCanal ?? (hasTexto ? (justificativaDocumentoNome ? 'pdf' : 'email') : null),
    justificativaStatus,
    justificativaEmailEnviado,
    justificativaEmailEm: hasField('justificativaEmailEm')
      ? (input.justificativaEmailEm as Timestamp | null)
      : (justificativaEmailEnviado ? (baseRecord.justificativaEmailEm ?? now) : null),
    justificativaEmailAssunto: pickField('justificativaEmailAssunto', baseRecord.justificativaEmailAssunto),
    justificativaEmailProtocolo: pickField('justificativaEmailProtocolo', baseRecord.justificativaEmailProtocolo),
    justificativaDocumentoNome,
    justificativaDocumentoMime,
    justificativaDocumentoTamanhoBytes,
    justificativaDocumentoAnexadoEm,
    justificativaDocumentoStoragePath,
    justificativaObservacaoGestor: pickField('justificativaObservacaoGestor', baseRecord.justificativaObservacaoGestor),
    justificativaValidadaPor: pickField('justificativaValidadaPor', baseRecord.justificativaValidadaPor),
    justificativaValidadaEm: pickField('justificativaValidadaEm', baseRecord.justificativaValidadaEm),
  };
};

type RegistroVisualSnapshot = Pick<FrequenciaRegistro, 'status' | 'justificativaStatus'> | null | undefined;

export const getRegistroVisualStatus = (record?: RegistroVisualSnapshot): { status: RegistroStatus; label: string } => {
  if (!record) {
    return { status: 'falta', label: 'Falta' };
  }

  if (record.justificativaStatus === 'recusada') {
    return { status: 'falta', label: 'Falta com justificativa recusada' };
  }

  if (record.justificativaStatus === 'em_analise') {
    return { status: 'falta_justificada', label: 'Falta em análise' };
  }

  if (record.justificativaStatus === 'validada') {
    return { status: 'falta_justificada', label: 'Falta justificada' };
  }

  if (record.status === 'falta_justificada') {
    return { status: 'falta_justificada', label: 'Falta justificada' };
  }

  if (record.status === 'abono') {
    return { status: 'abono', label: 'Abono' };
  }

  if (record.status === 'presente') {
    return { status: 'presente', label: 'Presente' };
  }

  if (record.status === 'presenca_contestada') {
    return { status: 'presenca_contestada', label: 'Presença contestada' };
  }

  return { status: 'falta', label: 'Falta' };
};

export const getJustificativaGuidance = (record?: RegistroVisualSnapshot, isManager = false) => {
  if (!record || record.justificativaStatus === 'sem_justificativa') {
    return isManager
      ? 'Nenhuma justificativa foi enviada para este dia.'
      : 'Se houver ausência, envie a justificativa com comprovante para análise.';
  }

  if (record.justificativaStatus === 'em_analise') {
    return isManager
      ? 'A justificativa foi enviada e aguarda sua decisão.'
      : 'Sua justificativa foi enviada e está aguardando análise do gestor.';
  }

  if (record.justificativaStatus === 'validada') {
    return isManager
      ? 'A justificativa já foi aprovada.'
      : 'Sua justificativa foi aprovada pelo gestor.';
  }

  if (record.justificativaStatus === 'recusada') {
    return isManager
      ? 'A justificativa foi recusada. Oriente o colaborador com clareza.'
      : 'Sua justificativa foi recusada. Revise a observação do gestor.';
  }

  return isManager
    ? 'A justificativa foi recebida, mas ainda falta concluir a análise.'
    : 'Sua justificativa ainda não foi concluída.';
};

export const CONTESTACAO_STATUS_LABELS: Record<import('../models/frequencia').ContestacaoStatus, string> = {
  sem_contestacao: 'Sem contestação',
  em_contestacao: 'Em contestação — aguardando resposta',
  respondida: 'Respondida — aguardando decisão',
  encerrada: 'Encerrada',
};

export const getContestacaoGuidance = (
  record: Pick<import('../models/frequencia').FrequenciaRegistro, 'contestacaoStatus' | 'contestacaoDecisao' | 'contestacaoMotivo'> | null | undefined,
  isManager = false,
): string => {
  if (!record || record.contestacaoStatus === 'sem_contestacao') {
    return '';
  }

  if (record.contestacaoStatus === 'em_contestacao') {
    return isManager
      ? `Contestação iniciada. Aguardando resposta do funcionário.\nMotivo: ${record.contestacaoMotivo ?? '—'}`
      : `O gestor contestou sua presença neste dia.\nMotivo registrado: ${record.contestacaoMotivo ?? '—'}\nVocê pode enviar sua versão dos fatos antes da decisão final.`;
  }

  if (record.contestacaoStatus === 'respondida') {
    return isManager
      ? 'O funcionário enviou uma resposta. Analise e tome a decisão final.'
      : 'Resposta enviada. Aguardando decisão final do gestor.';
  }

  if (record.contestacaoStatus === 'encerrada') {
    const decisao = record.contestacaoDecisao === 'mantida_falta'
      ? 'o gestor confirmou a falta'
      : 'o gestor reverteu para presença';
    return isManager
      ? `Contestação encerrada: ${decisao}.`
      : `Contestação encerrada: ${decisao}.`;
  }

  return '';
};