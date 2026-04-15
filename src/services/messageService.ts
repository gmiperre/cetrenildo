import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';

import { AppMessage } from '../models/message';
import { db, ensureFirebaseConfigured } from './firebase';

const RETENTION_DAYS = 90;

const messagesCollection = (userId: string) => collection(db, 'users', userId, 'messages');

const hydrateMessage = (id: string, userId: string, data: Record<string, unknown>): AppMessage => ({
  id,
  userId,
  type: (data.type as AppMessage['type']) ?? 'sistema',
  title: (data.title as string) ?? 'Mensagem',
  body: (data.body as string) ?? '',
  createdAt: (data.createdAt as Timestamp) ?? Timestamp.now(),
  readAt: (data.readAt as Timestamp | null) ?? null,
  metadata: {
    relatedDate: (data.metadata as { relatedDate?: string | null } | undefined)?.relatedDate ?? null,
    pendingCount: (data.metadata as { pendingCount?: number } | undefined)?.pendingCount,
    oldestPendingDate: (data.metadata as { oldestPendingDate?: string | null } | undefined)?.oldestPendingDate ?? null,
    managerObservation: (data.metadata as { managerObservation?: string | null } | undefined)?.managerObservation ?? null,
    month: (data.metadata as { month?: number } | undefined)?.month,
    year: (data.metadata as { year?: number } | undefined)?.year,
  },
});

const retentionCutoff = () => {
  const date = new Date();
  date.setDate(date.getDate() - RETENTION_DAYS);
  return Timestamp.fromDate(date);
};

