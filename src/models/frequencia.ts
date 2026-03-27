import { Timestamp } from 'firebase/firestore';

import { UserProfile } from './user';

export type RegistroStatus = 'presente' | 'falta' | 'abono';
export type LogAction = 'create' | 'update' | 'approve';
export type OfflineActionType = 'registerPunch' | 'updateRegistro' | 'confirmRegistro' | 'validateRegistro' | 'rejectRegistro';
export type JustificativaCanal = 'email' | null;
export type JustificativaStatus = 'sem_justificativa' | 'pendente_envio' | 'em_analise' | 'validada' | 'recusada';

export interface RegistroAssinatura {
  confirmado: boolean;
  userId: string | null;
  timestamp: Timestamp | null;
}

export interface FrequenciaRegistro {
  id: string;
  userId: string;
  data: string;
  horaEntrada: Timestamp | null;
  horaSaida: Timestamp | null;
  status: RegistroStatus;
  justificativaTexto: string | null;
  justificativaCanal: JustificativaCanal;
  justificativaStatus: JustificativaStatus;
  justificativaEmailEnviado: boolean;
  justificativaEmailEm: Timestamp | null;
  justificativaEmailAssunto: string | null;
  justificativaEmailProtocolo: string | null;
  justificativaObservacaoGestor: string | null;
  justificativaValidadaPor: string | null;
  justificativaValidadaEm: Timestamp | null;
  assinaturaUsuario: RegistroAssinatura;
  assinaturaGestor: RegistroAssinatura;
  editadoPor: string | null;
  editadoEm: Timestamp | null;
  criadoEm: Timestamp;
}

export type OfflineActionPayloadMap = {
  registerPunch: { profile: UserProfile; date?: string };
  updateRegistro: RegistroUpdateInput;
  confirmRegistro: { userId: string; date: string; actorId: string };
  validateRegistro: { userId: string; date: string; actorId: string };
  rejectRegistro: { userId: string; date: string; actorId: string; observacao: string };
};

type OfflineActionBase<TType extends OfflineActionType> = {
  id: string;
  type: TType;
  payload: OfflineActionPayloadMap[TType];
  createdAt: string;
  retryCount: number;
  lastAttemptAt: string | null;
  lastError: string | null;
};

export type OfflineAction<TType extends OfflineActionType = OfflineActionType> = TType extends OfflineActionType
  ? OfflineActionBase<TType>
  : never;

export interface RegistroUpdateInput {
  userId: string;
  data: string;
  actorId: string;
  justificativaTexto?: string | null;
  justificativaCanal?: JustificativaCanal;
  justificativaStatus?: JustificativaStatus;
  justificativaEmailEnviado?: boolean;
  justificativaEmailEm?: Timestamp | null;
  justificativaEmailAssunto?: string | null;
  justificativaEmailProtocolo?: string | null;
  justificativaObservacaoGestor?: string | null;
  justificativaValidadaPor?: string | null;
  justificativaValidadaEm?: Timestamp | null;
  status?: RegistroStatus;
}

export interface RegistroListItem extends FrequenciaRegistro {
  isSynthetic?: boolean;
}