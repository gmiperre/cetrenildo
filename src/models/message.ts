import { Timestamp } from 'firebase/firestore';

export type MessageType =
  | 'pending_attendance'
  | 'justificativa_recusada'
  | 'justificativa_aprovada'
  | 'lembrete_frequencia'
  | 'presenca_contestada'
  | 'contestacao_encerrada'
  | 'contestacao_reaberta'
  | 'folha_emitida'
  | 'folha_enviada_revisao'
  | 'folha_rejeitada_gestor'
  | 'folha_final_disponivel'
  | 'folha_concluida'
  | 'sistema';

export interface AppMessage {
  id: string;
  userId: string;
  type: MessageType;
  title: string;
  body: string;
  createdAt: Timestamp;
  readAt: Timestamp | null;
  metadata?: {
    relatedDate?: string | null;
    pendingCount?: number;
    oldestPendingDate?: string | null;
    managerObservation?: string | null;
    month?: number;
    year?: number;
  };
}