export const messageService = {
  async listByUser(userId: string) {
    ensureFirebaseConfigured();
    const snapshot = await getDocs(query(messagesCollection(userId), orderBy('createdAt', 'desc')));
    return snapshot.docs.map((item) => hydrateMessage(item.id, userId, item.data() as Record<string, unknown>));
  },

  async getUnreadCount(userId: string) {
    ensureFirebaseConfigured();
    const snapshot = await getDocs(query(messagesCollection(userId), where('readAt', '==', null)));
    return snapshot.size;
  },

  async markAsRead(userId: string, messageId: string) {
    ensureFirebaseConfigured();
    await setDoc(doc(messagesCollection(userId), messageId), { readAt: serverTimestamp() }, { merge: true });
  },

  async markAllAsRead(userId: string) {
    ensureFirebaseConfigured();
    const unread = await getDocs(query(messagesCollection(userId), where('readAt', '==', null)));
    if (unread.empty) {
      return;
    }

    const batch = writeBatch(db);
    unread.docs.forEach((item) => {
      batch.set(item.ref, { readAt: serverTimestamp() }, { merge: true });
    });
    await batch.commit();
  },

  async upsertPendingAttendanceMessage(userId: string, referenceDate: string, pendingCount: number, oldestPendingDate: string | null) {
    ensureFirebaseConfigured();
    const messageId = `pending-attendance-${referenceDate}`;

    await setDoc(doc(messagesCollection(userId), messageId), {
      userId,
      type: 'pending_attendance',
      title: 'Frequência pendente',
      body:
        pendingCount === 1
          ? `Você tem 1 pendência de frequência (${(oldestPendingDate ?? '').split('-').reverse().join('/')}).`
          : `Você tem ${pendingCount} pendências de frequência.`,
      metadata: {
        relatedDate: oldestPendingDate,
        pendingCount,
        oldestPendingDate,
      },
      createdAt: serverTimestamp(),
      readAt: null,
    }, { merge: true });
  },

  async upsertJustificativaStatusMessage(input: {
    userId: string;
    date: string;
    status: 'justificativa_recusada' | 'justificativa_aprovada';
    managerObservation?: string | null;
  }) {
    ensureFirebaseConfigured();
    const messageId = `${input.status}-${input.date}`;
    const displayDate = input.date.split('-').reverse().join('/');

    await setDoc(
      doc(messagesCollection(input.userId), messageId),
      {
        userId: input.userId,
        type: input.status,
        title: input.status === 'justificativa_recusada' ? 'Justificativa recusada' : 'Justificativa aprovada',
        body:
          input.status === 'justificativa_recusada'
            ? `Sua justificativa de ${displayDate} foi recusada. Toque para revisar e reenviar.`
            : `Sua justificativa de ${displayDate} foi aprovada pelo gestor.`,
        metadata: {
          relatedDate: input.date,
          managerObservation: input.managerObservation ?? null,
        },
        createdAt: serverTimestamp(),
        readAt: null,
      },
      { merge: true },
    );
  },

  async upsertDailyReminderMessage(userId: string, date: string) {
    ensureFirebaseConfigured();
    const messageId = `lembrete-frequencia-${date}`;
    const displayDate = date.split('-').reverse().join('/');

    await setDoc(
      doc(messagesCollection(userId), messageId),
      {
        userId,
        type: 'lembrete_frequencia',
        title: 'Lembrete de frequência',
        body: `Lembre-se de registrar sua frequência de ${displayDate}. Toque para abrir o registro do dia.`,
        metadata: {
          relatedDate: date,
        },
        createdAt: serverTimestamp(),
        readAt: null,
      },
      { merge: true },
    );
  },

  async upsertFolhaEmitidaMessage(userId: string, month: number, year: number) {
    ensureFirebaseConfigured();
    const normalizedMonth = `${month}`.padStart(2, '0');
    const messageId = `folha-emitida-${year}-${normalizedMonth}`;

    await setDoc(
      doc(messagesCollection(userId), messageId),
      {
        userId,
        type: 'folha_emitida',
        title: 'Folha mensal emitida',
        body: `Sua folha de frequência de ${normalizedMonth}/${year} foi emitida. Toque para acessar o histórico do mês.`,
        metadata: {
          month,
          year,
          relatedDate: `${year}-${normalizedMonth}-01`,
        },
        createdAt: serverTimestamp(),
        readAt: null,
      },
      { merge: true },
    );
  },

  async upsertFolhaEnviadaRevisaoMessage(userId: string, month: number, year: number) {
    ensureFirebaseConfigured();
    const normalizedMonth = `${month}`.padStart(2, '0');
    const messageId = `folha-enviada-revisao-${year}-${normalizedMonth}`;

    await setDoc(
      doc(messagesCollection(userId), messageId),
      {
        userId,
        type: 'folha_enviada_revisao',
        title: 'Folha enviada para revisão',
        body: `A folha de frequência de ${normalizedMonth}/${year} foi enviada e está em revisão da chefia.`,
        metadata: {
          month,
          year,
          relatedDate: `${year}-${normalizedMonth}-01`,
        },
        createdAt: serverTimestamp(),
        readAt: null,
      },
      { merge: true },
    );
  },

  async upsertFolhaRejeitadaGestorMessage(userId: string, month: number, year: number, motivo: string) {
    ensureFirebaseConfigured();
    const normalizedMonth = `${month}`.padStart(2, '0');
    const messageId = `folha-rejeitada-gestor-${year}-${normalizedMonth}`;

    await setDoc(
      doc(messagesCollection(userId), messageId),
      {
        userId,
        type: 'folha_rejeitada_gestor',
        title: 'Folha rejeitada pela chefia',
        body: `A folha de frequência de ${normalizedMonth}/${year} foi rejeitada. Ajuste e reenviem o arquivo assinado.`,
        metadata: {
          month,
          year,
          relatedDate: `${year}-${normalizedMonth}-01`,
          managerObservation: motivo,
        },
        createdAt: serverTimestamp(),
        readAt: null,
      },
      { merge: true },
    );
  },

  async upsertFolhaFinalDisponivelMessage(userId: string, month: number, year: number) {
    ensureFirebaseConfigured();
    const normalizedMonth = `${month}`.padStart(2, '0');
    const messageId = `folha-final-disponivel-${year}-${normalizedMonth}`;

    await setDoc(
      doc(messagesCollection(userId), messageId),
      {
        userId,
        type: 'folha_final_disponivel',
        title: 'Versão final disponível',
        body: `A versão final da folha de ${normalizedMonth}/${year} foi assinada pela chefia. Toque para concluir a ciência.`,
        metadata: {
          month,
          year,
          relatedDate: `${year}-${normalizedMonth}-01`,
        },
        createdAt: serverTimestamp(),
        readAt: null,
      },
      { merge: true },
    );
  },

  async upsertFolhaConcluidaMessage(userId: string, month: number, year: number, audience: 'funcionario' | 'gestor') {
    ensureFirebaseConfigured();
    const normalizedMonth = `${month}`.padStart(2, '0');
    const suffix = audience === 'gestor' ? 'gestor' : 'funcionario';
    const messageId = `folha-concluida-${suffix}-${year}-${normalizedMonth}`;

    await setDoc(
      doc(messagesCollection(userId), messageId),
      {
        userId,
        type: 'folha_concluida',
        title: 'Folha concluída',
        body:
          audience === 'gestor'
            ? `O funcionário confirmou ciência da folha de ${normalizedMonth}/${year}. O fluxo foi concluído.`
            : `Você confirmou ciência da folha de ${normalizedMonth}/${year}. O fluxo foi concluído.`,
        metadata: {
          month,
          year,
          relatedDate: `${year}-${normalizedMonth}-01`,
        },
        createdAt: serverTimestamp(),
        readAt: null,
      },
      { merge: true },
    );
  },

  async upsertContestacaoPresencaMessage(userId: string, date: string, motivo: string) {
    ensureFirebaseConfigured();
    const messageId = `presenca-contestada-${date}`;
    const displayDate = date.split('-').reverse().join('/');

    await setDoc(
      doc(messagesCollection(userId), messageId),
      {
        userId,
        type: 'presenca_contestada',
        title: 'Sua presença foi contestada',
        body: `O gestor contestou a marcação de presença do dia ${displayDate}. Você tem o direito de responder e apresentar sua versão antes da decisão final.`,
        metadata: {
          relatedDate: date,
          managerObservation: motivo,
        },
        createdAt: serverTimestamp(),
        readAt: null,
      },
      { merge: true },
    );
  },

  async upsertContestacaoEncerradaMessage(userId: string, date: string, decisao: 'mantida_falta' | 'revertida_presente') {
    ensureFirebaseConfigured();
    const messageId = `contestacao-encerrada-${date}`;
    const displayDate = date.split('-').reverse().join('/');

    const isReverted = decisao === 'revertida_presente';

    await setDoc(
      doc(messagesCollection(userId), messageId),
      {
        userId,
        type: 'contestacao_encerrada',
        title: isReverted ? 'Presença revertida' : 'Falta confirmada pelo gestor',
        body: isReverted
          ? `O gestor analisou a contestação do dia ${displayDate} e reverteu para presença.`
          : `O gestor analisou a contestação do dia ${displayDate} e confirmou a falta.`,
        metadata: {
          relatedDate: date,
        },
        createdAt: serverTimestamp(),
        readAt: null,
      },
      { merge: true },
    );
  },

  async upsertContestacaoReabertaMessage(userId: string, date: string, motivo: string) {
    ensureFirebaseConfigured();
    const messageId = `contestacao-reaberta-${date}`;
    const displayDate = date.split('-').reverse().join('/');

    await setDoc(
      doc(messagesCollection(userId), messageId),
      {
        userId,
        type: 'contestacao_reaberta',
        title: 'Contestação reaberta pelo gestor',
        body: `A contestação da frequência de ${displayDate} foi reaberta pelo gestor. Você pode enviar uma nova resposta.`,
        metadata: {
          relatedDate: date,
          managerObservation: motivo,
        },
        createdAt: serverTimestamp(),
        readAt: null,
      },
      { merge: true },
    );
  },

  async pruneExpiredMessages(userId: string) {
    ensureFirebaseConfigured();
    const cutoff = retentionCutoff();
    const snapshot = await getDocs(query(messagesCollection(userId), where('createdAt', '<=', cutoff)));

    if (snapshot.empty) {
      return;
    }

    await Promise.all(snapshot.docs.map((item) => deleteDoc(item.ref)));
  },
};
