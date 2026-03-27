import NetInfo from '@react-native-community/netinfo';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  where,
} from 'firebase/firestore';

import { buildJustificativaUpdateState } from '../domain/frequencia';
import { CalendarDay } from '../models/calendar';
import { FrequenciaRegistro, OfflineAction, OfflineActionPayloadMap, OfflineActionType, RegistroStatus, RegistroUpdateInput } from '../models/frequencia';
import { UserProfile } from '../models/user';
import { formatDateKey, getMonthDateRange, getTodayKey } from '../utils/date';
import { getErrorMessage } from '../utils/errors';
import { calendarService } from './calendarService';
import { db, ensureFirebaseConfigured } from './firebase';
import { logService } from './logService';
import { offlineService } from './offlineService';

const registrosCollection = collection(db, 'registrosFrequencia');

const emptySignature = {
  confirmado: false,
  userId: null,
  timestamp: null,
};

const makeRegistroId = (userId: string, date: string) => `${userId}_${date}`;

const getRegistroRef = (userId: string, date: string) => doc(registrosCollection, makeRegistroId(userId, date));

const serializeRecord = (record: FrequenciaRegistro) => ({
  userId: record.userId,
  data: record.data,
  horaEntrada: record.horaEntrada,
  horaSaida: record.horaSaida,
  status: record.status,
  justificativaTexto: record.justificativaTexto,
  justificativaCanal: record.justificativaCanal,
  justificativaStatus: record.justificativaStatus,
  justificativaEmailEnviado: record.justificativaEmailEnviado,
  justificativaEmailEm: record.justificativaEmailEm,
  justificativaEmailAssunto: record.justificativaEmailAssunto,
  justificativaEmailProtocolo: record.justificativaEmailProtocolo,
  justificativaObservacaoGestor: record.justificativaObservacaoGestor,
  justificativaValidadaPor: record.justificativaValidadaPor,
  justificativaValidadaEm: record.justificativaValidadaEm,
  assinaturaUsuario: record.assinaturaUsuario,
  assinaturaGestor: record.assinaturaGestor,
  editadoPor: record.editadoPor,
  editadoEm: record.editadoEm,
  criadoEm: record.criadoEm,
});

const hydrateRecord = (id: string, data: Record<string, unknown>) => ({
  id,
  userId: data.userId as string,
  data: data.data as string,
  horaEntrada: (data.horaEntrada as Timestamp | null) ?? null,
  horaSaida: (data.horaSaida as Timestamp | null) ?? null,
  status: (data.status as RegistroStatus) ?? 'falta',
  justificativaTexto: (data.justificativaTexto as string | null) ?? ((data.justificativa as string | null) ?? null),
  justificativaCanal: (data.justificativaCanal as FrequenciaRegistro['justificativaCanal']) ?? null,
  justificativaStatus: (data.justificativaStatus as FrequenciaRegistro['justificativaStatus']) ?? 'sem_justificativa',
  justificativaEmailEnviado: (data.justificativaEmailEnviado as boolean) ?? false,
  justificativaEmailEm: (data.justificativaEmailEm as Timestamp | null) ?? null,
  justificativaEmailAssunto: (data.justificativaEmailAssunto as string | null) ?? null,
  justificativaEmailProtocolo: (data.justificativaEmailProtocolo as string | null) ?? null,
  justificativaObservacaoGestor: (data.justificativaObservacaoGestor as string | null) ?? null,
  justificativaValidadaPor: (data.justificativaValidadaPor as string | null) ?? null,
  justificativaValidadaEm: (data.justificativaValidadaEm as Timestamp | null) ?? null,
  assinaturaUsuario: (data.assinaturaUsuario as FrequenciaRegistro['assinaturaUsuario']) ?? emptySignature,
  assinaturaGestor: (data.assinaturaGestor as FrequenciaRegistro['assinaturaGestor']) ?? emptySignature,
  editadoPor: (data.editadoPor as string | null) ?? null,
  editadoEm: (data.editadoEm as Timestamp | null) ?? null,
  criadoEm: (data.criadoEm as Timestamp) ?? Timestamp.now(),
}) as FrequenciaRegistro;

