import { Timestamp } from 'firebase/firestore';

import { UserProfile } from './user';

export type RegistroStatus = 'presente' | 'falta' | 'falta_justificada' | 'abono' | 'presenca_contestada';
export type LogAction = 'create' | 'update' | 'approve';
export type OfflineActionType =
  | 'registerPunch'
  | 'updateRegistro'
  | 'confirmRegistro'
  | 'validateRegistro'
  | 'rejectRegistro'
  | 'contestPresenca'
  | 'respondContestacao'
  | 'encerrarContestacao'
  | 'reopenContestacao'
  | 'emitFolhaMensal'
  | 'uploadFolhaAssinadaFuncionario'
  | 'reviewFolhaMensalGestor'
  | 'uploadFolhaFinalGestor'
  | 'confirmarCienciaFolhaFuncionario';
export type JustificativaCanal = 'email' | 'pdf' | null;
export type JustificativaStatus = 'sem_justificativa' | 'pendente_envio' | 'em_analise' | 'validada' | 'recusada';
export type ContestacaoStatus = 'sem_contestacao' | 'em_contestacao' | 'respondida' | 'encerrada';
export type ContestacaoDecisao = 'mantida_falta' | 'revertida_presente';
export type FolhaFrequenciaStatus =
  | 'emitida'
  | 'aguardando_upload_funcionario'
  | 'enviada_funcionario'
  | 'em_revisao_gestor'
  | 'rejeitada_gestor'
  | 'final_assinada_gestor'
  | 'concluida';

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
  justificativaDocumentoNome?: string | null;
  justificativaDocumentoMime?: string | null;
  justificativaDocumentoTamanhoBytes?: number | null;
  justificativaDocumentoAnexadoEm?: Timestamp | null;
  justificativaDocumentoStoragePath?: string | null;
  justificativaObservacaoGestor: string | null;
  justificativaValidadaPor: string | null;
  justificativaValidadaEm: Timestamp | null;
  assinaturaUsuario: RegistroAssinatura;
  assinaturaGestor: RegistroAssinatura;
  contestacaoStatus: ContestacaoStatus;
  contestacaoCiclo: number;
  contestacaoMotivo: string | null;
  contestacaoRespostaFuncionario: string | null;
  contestacaoDecisao: ContestacaoDecisao | null;
  contestacaoDecididoPor: string | null;
  contestacaoDecididaEm: Timestamp | null;
  contestacaoReaberturaMotivo: string | null;
  contestacaoReabertaPor: string | null;
  contestacaoReabertaEm: Timestamp | null;
  editadoPor: string | null;
  editadoEm: Timestamp | null;
  criadoEm: Timestamp;
}

export interface FolhaMensalSnapshotUsuario {
  nome: string;
  email: string;
  matricula: string | null;
  cargo: string | null;
  tipo: 'padrao' | 'gestor';
  horarioEntradaEsperado: string;
  horarioSaidaEsperado: string;
}

export interface FolhaMensalResumo {
  diasComRegistro: number;
  presentes: number;
  faltas: number;
  faltasJustificadas: number;
  abonos: number;
  presencasContestadas: number;
}

export interface FolhaFrequenciaMensal {
  id: string;
  userId: string;
  mes: number;
  ano: number;
  status: FolhaFrequenciaStatus;
  pdfOriginalPath: string | null;
  pdfOriginalHash: string | null;
  pdfFuncionarioAssinadoPath: string | null;
  pdfFuncionarioAssinadoHash: string | null;
  pdfGestorFinalPath: string | null;
  pdfGestorFinalHash: string | null;
  enviadoFuncionarioEm: Timestamp | null;
  revisadoGestorPor: string | null;
  revisadoGestorEm: Timestamp | null;
  finalizadoGestorPor: string | null;
  finalizadoGestorEm: Timestamp | null;
  cienteFuncionarioPor: string | null;
  cienteFuncionarioEm: Timestamp | null;
  snapshotUsuario: FolhaMensalSnapshotUsuario;
  snapshotResumo: FolhaMensalResumo;
  motivoRejeicao: string | null;
  emitidoPor: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type OfflineActionPayloadMap = {
  registerPunch: { profile: UserProfile; date?: string; entryTime?: string; exitTime?: string };
  updateRegistro: RegistroUpdateInput;
  confirmRegistro: { userId: string; date: string; actorId: string };
  validateRegistro: { userId: string; date: string; actorId: string };
  rejectRegistro: { userId: string; date: string; actorId: string; observacao: string };
  contestPresenca: { userId: string; date: string; actorId: string; motivo: string };
  respondContestacao: { userId: string; date: string; resposta: string };
  encerrarContestacao: { userId: string; date: string; actorId: string; decisao: ContestacaoDecisao };
  reopenContestacao: { userId: string; date: string; actorId: string; motivo: string };
  emitFolhaMensal: { userId: string; month: number; year: number; actorId: string };
  uploadFolhaAssinadaFuncionario: {
    userId: string;
    month: number;
    year: number;
    actorId: string;
    pdfFuncionarioAssinadoPath: string;
    pdfFuncionarioAssinadoHash: string;
  };
  reviewFolhaMensalGestor: {
    userId: string;
    month: number;
    year: number;
    actorId: string;
    decision: 'aprovar' | 'rejeitar';
    motivo?: string | null;
  };
  uploadFolhaFinalGestor: {
    userId: string;
    month: number;
    year: number;
    actorId: string;
    pdfGestorFinalPath: string;
    pdfGestorFinalHash: string;
  };
  confirmarCienciaFolhaFuncionario: {
    userId: string;
    month: number;
    year: number;
    actorId: string;
  };
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
  justificativaDocumentoNome?: string | null;
  justificativaDocumentoMime?: string | null;
  justificativaDocumentoTamanhoBytes?: number | null;
  justificativaDocumentoAnexadoEm?: Timestamp | null;
  justificativaDocumentoStoragePath?: string | null;
  justificativaObservacaoGestor?: string | null;
  justificativaValidadaPor?: string | null;
  justificativaValidadaEm?: Timestamp | null;
  status?: RegistroStatus;
}

export interface RegistroListItem extends FrequenciaRegistro {
  isSynthetic?: boolean;
}