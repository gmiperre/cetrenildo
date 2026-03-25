import { Timestamp } from 'firebase/firestore';

import { FrequenciaRegistro, JustificativaStatus, RegistroUpdateInput } from '../models/frequencia';

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
  const justificativaTexto = input.justificativaTexto ?? baseRecord.justificativaTexto;
  const justificativaEmailEnviado = input.justificativaEmailEnviado ?? baseRecord.justificativaEmailEnviado;
  const justificativaStatus = computeJustificativaStatus(
    input.justificativaStatus,
    justificativaTexto,
    justificativaEmailEnviado,
  );
  const hasTexto = (justificativaTexto ?? '').trim().length > 0;

  return {
    justificativaTexto,
    justificativaCanal: input.justificativaCanal ?? (hasTexto ? 'email' : null),
    justificativaStatus,
    justificativaEmailEnviado,
    justificativaEmailEm: input.justificativaEmailEm ?? (justificativaEmailEnviado ? (baseRecord.justificativaEmailEm ?? now) : null),
    justificativaEmailAssunto: input.justificativaEmailAssunto ?? baseRecord.justificativaEmailAssunto,
    justificativaEmailProtocolo: input.justificativaEmailProtocolo ?? baseRecord.justificativaEmailProtocolo,
    justificativaObservacaoGestor: input.justificativaObservacaoGestor ?? baseRecord.justificativaObservacaoGestor,
    justificativaValidadaPor: input.justificativaValidadaPor ?? baseRecord.justificativaValidadaPor,
    justificativaValidadaEm: input.justificativaValidadaEm ?? baseRecord.justificativaValidadaEm,
  };
};