const computeStatus = (horaEntrada: Timestamp | null, currentStatus?: RegistroStatus | null): RegistroStatus => {
  if (currentStatus === 'abono') {
    return 'abono';
  }

  return horaEntrada ? 'presente' : 'falta';
};

const findLegacyByUserAndDate = async (userId: string, date: string) => {
  const snapshot = await getDocs(query(registrosCollection, where('userId', '==', userId), where('data', '==', date)));
  const legacyDocument = snapshot.docs[0];

  if (!legacyDocument) {
    return null;
  }

  return hydrateRecord(legacyDocument.id, legacyDocument.data());
};

const findByUserAndDate = async (userId: string, date: string) => {
  ensureFirebaseConfigured();
  const deterministicRef = getRegistroRef(userId, date);
  const snapshot = await getDoc(deterministicRef);

  if (snapshot.exists()) {
    return hydrateRecord(snapshot.id, snapshot.data() as Record<string, unknown>);
  }

  return findLegacyByUserAndDate(userId, date);
};

const saveRemoteRecord = async (
  userId: string,
  date: string,
  actorId: string,
  compute: (existing: FrequenciaRegistro | null, now: Timestamp) => {
    next: FrequenciaRegistro;
    action: 'create' | 'update' | 'approve';
  } | null,
) => {
  ensureFirebaseConfigured();
  const deterministicId = makeRegistroId(userId, date);
  const deterministicRef = getRegistroRef(userId, date);
  const legacy = await findLegacyByUserAndDate(userId, date);
  const legacyAsDeterministic = legacy ? { ...legacy, id: deterministicId } : null;

  const transactionResult = await runTransaction(db, async (transaction) => {
    const now = Timestamp.now();
    const currentSnapshot = await transaction.get(deterministicRef);
    const existing = currentSnapshot.exists()
      ? hydrateRecord(currentSnapshot.id, currentSnapshot.data() as Record<string, unknown>)
      : legacyAsDeterministic;
    const mutation = compute(existing, now);

    if (!mutation) {
      return null;
    }

    const next = { ...mutation.next, id: deterministicId };
    transaction.set(deterministicRef, serializeRecord(next));

    return {
      action: mutation.action,
      before: existing,
      next,
    };
  });

  if (!transactionResult) {
    return null;
  }

  await logService.create({
    registroId: deterministicId,
    userId: actorId,
    acao: transactionResult.action,
    antes: transactionResult.before ? serializeRecord(transactionResult.before) : null,
    depois: serializeRecord(transactionResult.next),
  });

  return transactionResult.next;
};

const buildAction = <TType extends OfflineActionType>(type: TType, payload: OfflineActionPayloadMap[TType]): OfflineAction<TType> => {
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    lastAttemptAt: null,
    lastError: null,
  } as OfflineAction<TType>;
};

const getComparableTimestamp = (record: FrequenciaRegistro) => {
  const edited = record.editadoEm?.toMillis() ?? 0;
  const created = record.criadoEm?.toMillis() ?? 0;
  return Math.max(edited, created);
};

const dedupeMonthlyRecords = (records: FrequenciaRegistro[]) => {
  const byUserAndDate = new Map<string, FrequenciaRegistro>();

  for (const record of records) {
    const key = `${record.userId}_${record.data}`;
    const current = byUserAndDate.get(key);

    if (!current) {
      byUserAndDate.set(key, record);
      continue;
    }

    const deterministicId = makeRegistroId(record.userId, record.data);
    const currentIsDeterministic = current.id === deterministicId;
    const candidateIsDeterministic = record.id === deterministicId;

    if (candidateIsDeterministic && !currentIsDeterministic) {
      byUserAndDate.set(key, record);
      continue;
    }

    if (!candidateIsDeterministic && currentIsDeterministic) {
      continue;
    }

    if (getComparableTimestamp(record) > getComparableTimestamp(current)) {
      byUserAndDate.set(key, record);
    }
  }

  return [...byUserAndDate.values()];
};

