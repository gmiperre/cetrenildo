import { Timestamp } from 'firebase/firestore';

import { LogAction } from './frequencia';

export interface AuditLog {
  id: string;
  registroId: string;
  userId: string;
  acao: LogAction;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown>;
  timestamp: Timestamp;
}