const isOnline = async () => {
  const state = await NetInfo.fetch();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
};

const buildRecordTemplate = (userId: string, date: string, timestamp: Timestamp) => ({
  id: makeRegistroId(userId, date),
  userId,
  data: date,
  horaEntrada: null,
  horaSaida: null,
  status: 'falta' as RegistroStatus,
  justificativaTexto: null,
  justificativaCanal: null,
  justificativaStatus: 'sem_justificativa' as FrequenciaRegistro['justificativaStatus'],
  justificativaEmailEnviado: false,
  justificativaEmailEm: null,
  justificativaEmailAssunto: null,
  justificativaEmailProtocolo: null,
  justificativaObservacaoGestor: null,
  justificativaValidadaPor: null,
  justificativaValidadaEm: null,
  assinaturaUsuario: { ...emptySignature },
  assinaturaGestor: { ...emptySignature },
  editadoPor: null,
  editadoEm: null,
  criadoEm: timestamp,
});

const buildTimestampFromDateAndTime = (date: string, time: string, fallback: Timestamp) => {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);

  if ([year, month, day, hour, minute].some(Number.isNaN)) {
    return fallback;
  }

  return Timestamp.fromDate(new Date(year, month - 1, day, hour, minute, 0, 0));
};

const buildExpectedEntryTimestamp = (
  profile: UserProfile,
  date: string,
  fallback: Timestamp,
  dayPolicy: CalendarDay | null,
) => {
  const entryTime = dayPolicy?.horarioEntradaOverride ?? profile.horarioEntradaEsperado;
  return buildTimestampFromDateAndTime(date, entryTime, fallback);
};

const buildExpectedExitTimestamp = (
  profile: UserProfile,
  date: string,
  fallback: Timestamp,
  dayPolicy: CalendarDay | null,
) => {
  const exitTime = dayPolicy?.horarioSaidaOverride ?? profile.horarioSaidaEsperado;
  return buildTimestampFromDateAndTime(date, exitTime, fallback);
};

const shouldUseExpectedSchedule = (_date: string) => {
  // Sempre usa horário esperado do perfil, tanto para hoje quanto para datas passadas.
  return true;
};

async function registerPunchRemote(profile: UserProfile, date: string) {
  const dayPolicy = await calendarService.getByDate(date);
  if (dayPolicy && !dayPolicy.requerPonto) {
    throw new Error(dayPolicy.motivo ?? 'Este dia está marcado como sem expediente.');
  }

  const saved = await saveRemoteRecord(profile.id, date, profile.id, (existing, now) => {
    const useExpectedSchedule = shouldUseExpectedSchedule(date);
    const expectedEntry = buildExpectedEntryTimestamp(profile, date, now, dayPolicy);
    const expectedExit = buildExpectedExitTimestamp(profile, date, now, dayPolicy);

    if (!existing) {
      return {
        action: 'create',
        next: {
          ...buildRecordTemplate(profile.id, date, now),
          horaEntrada: useExpectedSchedule ? expectedEntry : now,
          horaSaida: useExpectedSchedule ? expectedExit : null,
          status: 'presente' as RegistroStatus,
        },
      };
    }

    if (!existing.horaEntrada) {
      return {
        action: 'update',
        next: {
          ...existing,
          horaEntrada: useExpectedSchedule ? expectedEntry : now,
          horaSaida: useExpectedSchedule ? (existing.horaSaida ?? expectedExit) : existing.horaSaida,
          status: 'presente' as RegistroStatus,
          editadoPor: profile.id,
          editadoEm: now,
        },
      };
    }

    if (!existing.horaSaida) {
      return {
        action: 'update',
        next: {
          ...existing,
          horaSaida: useExpectedSchedule ? expectedExit : now,
          status: computeStatus(existing.horaEntrada, existing.status),
          editadoPor: profile.id,
          editadoEm: now,
        },
      };
    }

    return null;
  });

  if (saved) {
    await offlineService.upsertCachedRecord(saved);
    return saved;
  }

  const existing = await findByUserAndDate(profile.id, date);
  if (!existing) {
    throw new Error('Nenhum registro encontrado para o dia informado.');
  }

  return existing;
}

async function updateRegistroRemote(input: RegistroUpdateInput) {
  const saved = await saveRemoteRecord(input.userId, input.data, input.actorId, (existing, now) => {
    const baseRecord = existing ?? buildRecordTemplate(input.userId, input.data, now);

    const nextRecord: FrequenciaRegistro = {
      ...baseRecord,
      ...buildJustificativaUpdateState(baseRecord, input, now),
      status: input.status ?? computeStatus(baseRecord.horaEntrada, baseRecord.status),
      editadoPor: input.actorId,
      editadoEm: now,
    };

    return {
      action: existing ? 'update' : 'create',
      next: nextRecord,
    };
  });

  if (!saved) {
    throw new Error('Não foi possível atualizar o registro.');
  }

  await offlineService.upsertCachedRecord(saved);
  return saved;
}

async function confirmRegistroRemote(userId: string, date: string, actorId: string) {
  const saved = await saveRemoteRecord(userId, date, actorId, (existing, now) => {
    if (!existing) {
      throw new Error('Nenhum registro encontrado para confirmação.');
    }

    return {
      action: 'approve',
      next: {
        ...existing,
        assinaturaUsuario: {
          confirmado: true,
          userId: actorId,
          timestamp: now,
        },
        editadoPor: actorId,
        editadoEm: now,
      },
    };
  });

  if (!saved) {
    throw new Error('Nenhum registro encontrado para confirmação.');
  }

  await offlineService.upsertCachedRecord(saved);
  return saved;
}

async function validateRegistroRemote(userId: string, date: string, actorId: string) {
  const saved = await saveRemoteRecord(userId, date, actorId, (existing, now) => {
    if (!existing) {
      throw new Error('Nenhum registro encontrado para validação.');
    }

    if (!existing.justificativaTexto?.trim()) {
      throw new Error('Preencha a justificativa para continuar.');
    }

    if (!existing.justificativaEmailEnviado || !existing.justificativaEmailAssunto?.trim()) {
      throw new Error('Informe os dados de envio por e-mail antes de validar.');
    }

    return {
      action: 'approve',
      next: {
        ...existing,
        justificativaStatus: 'validada',
        justificativaValidadaPor: actorId,
        justificativaValidadaEm: now,
        assinaturaGestor: {
          confirmado: true,
          userId: actorId,
          timestamp: now,
        },
        editadoPor: actorId,
        editadoEm: now,
      },
    };
  });

  if (!saved) {
    throw new Error('Nenhum registro encontrado para validação.');
  }

  await offlineService.upsertCachedRecord(saved);
  return saved;
}

async function rejectRegistroRemote(userId: string, date: string, actorId: string, observacao: string) {
  const saved = await saveRemoteRecord(userId, date, actorId, (existing, now) => {
    if (!existing) {
      throw new Error('Nenhum registro encontrado para recusa.');
    }

    if (!observacao.trim()) {
      throw new Error('Informe o motivo da recusa.');
    }

    return {
      action: 'update',
      next: {
        ...existing,
        justificativaStatus: 'recusada',
        justificativaObservacaoGestor: observacao.trim(),
        justificativaValidadaPor: null,
        justificativaValidadaEm: null,
        assinaturaGestor: {
          confirmado: false,
          userId: null,
          timestamp: null,
        },
        editadoPor: actorId,
        editadoEm: now,
      },
    };
  });

  if (!saved) {
    throw new Error('Nenhum registro encontrado para recusa.');
  }

  await offlineService.upsertCachedRecord(saved);
  return saved;
}

export const frequenciaService = {
  async getTodayRecord(userId: string) {
    return this.getRecordByDate(userId, getTodayKey());
  },

  async getRecordByDate(userId: string, date: string) {
    if (await isOnline()) {
      const remoteRecord = await findByUserAndDate(userId, date);
      if (remoteRecord) {
        await offlineService.upsertCachedRecord(remoteRecord);
        return remoteRecord;
      }
    }

    const cachedRecords = await offlineService.getCachedRecords(userId);
    return cachedRecords.find((item) => item.data === date) ?? null;
  },

  async getMonthlyRecords(month: number, year: number, options: { userId?: string; canViewAll?: boolean }) {
    const { start, end } = getMonthDateRange(month, year);
    const online = await isOnline();

    if (online) {
      ensureFirebaseConfigured();
      const constraints = [where('data', '>=', start), where('data', '<=', end)];
      if (!options.canViewAll || options.userId) {
        constraints.unshift(where('userId', '==', options.userId as string));
      }

      const snapshot = await getDocs(query(registrosCollection, ...constraints));
      const records = dedupeMonthlyRecords(snapshot.docs.map((item) => hydrateRecord(item.id, item.data())));

      if (options.userId) {
        await offlineService.setCachedRecords(options.userId, records);
      }

      return records.sort((left, right) => left.data.localeCompare(right.data));
    }

    if (!options.userId) {
      return [];
    }

    const cachedRecords = await offlineService.getCachedRecords(options.userId);
    return cachedRecords.filter((item) => item.data >= start && item.data <= end);
  },

  async registerPunch(profile: UserProfile, date = getTodayKey()) {
    if (date > getTodayKey()) {
      throw new Error('Não é possível registrar ponto para datas futuras.');
    }

    if (await isOnline()) {
      return registerPunchRemote(profile, date);
    }

    const dayPolicy = await calendarService.getByDate(date);
    if (dayPolicy && !dayPolicy.requerPonto) {
      throw new Error(dayPolicy.motivo ?? 'Este dia está marcado como sem expediente.');
    }

    const now = Timestamp.now();
    const useExpectedSchedule = shouldUseExpectedSchedule(date);
    const expectedEntry = buildExpectedEntryTimestamp(profile, date, now, dayPolicy);
    const expectedExit = buildExpectedExitTimestamp(profile, date, now, dayPolicy);
    const existing = await this.getRecordByDate(profile.id, date);
    const baseRecord = existing ?? buildRecordTemplate(profile.id, date, now);

    const nextRecord = !existing
      ? {
          ...baseRecord,
          horaEntrada: useExpectedSchedule ? expectedEntry : now,
          horaSaida: useExpectedSchedule ? expectedExit : null,
          status: 'presente' as RegistroStatus,
          editadoPor: profile.id,
          editadoEm: now,
        }
      : !baseRecord.horaEntrada
      ? {
          ...baseRecord,
          horaEntrada: useExpectedSchedule ? expectedEntry : now,
          horaSaida: useExpectedSchedule ? (baseRecord.horaSaida ?? expectedExit) : baseRecord.horaSaida,
          status: 'presente' as RegistroStatus,
          editadoPor: profile.id,
          editadoEm: now,
        }
      : !baseRecord.horaSaida
      ? {
          ...baseRecord,
          horaSaida: useExpectedSchedule ? expectedExit : now,
          status: computeStatus(baseRecord.horaEntrada, baseRecord.status),
          editadoPor: profile.id,
          editadoEm: now,
        }
      : {
          ...baseRecord,
        };

    await offlineService.upsertCachedRecord(nextRecord);
    await offlineService.queueAction(buildAction('registerPunch', { profile, date }));
    return nextRecord;
  },

  async updateRegistro(input: RegistroUpdateInput) {
    if (await isOnline()) {
      return updateRegistroRemote(input);
    }

    const now = Timestamp.now();
    const existing = await this.getRecordByDate(input.userId, input.data);
    const baseRecord = existing ?? buildRecordTemplate(input.userId, input.data, now);

    const nextRecord: FrequenciaRegistro = {
      ...baseRecord,
      ...buildJustificativaUpdateState(baseRecord, input, now),
      status: input.status ?? computeStatus(baseRecord.horaEntrada, baseRecord.status),
      editadoPor: input.actorId,
      editadoEm: now,
    };

    await offlineService.upsertCachedRecord(nextRecord);
    await offlineService.queueAction(buildAction('updateRegistro', input));
    return nextRecord;
  },

  async confirmRegistro(userId: string, date: string, actorId: string) {
    if (await isOnline()) {
      return confirmRegistroRemote(userId, date, actorId);
    }

    const existing = await this.getRecordByDate(userId, date);
    if (!existing) {
      throw new Error('Nenhum registro encontrado para confirmação.');
    }

    const nextRecord = {
      ...existing,
      assinaturaUsuario: {
        confirmado: true,
        userId: actorId,
        timestamp: Timestamp.now(),
      },
    };

    await offlineService.upsertCachedRecord(nextRecord);
    await offlineService.queueAction(buildAction('confirmRegistro', { userId, date, actorId }));
    return nextRecord;
  },

  async validateRegistro(userId: string, date: string, actorId: string) {
    if (await isOnline()) {
      return validateRegistroRemote(userId, date, actorId);
    }

    const existing = await this.getRecordByDate(userId, date);
    if (!existing) {
      throw new Error('Nenhum registro encontrado para validação.');
    }

    const nextRecord = {
      ...existing,
      justificativaStatus: 'validada' as FrequenciaRegistro['justificativaStatus'],
      justificativaValidadaPor: actorId,
      justificativaValidadaEm: Timestamp.now(),
      assinaturaGestor: {
        confirmado: true,
        userId: actorId,
        timestamp: Timestamp.now(),
      },
    };

    await offlineService.upsertCachedRecord(nextRecord);
    await offlineService.queueAction(buildAction('validateRegistro', { userId, date, actorId }));
    return nextRecord;
  },

  async rejectRegistro(userId: string, date: string, actorId: string, observacao: string) {
    if (await isOnline()) {
      return rejectRegistroRemote(userId, date, actorId, observacao);
    }

    const existing = await this.getRecordByDate(userId, date);
    if (!existing) {
      throw new Error('Nenhum registro encontrado para recusa.');
    }

    if (!observacao.trim()) {
      throw new Error('Informe o motivo da recusa.');
    }

    const nextRecord = {
      ...existing,
      justificativaStatus: 'recusada' as FrequenciaRegistro['justificativaStatus'],
      justificativaObservacaoGestor: observacao.trim(),
      justificativaValidadaPor: null,
      justificativaValidadaEm: null,
      assinaturaGestor: {
        confirmado: false,
        userId: null,
        timestamp: null,
      },
      editadoPor: actorId,
      editadoEm: Timestamp.now(),
    };

    await offlineService.upsertCachedRecord(nextRecord);
    await offlineService.queueAction(buildAction('rejectRegistro', { userId, date, actorId, observacao }));
    return nextRecord;
  },

  async flushPendingActions() {
    if (!(await isOnline())) {
      return;
    }

    const actions = await offlineService.getPendingActions();
    if (!actions.length) {
      return;
    }

    const remaining: OfflineAction[] = [];

    for (const action of actions) {
      try {
        if (action.type === 'registerPunch') {
          await registerPunchRemote(action.payload.profile, action.payload.date ?? getTodayKey());
        }

        if (action.type === 'updateRegistro') {
          await updateRegistroRemote(action.payload);
        }

        if (action.type === 'confirmRegistro') {
          await confirmRegistroRemote(action.payload.userId, action.payload.date, action.payload.actorId);
        }

        if (action.type === 'validateRegistro') {
          await validateRegistroRemote(action.payload.userId, action.payload.date, action.payload.actorId);
        }

        if (action.type === 'rejectRegistro') {
          await rejectRegistroRemote(
            action.payload.userId,
            action.payload.date,
            action.payload.actorId,
            action.payload.observacao,
          );
        }
      } catch (error) {
        const message = getErrorMessage(error, 'Erro desconhecido ao sincronizar ação offline.');
        console.warn(`Falha ao sincronizar ação offline ${action.type} (${action.id}): ${message}`);
        remaining.push({
          ...action,
          retryCount: action.retryCount + 1,
          lastAttemptAt: new Date().toISOString(),
          lastError: message,
        });
      }
    }

    await offlineService.replacePendingActions(remaining);
  },
};