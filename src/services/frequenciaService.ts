import NetInfo from '@react-native-community/netinfo';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  where,
} from 'firebase/firestore';

import { buildJustificativaUpdateState } from '../domain/frequencia';
import { CalendarDay } from '../models/calendar';
import {
  ContestacaoDecisao,
  FolhaFrequenciaMensal,
  FolhaMensalResumo,
  FrequenciaRegistro,
  OfflineAction,
  OfflineActionPayloadMap,
  OfflineActionType,
  RegistroStatus,
  RegistroUpdateInput,
} from '../models/frequencia';
import { UserProfile } from '../models/user';
import { formatDateKey, getMonthDateRange, getTodayKey, isWeekday, isWorkdayForDate, parseDateKey } from '../utils/date';
import { getErrorMessage } from '../utils/errors';
import { calendarService } from './calendarService';
import { db, ensureFirebaseConfigured } from './firebase';
import { folhaDocumentService } from './folhaDocumentService';
import { folhaPdfService } from './folhaPdfService';
import { logService } from './logService';
import { messageService } from './messageService';
import { offlineService } from './offlineService';
import { userService } from './userService';

const registrosCollection = collection(db, 'registrosFrequencia');
const folhasCollection = collection(db, 'folhasFrequenciaMensal');

const emptySignature = {
  confirmado: false,
  userId: null,
  timestamp: null,
};

const makeRegistroId = (userId: string, date: string) => `${userId}_${date}`;

const getRegistroRef = (userId: string, date: string) => doc(registrosCollection, makeRegistroId(userId, date));
const makeFolhaId = (userId: string, month: number, year: number) => `${userId}_${year}-${`${month}`.padStart(2, '0')}`;
const getFolhaRef = (userId: string, month: number, year: number) => doc(folhasCollection, makeFolhaId(userId, month, year));

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
  justificativaDocumentoNome: record.justificativaDocumentoNome,
  justificativaDocumentoMime: record.justificativaDocumentoMime,
  justificativaDocumentoTamanhoBytes: record.justificativaDocumentoTamanhoBytes,
  justificativaDocumentoAnexadoEm: record.justificativaDocumentoAnexadoEm,
  justificativaDocumentoStoragePath: record.justificativaDocumentoStoragePath,
  justificativaObservacaoGestor: record.justificativaObservacaoGestor,
  justificativaValidadaPor: record.justificativaValidadaPor,
  justificativaValidadaEm: record.justificativaValidadaEm,
  assinaturaUsuario: record.assinaturaUsuario,
  assinaturaGestor: record.assinaturaGestor,
  contestacaoStatus: record.contestacaoStatus,
  contestacaoCiclo: record.contestacaoCiclo,
  contestacaoMotivo: record.contestacaoMotivo,
  contestacaoRespostaFuncionario: record.contestacaoRespostaFuncionario,
  contestacaoDecisao: record.contestacaoDecisao,
  contestacaoDecididoPor: record.contestacaoDecididoPor,
  contestacaoDecididaEm: record.contestacaoDecididaEm,
  contestacaoReaberturaMotivo: record.contestacaoReaberturaMotivo,
  contestacaoReabertaPor: record.contestacaoReabertaPor,
  contestacaoReabertaEm: record.contestacaoReabertaEm,
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
  justificativaDocumentoNome: (data.justificativaDocumentoNome as string | null) ?? null,
  justificativaDocumentoMime: (data.justificativaDocumentoMime as string | null) ?? null,
  justificativaDocumentoTamanhoBytes: (data.justificativaDocumentoTamanhoBytes as number | null) ?? null,
  justificativaDocumentoAnexadoEm: (data.justificativaDocumentoAnexadoEm as Timestamp | null) ?? null,
  justificativaDocumentoStoragePath: (data.justificativaDocumentoStoragePath as string | null) ?? null,
  justificativaObservacaoGestor: (data.justificativaObservacaoGestor as string | null) ?? null,
  justificativaValidadaPor: (data.justificativaValidadaPor as string | null) ?? null,
  justificativaValidadaEm: (data.justificativaValidadaEm as Timestamp | null) ?? null,
  assinaturaUsuario: (data.assinaturaUsuario as FrequenciaRegistro['assinaturaUsuario']) ?? emptySignature,
  assinaturaGestor: (data.assinaturaGestor as FrequenciaRegistro['assinaturaGestor']) ?? emptySignature,
  contestacaoStatus: (data.contestacaoStatus as FrequenciaRegistro['contestacaoStatus']) ?? 'sem_contestacao',
  contestacaoCiclo: (data.contestacaoCiclo as number) ?? 0,
  contestacaoMotivo: (data.contestacaoMotivo as string | null) ?? null,
  contestacaoRespostaFuncionario: (data.contestacaoRespostaFuncionario as string | null) ?? null,
  contestacaoDecisao: (data.contestacaoDecisao as ContestacaoDecisao | null) ?? null,
  contestacaoDecididoPor: (data.contestacaoDecididoPor as string | null) ?? null,
  contestacaoDecididaEm: (data.contestacaoDecididaEm as Timestamp | null) ?? null,
  contestacaoReaberturaMotivo: (data.contestacaoReaberturaMotivo as string | null) ?? null,
  contestacaoReabertaPor: (data.contestacaoReabertaPor as string | null) ?? null,
  contestacaoReabertaEm: (data.contestacaoReabertaEm as Timestamp | null) ?? null,
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

const fnv1aHash = (value: string) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
};

const buildFolhaResumo = (records: FrequenciaRegistro[]): FolhaMensalResumo => ({
  diasComRegistro: records.length,
  presentes: records.filter((item) => item.status === 'presente').length,
  faltas: records.filter((item) => item.status === 'falta').length,
  faltasJustificadas: records.filter((item) => item.status === 'falta_justificada').length,
  abonos: records.filter((item) => item.status === 'abono').length,
  presencasContestadas: records.filter((item) => item.status === 'presenca_contestada').length,
});

const hydrateFolhaMensal = (id: string, data: Record<string, unknown>) => ({
  id,
  userId: data.userId as string,
  mes: data.mes as number,
  ano: data.ano as number,
  status: (data.status as FolhaFrequenciaMensal['status']) ?? 'emitida',
  pdfOriginalPath: (data.pdfOriginalPath as string | null) ?? null,
  pdfOriginalHash: (data.pdfOriginalHash as string | null) ?? null,
  pdfFuncionarioAssinadoPath: (data.pdfFuncionarioAssinadoPath as string | null) ?? null,
  pdfFuncionarioAssinadoHash: (data.pdfFuncionarioAssinadoHash as string | null) ?? null,
  pdfGestorFinalPath: (data.pdfGestorFinalPath as string | null) ?? null,
  pdfGestorFinalHash: (data.pdfGestorFinalHash as string | null) ?? null,
  enviadoFuncionarioEm: (data.enviadoFuncionarioEm as Timestamp | null) ?? null,
  revisadoGestorPor: (data.revisadoGestorPor as string | null) ?? null,
  revisadoGestorEm: (data.revisadoGestorEm as Timestamp | null) ?? null,
  finalizadoGestorPor: (data.finalizadoGestorPor as string | null) ?? null,
  finalizadoGestorEm: (data.finalizadoGestorEm as Timestamp | null) ?? null,
  cienteFuncionarioPor: (data.cienteFuncionarioPor as string | null) ?? null,
  cienteFuncionarioEm: (data.cienteFuncionarioEm as Timestamp | null) ?? null,
  snapshotUsuario: {
    nome: ((data.snapshotUsuario as { nome?: string } | undefined)?.nome ?? '') as string,
    email: ((data.snapshotUsuario as { email?: string } | undefined)?.email ?? '') as string,
    matricula: ((data.snapshotUsuario as { matricula?: string | null } | undefined)?.matricula ?? null) as string | null,
    cargo: ((data.snapshotUsuario as { cargo?: string | null } | undefined)?.cargo ?? null) as string | null,
    tipo: ((data.snapshotUsuario as { tipo?: 'padrao' | 'gestor' } | undefined)?.tipo ?? 'padrao') as 'padrao' | 'gestor',
    horarioEntradaEsperado: ((data.snapshotUsuario as { horarioEntradaEsperado?: string } | undefined)?.horarioEntradaEsperado ?? '08:00') as string,
    horarioSaidaEsperado: ((data.snapshotUsuario as { horarioSaidaEsperado?: string } | undefined)?.horarioSaidaEsperado ?? '17:00') as string,
  },
  snapshotResumo: {
    diasComRegistro: ((data.snapshotResumo as { diasComRegistro?: number } | undefined)?.diasComRegistro ?? 0) as number,
    presentes: ((data.snapshotResumo as { presentes?: number } | undefined)?.presentes ?? 0) as number,
    faltas: ((data.snapshotResumo as { faltas?: number } | undefined)?.faltas ?? 0) as number,
    faltasJustificadas: ((data.snapshotResumo as { faltasJustificadas?: number } | undefined)?.faltasJustificadas ?? 0) as number,
    abonos: ((data.snapshotResumo as { abonos?: number } | undefined)?.abonos ?? 0) as number,
    presencasContestadas: ((data.snapshotResumo as { presencasContestadas?: number } | undefined)?.presencasContestadas ?? 0) as number,
  },
  motivoRejeicao: (data.motivoRejeicao as string | null) ?? null,
  emitidoPor: (data.emitidoPor as string) ?? (data.userId as string),
  createdAt: (data.createdAt as Timestamp) ?? Timestamp.now(),
  updatedAt: (data.updatedAt as Timestamp) ?? Timestamp.now(),
}) as FolhaFrequenciaMensal;

const createOfflineFolha = (
  userId: string,
  actorId: string,
  month: number,
  year: number,
  records: FrequenciaRegistro[],
): FolhaFrequenciaMensal => {
  const now = Timestamp.now();
  return {
    id: makeFolhaId(userId, month, year),
    userId,
    mes: month,
    ano: year,
    status: 'emitida',
    pdfOriginalPath: null,
    pdfOriginalHash: null,
    pdfFuncionarioAssinadoPath: null,
    pdfFuncionarioAssinadoHash: null,
    pdfGestorFinalPath: null,
    pdfGestorFinalHash: null,
    enviadoFuncionarioEm: null,
    revisadoGestorPor: null,
    revisadoGestorEm: null,
    finalizadoGestorPor: null,
    finalizadoGestorEm: null,
    cienteFuncionarioPor: null,
    cienteFuncionarioEm: null,
    snapshotUsuario: {
      nome: 'Sincronização pendente',
      email: '',
      matricula: null,
      cargo: null,
      tipo: 'padrao',
      horarioEntradaEsperado: '08:00',
      horarioSaidaEsperado: '17:00',
    },
    snapshotResumo: buildFolhaResumo(records),
    motivoRejeicao: null,
    emitidoPor: actorId,
    createdAt: now,
    updatedAt: now,
  };
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
  justificativaDocumentoNome: null,
  justificativaDocumentoMime: null,
  justificativaDocumentoTamanhoBytes: null,
  justificativaDocumentoAnexadoEm: null,
  justificativaDocumentoStoragePath: null,
  justificativaObservacaoGestor: null,
  justificativaValidadaPor: null,
  justificativaValidadaEm: null,
  assinaturaUsuario: { ...emptySignature },
  assinaturaGestor: { ...emptySignature },
  contestacaoStatus: 'sem_contestacao' as FrequenciaRegistro['contestacaoStatus'],
  contestacaoCiclo: 0,
  contestacaoMotivo: null,
  contestacaoRespostaFuncionario: null,
  contestacaoDecisao: null,
  contestacaoDecididoPor: null,
  contestacaoDecididaEm: null,
  contestacaoReaberturaMotivo: null,
  contestacaoReabertaPor: null,
  contestacaoReabertaEm: null,
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

type PunchTimeInput = {
  entryTime?: string;
  exitTime?: string;
};

const hasManualTimes = (input?: PunchTimeInput) => Boolean(input?.entryTime || input?.exitTime);

async function registerPunchRemote(profile: UserProfile, date: string, input?: PunchTimeInput) {
  const dayPolicy = await calendarService.getByDate(date);
  if (dayPolicy && !dayPolicy.requerPonto) {
    throw new Error(dayPolicy.motivo ?? 'Este dia está marcado como sem expediente.');
  }

  if (!dayPolicy && !isWeekday(parseDateKey(date))) {
    throw new Error('Fins de semana não registram frequência. Use o calendário para criar exceções.');
  }

  const saved = await saveRemoteRecord(profile.id, date, profile.id, (existing, now) => {
    if (hasManualTimes(input)) {
      const manualEntry = buildTimestampFromDateAndTime(date, input?.entryTime ?? profile.horarioEntradaEsperado, now);
      const manualExit = buildTimestampFromDateAndTime(date, input?.exitTime ?? profile.horarioSaidaEsperado, now);

      if (!existing) {
        return {
          action: 'create',
          next: {
            ...buildRecordTemplate(profile.id, date, now),
            horaEntrada: manualEntry,
            horaSaida: manualExit,
            status: 'presente' as RegistroStatus,
            editadoPor: profile.id,
            editadoEm: now,
          },
        };
      }

      return {
        action: 'update',
        next: {
          ...existing,
          horaEntrada: manualEntry,
          horaSaida: manualExit,
          status: computeStatus(manualEntry, existing.status),
          editadoPor: profile.id,
          editadoEm: now,
        },
      };
    }

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

    const hasEmailProof = existing.justificativaEmailEnviado && Boolean(existing.justificativaEmailAssunto?.trim());
    const hasPdfProof = Boolean(existing.justificativaDocumentoNome?.trim());
    if (!hasEmailProof && !hasPdfProof) {
      throw new Error('Informe um comprovante (e-mail ou PDF) antes de validar.');
    }

    return {
      action: 'approve',
      next: {
        ...existing,
        status: 'falta_justificada',
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
  await messageService.upsertJustificativaStatusMessage({
    userId,
    date,
    status: 'justificativa_aprovada',
  });
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
        status: 'falta',
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
  await messageService.upsertJustificativaStatusMessage({
    userId,
    date,
    status: 'justificativa_recusada',
    managerObservation: observacao.trim(),
  });
  return saved;
}

async function contestPresencaRemote(userId: string, date: string, actorId: string, motivo: string) {
  const saved = await saveRemoteRecord(userId, date, actorId, (existing, now) => {
    if (!existing) {
      throw new Error('Nenhum registro encontrado para contestar.');
    }

    if (existing.status !== 'presente') {
      throw new Error('Só é possível contestar registros com status de presença.');
    }

    if (existing.contestacaoStatus !== 'sem_contestacao') {
      throw new Error('Este registro já possui uma contestação em andamento.');
    }

    return {
      action: 'update',
      next: {
        ...existing,
        status: 'presenca_contestada',
        contestacaoStatus: 'em_contestacao',
        contestacaoCiclo: Math.max(existing.contestacaoCiclo ?? 0, 0) + 1,
        contestacaoMotivo: motivo.trim(),
        contestacaoRespostaFuncionario: null,
        contestacaoDecisao: null,
        contestacaoDecididoPor: null,
        contestacaoDecididaEm: null,
        contestacaoReaberturaMotivo: null,
        contestacaoReabertaPor: null,
        contestacaoReabertaEm: null,
        editadoPor: actorId,
        editadoEm: now,
      },
    };
  });

  if (!saved) {
    throw new Error('Nenhum registro encontrado para contestar.');
  }

  await offlineService.upsertCachedRecord(saved);
  await messageService.upsertContestacaoPresencaMessage(userId, date, motivo.trim());
  return saved;
}

async function respondContestacaoRemote(userId: string, date: string, resposta: string) {
  const saved = await saveRemoteRecord(userId, date, userId, (existing, now) => {
    if (!existing) {
      throw new Error('Nenhum registro encontrado.');
    }

    if (existing.contestacaoStatus !== 'em_contestacao' && existing.contestacaoStatus !== 'respondida') {
      throw new Error('Este registro não possui contestação aberta para resposta.');
    }

    return {
      action: 'update',
      next: {
        ...existing,
        contestacaoStatus: 'respondida',
        contestacaoRespostaFuncionario: resposta.trim(),
        editadoPor: userId,
        editadoEm: now,
      },
    };
  });

  if (!saved) {
    throw new Error('Nenhum registro encontrado.');
  }

  await offlineService.upsertCachedRecord(saved);
  return saved;
}

async function encerrarContestacaoRemote(userId: string, date: string, actorId: string, decisao: ContestacaoDecisao) {
  const saved = await saveRemoteRecord(userId, date, actorId, (existing, now) => {
    if (!existing) {
      throw new Error('Nenhum registro encontrado para encerrar contestação.');
    }

    if (existing.contestacaoStatus !== 'em_contestacao' && existing.contestacaoStatus !== 'respondida') {
      throw new Error('Este registro não possui contestação em andamento.');
    }

    const nextStatus: RegistroStatus = decisao === 'mantida_falta' ? 'falta' : 'presente';

    return {
      action: 'approve',
      next: {
        ...existing,
        status: nextStatus,
        contestacaoStatus: 'encerrada',
        contestacaoDecisao: decisao,
        contestacaoDecididoPor: actorId,
        contestacaoDecididaEm: now,
        editadoPor: actorId,
        editadoEm: now,
      },
    };
  });

  if (!saved) {
    throw new Error('Nenhum registro encontrado para encerrar contestação.');
  }

  await offlineService.upsertCachedRecord(saved);
  await messageService.upsertContestacaoEncerradaMessage(userId, date, decisao);
  return saved;
}

async function reopenContestacaoRemote(userId: string, date: string, actorId: string, motivo: string) {
  const saved = await saveRemoteRecord(userId, date, actorId, (existing, now) => {
    if (!existing) {
      throw new Error('Nenhum registro encontrado para reabertura.');
    }

    if (existing.contestacaoStatus !== 'encerrada') {
      throw new Error('A reabertura só é permitida para contestações encerradas.');
    }

    if (!motivo.trim()) {
      throw new Error('Informe o motivo da reabertura.');
    }

    return {
      action: 'update',
      next: {
        ...existing,
        status: 'presenca_contestada',
        contestacaoStatus: 'em_contestacao',
        contestacaoCiclo: Math.max(existing.contestacaoCiclo ?? 0, 1) + 1,
        contestacaoMotivo: motivo.trim(),
        contestacaoRespostaFuncionario: null,
        contestacaoDecisao: null,
        contestacaoDecididoPor: null,
        contestacaoDecididaEm: null,
        contestacaoReaberturaMotivo: motivo.trim(),
        contestacaoReabertaPor: actorId,
        contestacaoReabertaEm: now,
        editadoPor: actorId,
        editadoEm: now,
      },
    };
  });

  if (!saved) {
    throw new Error('Nenhum registro encontrado para reabertura.');
  }

  await offlineService.upsertCachedRecord(saved);
  await messageService.upsertContestacaoReabertaMessage(userId, date, motivo.trim());
  return saved;
}

async function emitFolhaMensalRemote(userId: string, month: number, year: number, actorId: string) {
  ensureFirebaseConfigured();

  if (actorId !== userId) {
    throw new Error('A emissão da folha mensal deve ser iniciada pelo próprio funcionário.');
  }

  const profile = await userService.getById(userId);
  if (!profile) {
    throw new Error('Perfil do usuário não encontrado para emissão da folha.');
  }

  const { start, end } = getMonthDateRange(month, year);
  const snapshot = await getDocs(
    query(registrosCollection, where('userId', '==', userId), where('data', '>=', start), where('data', '<=', end)),
  );
  const records = dedupeMonthlyRecords(snapshot.docs.map((item) => hydrateRecord(item.id, item.data())));
  const resumo = buildFolhaResumo(records);
  const now = Timestamp.now();
  const id = makeFolhaId(userId, month, year);
  const calendarPolicies = await calendarService.getMonthlyPolicies(month, year);
  const localPdfUri = await folhaPdfService.generateFolhaMensalPdf({
    usuario: {
      nome: profile.nome,
      email: profile.email,
      horarioEntradaEsperado: profile.horarioEntradaEsperado,
      horarioSaidaEsperado: profile.horarioSaidaEsperado,
      matricula: ((profile as unknown) as Record<string, unknown>).matricula as string | null ?? null,
      cargo: ((profile as unknown) as Record<string, unknown>).cargo as string | null ?? null,
      cargaHoraria: ((profile as unknown) as Record<string, unknown>).cargaHoraria as string | null ?? null,
    },
    month,
    year,
    registros: records,
    resumo,
    calendarPolicies,
  });
  const uploadedOriginal = await folhaDocumentService.uploadFolhaOriginalEmitida({
    userId,
    month,
    year,
    fileName: `folha-frequencia-${year}-${`${month}`.padStart(2, '0')}.pdf`,
    mimeType: 'application/pdf',
    fileUri: localPdfUri,
  });
  await folhaDocumentService.createDownloadUrl(uploadedOriginal.path, 60);
  const pdfOriginalPath = uploadedOriginal.path;
  const pdfOriginalHash = uploadedOriginal.hash;

  const ref = getFolhaRef(userId, month, year);
  const existing = await getDoc(ref);
  const createdAt = existing.exists()
    ? ((existing.data() as Record<string, unknown>).createdAt as Timestamp | undefined) ?? now
    : now;

  await setDoc(
    ref,
    {
      id,
      userId,
      mes: month,
      ano: year,
      status: 'aguardando_upload_funcionario',
      pdfOriginalPath,
      pdfOriginalHash,
      pdfFuncionarioAssinadoPath: null,
      pdfFuncionarioAssinadoHash: null,
      pdfGestorFinalPath: null,
      pdfGestorFinalHash: null,
      enviadoFuncionarioEm: null,
      revisadoGestorPor: null,
      revisadoGestorEm: null,
      finalizadoGestorPor: null,
      finalizadoGestorEm: null,
      cienteFuncionarioPor: null,
      cienteFuncionarioEm: null,
      snapshotUsuario: {
        nome: profile.nome,
        email: profile.email,
        matricula: null,
        cargo: null,
        tipo: profile.tipo,
        horarioEntradaEsperado: profile.horarioEntradaEsperado,
        horarioSaidaEsperado: profile.horarioSaidaEsperado,
      },
      snapshotResumo: resumo,
      motivoRejeicao: null,
      emitidoPor: actorId,
      createdAt,
      updatedAt: now,
    },
    { merge: true },
  );

  const folha = hydrateFolhaMensal(id, {
    id,
    userId,
    mes: month,
    ano: year,
    status: 'aguardando_upload_funcionario',
    pdfOriginalPath,
    pdfOriginalHash,
    pdfFuncionarioAssinadoPath: null,
    pdfFuncionarioAssinadoHash: null,
    pdfGestorFinalPath: null,
    pdfGestorFinalHash: null,
    enviadoFuncionarioEm: null,
    revisadoGestorPor: null,
    revisadoGestorEm: null,
    finalizadoGestorPor: null,
    finalizadoGestorEm: null,
    cienteFuncionarioPor: null,
    cienteFuncionarioEm: null,
    snapshotUsuario: {
      nome: profile.nome,
      email: profile.email,
      matricula: null,
      cargo: null,
      tipo: profile.tipo,
      horarioEntradaEsperado: profile.horarioEntradaEsperado,
      horarioSaidaEsperado: profile.horarioSaidaEsperado,
    },
    snapshotResumo: resumo,
    motivoRejeicao: null,
    emitidoPor: actorId,
    createdAt,
    updatedAt: now,
  });

  await offlineService.upsertCachedFolha(folha);
  await messageService.upsertFolhaEmitidaMessage(userId, month, year);
  return folha;
}

async function uploadFolhaAssinadaFuncionarioRemote(
  userId: string,
  month: number,
  year: number,
  actorId: string,
  pdfFuncionarioAssinadoPath: string,
  pdfFuncionarioAssinadoHash: string,
) {
  ensureFirebaseConfigured();
  if (actorId !== userId) {
    throw new Error('Somente o próprio funcionário pode enviar a folha assinada.');
  }

  const ref = getFolhaRef(userId, month, year);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    throw new Error('Folha mensal ainda não foi emitida para este período.');
  }

  const current = hydrateFolhaMensal(snapshot.id, snapshot.data() as Record<string, unknown>);
  const allowed = current.status === 'aguardando_upload_funcionario' || current.status === 'rejeitada_gestor' || current.status === 'emitida';

  if (!allowed) {
    throw new Error('A folha não está em etapa de envio pelo funcionário.');
  }

  const now = Timestamp.now();
  await setDoc(
    ref,
    {
      status: 'enviada_funcionario',
      pdfFuncionarioAssinadoPath,
      pdfFuncionarioAssinadoHash,
      enviadoFuncionarioEm: now,
      motivoRejeicao: null,
      updatedAt: now,
    },
    { merge: true },
  );

  const next = {
    ...current,
    status: 'enviada_funcionario' as FolhaFrequenciaMensal['status'],
    pdfFuncionarioAssinadoPath,
    pdfFuncionarioAssinadoHash,
    enviadoFuncionarioEm: now,
    motivoRejeicao: null,
    updatedAt: now,
  };

  await offlineService.upsertCachedFolha(next);
  await messageService.upsertFolhaEnviadaRevisaoMessage(userId, month, year);
  return next;
}

async function uploadFolhaFinalGestorRemote(
  userId: string,
  month: number,
  year: number,
  actorId: string,
  pdfGestorFinalPath: string,
  pdfGestorFinalHash: string,
) {
  ensureFirebaseConfigured();
  const actor = await userService.getById(actorId);
  if (!actor || actor.tipo !== 'gestor') {
    throw new Error('Somente gestores podem enviar a versão final da folha.');
  }

  const ref = getFolhaRef(userId, month, year);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    throw new Error('Folha mensal não encontrada para envio final.');
  }

  const current = hydrateFolhaMensal(snapshot.id, snapshot.data() as Record<string, unknown>);
  if (current.status !== 'em_revisao_gestor') {
    throw new Error('A folha precisa estar revisada para receber a versão final assinada.');
  }

  const now = Timestamp.now();
  await setDoc(
    ref,
    {
      status: 'final_assinada_gestor',
      pdfGestorFinalPath,
      pdfGestorFinalHash,
      finalizadoGestorPor: actorId,
      finalizadoGestorEm: now,
      updatedAt: now,
    },
    { merge: true },
  );

  const next = {
    ...current,
    status: 'final_assinada_gestor' as FolhaFrequenciaMensal['status'],
    pdfGestorFinalPath,
    pdfGestorFinalHash,
    finalizadoGestorPor: actorId,
    finalizadoGestorEm: now,
    updatedAt: now,
  };

  await offlineService.upsertCachedFolha(next);
  await messageService.upsertFolhaFinalDisponivelMessage(userId, month, year);
  return next;
}

async function confirmarCienciaFolhaFuncionarioRemote(
  userId: string,
  month: number,
  year: number,
  actorId: string,
) {
  ensureFirebaseConfigured();
  if (actorId !== userId) {
    throw new Error('Somente o próprio funcionário pode confirmar ciência da folha.');
  }

  const ref = getFolhaRef(userId, month, year);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    throw new Error('Folha mensal não encontrada para confirmação de ciência.');
  }

  const current = hydrateFolhaMensal(snapshot.id, snapshot.data() as Record<string, unknown>);
  if (current.status !== 'final_assinada_gestor') {
    throw new Error('A folha ainda não está pronta para confirmação de ciência.');
  }

  if (!current.pdfGestorFinalPath) {
    throw new Error('A versão final assinada não foi anexada pela chefia.');
  }

  const now = Timestamp.now();
  await setDoc(
    ref,
    {
      status: 'concluida',
      cienteFuncionarioPor: actorId,
      cienteFuncionarioEm: now,
      updatedAt: now,
    },
    { merge: true },
  );

  const next = {
    ...current,
    status: 'concluida' as FolhaFrequenciaMensal['status'],
    cienteFuncionarioPor: actorId,
    cienteFuncionarioEm: now,
    updatedAt: now,
  };

  await offlineService.upsertCachedFolha(next);
  await messageService.upsertFolhaConcluidaMessage(userId, month, year, 'funcionario');
  if (current.finalizadoGestorPor) {
    await messageService.upsertFolhaConcluidaMessage(current.finalizadoGestorPor, month, year, 'gestor');
  }
  return next;
}

async function reviewFolhaMensalGestorRemote(
  userId: string,
  month: number,
  year: number,
  actorId: string,
  decision: 'aprovar' | 'rejeitar',
  motivo?: string | null,
) {
  ensureFirebaseConfigured();
  const actor = await userService.getById(actorId);
  if (!actor || actor.tipo !== 'gestor') {
    throw new Error('Somente gestores podem revisar a folha mensal.');
  }

  const ref = getFolhaRef(userId, month, year);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    throw new Error('Folha mensal não encontrada para revisão.');
  }

  const current = hydrateFolhaMensal(snapshot.id, snapshot.data() as Record<string, unknown>);
  if (current.status !== 'enviada_funcionario' && current.status !== 'em_revisao_gestor') {
    throw new Error('A folha não está disponível para revisão do gestor.');
  }

  if (decision === 'rejeitar' && !motivo?.trim()) {
    throw new Error('Informe o motivo da rejeição.');
  }

  const now = Timestamp.now();
  const nextStatus: FolhaFrequenciaMensal['status'] = decision === 'aprovar' ? 'em_revisao_gestor' : 'rejeitada_gestor';
  const nextMotivo = decision === 'rejeitar' ? motivo!.trim() : null;

  await setDoc(
    ref,
    {
      status: nextStatus,
      motivoRejeicao: nextMotivo,
      revisadoGestorPor: actorId,
      revisadoGestorEm: now,
      updatedAt: now,
    },
    { merge: true },
  );

  const next = {
    ...current,
    status: nextStatus,
    motivoRejeicao: nextMotivo,
    revisadoGestorPor: actorId,
    revisadoGestorEm: now,
    updatedAt: now,
  };

  await offlineService.upsertCachedFolha(next);
  if (decision === 'rejeitar') {
    await messageService.upsertFolhaRejeitadaGestorMessage(userId, month, year, nextMotivo ?? 'Rejeição sem observação.');
  }
  return next;
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

  async registerPunch(profile: UserProfile, date = getTodayKey(), input?: PunchTimeInput) {
    if (date > getTodayKey()) {
      throw new Error('Não é possível registrar ponto para datas futuras.');
    }

    if (await isOnline()) {
      return registerPunchRemote(profile, date, input);
    }

    const dayPolicy = await calendarService.getByDate(date);
    if (dayPolicy && !dayPolicy.requerPonto) {
      throw new Error(dayPolicy.motivo ?? 'Este dia está marcado como sem expediente.');
    }

    if (!dayPolicy && !isWeekday(parseDateKey(date))) {
      throw new Error('Fins de semana não registram frequência. Use o calendário para criar exceções.');
    }

    const now = Timestamp.now();
    if (hasManualTimes(input)) {
      const entry = buildTimestampFromDateAndTime(date, input?.entryTime ?? profile.horarioEntradaEsperado, now);
      const exit = buildTimestampFromDateAndTime(date, input?.exitTime ?? profile.horarioSaidaEsperado, now);
      const existing = await this.getRecordByDate(profile.id, date);
      const baseRecord = existing ?? buildRecordTemplate(profile.id, date, now);

      const nextRecord = {
        ...baseRecord,
        horaEntrada: entry,
        horaSaida: exit,
        status: computeStatus(entry, baseRecord.status),
        editadoPor: profile.id,
        editadoEm: now,
      };

      await offlineService.upsertCachedRecord(nextRecord);
      await offlineService.queueAction(buildAction('registerPunch', { profile, date, entryTime: input?.entryTime, exitTime: input?.exitTime }));
      return nextRecord;
    }

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

  async getPendingAttendanceDates(userId: string, referenceDate = getTodayKey()) {
    const [year, month, day] = referenceDate.split('-').map(Number);
    const records = await this.getMonthlyRecords(month, year, { userId });
    const policies = await calendarService.getMonthlyPolicies(month, year);
    const byDate = new Map(records.map((record) => [record.data, record]));
    const pendingDates: string[] = [];

    for (let currentDay = 1; currentDay < day; currentDay += 1) {
      const dateKey = formatDateKey(new Date(year, month - 1, currentDay));
      const dayPolicy = policies[dateKey] ?? null;

      if (!isWorkdayForDate(dateKey, dayPolicy)) {
        continue;
      }

      const record = byDate.get(dateKey);
      if (!record) {
        pendingDates.push(dateKey);
        continue;
      }

      const isJustifiedAbsence = record.status === 'falta_justificada' || record.justificativaStatus === 'validada';
      const isExcusedDay = record.status === 'abono';
      const hasCompletePunch = Boolean(record.horaEntrada && record.horaSaida);

      if (!hasCompletePunch && !isJustifiedAbsence && !isExcusedDay) {
        pendingDates.push(dateKey);
      }
    }

    return pendingDates;
  },

  async getFolhaMensal(userId: string, month: number, year: number) {
    if (await isOnline()) {
      ensureFirebaseConfigured();
      const snapshot = await getDoc(getFolhaRef(userId, month, year));
      if (snapshot.exists()) {
        const folha = hydrateFolhaMensal(snapshot.id, snapshot.data() as Record<string, unknown>);
        await offlineService.upsertCachedFolha(folha);
        return folha;
      }
    }

    const cached = await offlineService.getCachedFolhas(userId);
    return cached.find((item) => item.mes === month && item.ano === year) ?? null;
  },

  async emitirFolhaMensal(userId: string, month: number, year: number, actorId = userId) {
    if (await isOnline()) {
      return emitFolhaMensalRemote(userId, month, year, actorId);
    }

    const records = await this.getMonthlyRecords(month, year, { userId });
    const localFolha = createOfflineFolha(userId, actorId, month, year, records);
    await offlineService.upsertCachedFolha(localFolha);
    await offlineService.queueAction(buildAction('emitFolhaMensal', { userId, month, year, actorId }));
    return localFolha;
  },

  async uploadFolhaAssinadaFuncionario(
    userId: string,
    month: number,
    year: number,
    actorId: string,
    pdfFuncionarioAssinadoPath: string,
    pdfFuncionarioAssinadoHash: string,
  ) {
    if (await isOnline()) {
      return uploadFolhaAssinadaFuncionarioRemote(
        userId,
        month,
        year,
        actorId,
        pdfFuncionarioAssinadoPath,
        pdfFuncionarioAssinadoHash,
      );
    }

    const existing = await this.getFolhaMensal(userId, month, year);
    if (!existing) {
      throw new Error('Folha mensal ainda não foi emitida para este período.');
    }

    const now = Timestamp.now();
    const next = {
      ...existing,
      status: 'enviada_funcionario' as FolhaFrequenciaMensal['status'],
      pdfFuncionarioAssinadoPath,
      pdfFuncionarioAssinadoHash,
      enviadoFuncionarioEm: now,
      motivoRejeicao: null,
      updatedAt: now,
    };

    await offlineService.upsertCachedFolha(next);
    await offlineService.queueAction(
      buildAction('uploadFolhaAssinadaFuncionario', {
        userId,
        month,
        year,
        actorId,
        pdfFuncionarioAssinadoPath,
        pdfFuncionarioAssinadoHash,
      }),
    );
    return next;
  },

  async reviewFolhaMensalGestor(
    userId: string,
    month: number,
    year: number,
    actorId: string,
    decision: 'aprovar' | 'rejeitar',
    motivo?: string | null,
  ) {
    if (await isOnline()) {
      return reviewFolhaMensalGestorRemote(userId, month, year, actorId, decision, motivo);
    }

    const existing = await this.getFolhaMensal(userId, month, year);
    if (!existing) {
      throw new Error('Folha mensal não encontrada para revisão.');
    }

    const now = Timestamp.now();
    const nextStatus: FolhaFrequenciaMensal['status'] = decision === 'aprovar' ? 'em_revisao_gestor' : 'rejeitada_gestor';
    const next = {
      ...existing,
      status: nextStatus,
      motivoRejeicao: decision === 'rejeitar' ? motivo?.trim() ?? null : null,
      revisadoGestorPor: actorId,
      revisadoGestorEm: now,
      updatedAt: now,
    };

    await offlineService.upsertCachedFolha(next);
    await offlineService.queueAction(
      buildAction('reviewFolhaMensalGestor', {
        userId,
        month,
        year,
        actorId,
        decision,
        motivo: motivo?.trim() ?? null,
      }),
    );
    return next;
  },

  async uploadFolhaFinalGestor(
    userId: string,
    month: number,
    year: number,
    actorId: string,
    pdfGestorFinalPath: string,
    pdfGestorFinalHash: string,
  ) {
    if (await isOnline()) {
      return uploadFolhaFinalGestorRemote(
        userId,
        month,
        year,
        actorId,
        pdfGestorFinalPath,
        pdfGestorFinalHash,
      );
    }

    const existing = await this.getFolhaMensal(userId, month, year);
    if (!existing) {
      throw new Error('Folha mensal não encontrada para envio final.');
    }

    const now = Timestamp.now();
    const next = {
      ...existing,
      status: 'final_assinada_gestor' as FolhaFrequenciaMensal['status'],
      pdfGestorFinalPath,
      pdfGestorFinalHash,
      finalizadoGestorPor: actorId,
      finalizadoGestorEm: now,
      updatedAt: now,
    };

    await offlineService.upsertCachedFolha(next);
    await offlineService.queueAction(
      buildAction('uploadFolhaFinalGestor', {
        userId,
        month,
        year,
        actorId,
        pdfGestorFinalPath,
        pdfGestorFinalHash,
      }),
    );
    return next;
  },

  async confirmarCienciaFolhaFuncionario(userId: string, month: number, year: number, actorId = userId) {
    if (await isOnline()) {
      return confirmarCienciaFolhaFuncionarioRemote(userId, month, year, actorId);
    }

    const existing = await this.getFolhaMensal(userId, month, year);
    if (!existing) {
      throw new Error('Folha mensal não encontrada para confirmação de ciência.');
    }

    const now = Timestamp.now();
    const next = {
      ...existing,
      status: 'concluida' as FolhaFrequenciaMensal['status'],
      cienteFuncionarioPor: actorId,
      cienteFuncionarioEm: now,
      updatedAt: now,
    };

    await offlineService.upsertCachedFolha(next);
    await offlineService.queueAction(
      buildAction('confirmarCienciaFolhaFuncionario', {
        userId,
        month,
        year,
        actorId,
      }),
    );
    return next;
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
      status: 'falta_justificada' as FrequenciaRegistro['status'],
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
      status: 'falta' as FrequenciaRegistro['status'],
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

  async contestPresenca(userId: string, date: string, actorId: string, motivo: string) {
    if (await isOnline()) {
      return contestPresencaRemote(userId, date, actorId, motivo);
    }

    const existing = await this.getRecordByDate(userId, date);
    if (!existing) {
      throw new Error('Nenhum registro encontrado para contestar.');
    }

    if (existing.status !== 'presente') {
      throw new Error('Só é possível contestar registros com status de presença.');
    }

    const nextRecord = {
      ...existing,
      status: 'presenca_contestada' as FrequenciaRegistro['status'],
      contestacaoStatus: 'em_contestacao' as FrequenciaRegistro['contestacaoStatus'],
      contestacaoCiclo: Math.max(existing.contestacaoCiclo ?? 0, 0) + 1,
      contestacaoMotivo: motivo.trim(),
      contestacaoRespostaFuncionario: null,
      contestacaoDecisao: null,
      contestacaoDecididoPor: null,
      contestacaoDecididaEm: null,
      contestacaoReaberturaMotivo: null,
      contestacaoReabertaPor: null,
      contestacaoReabertaEm: null,
      editadoPor: actorId,
      editadoEm: Timestamp.now(),
    };

    await offlineService.upsertCachedRecord(nextRecord);
    await offlineService.queueAction(buildAction('contestPresenca', { userId, date, actorId, motivo }));
    return nextRecord;
  },

  async respondContestacao(userId: string, date: string, resposta: string) {
    if (await isOnline()) {
      return respondContestacaoRemote(userId, date, resposta);
    }

    const existing = await this.getRecordByDate(userId, date);
    if (!existing) {
      throw new Error('Nenhum registro encontrado.');
    }

    const nextRecord = {
      ...existing,
      contestacaoStatus: 'respondida' as FrequenciaRegistro['contestacaoStatus'],
      contestacaoRespostaFuncionario: resposta.trim(),
      editadoPor: userId,
      editadoEm: Timestamp.now(),
    };

    await offlineService.upsertCachedRecord(nextRecord);
    await offlineService.queueAction(buildAction('respondContestacao', { userId, date, resposta }));
    return nextRecord;
  },

  async encerrarContestacao(userId: string, date: string, actorId: string, decisao: ContestacaoDecisao) {
    if (await isOnline()) {
      return encerrarContestacaoRemote(userId, date, actorId, decisao);
    }

    const existing = await this.getRecordByDate(userId, date);
    if (!existing) {
      throw new Error('Nenhum registro encontrado para encerrar contestação.');
    }

    const nextStatus: RegistroStatus = decisao === 'mantida_falta' ? 'falta' : 'presente';
    const nextRecord = {
      ...existing,
      status: nextStatus,
      contestacaoStatus: 'encerrada' as FrequenciaRegistro['contestacaoStatus'],
      contestacaoDecisao: decisao,
      contestacaoDecididoPor: actorId,
      contestacaoDecididaEm: Timestamp.now(),
      editadoPor: actorId,
      editadoEm: Timestamp.now(),
    };

    await offlineService.upsertCachedRecord(nextRecord);
    await offlineService.queueAction(buildAction('encerrarContestacao', { userId, date, actorId, decisao }));
    return nextRecord;
  },

  async reopenContestacao(userId: string, date: string, actorId: string, motivo: string) {
    if (await isOnline()) {
      return reopenContestacaoRemote(userId, date, actorId, motivo);
    }

    const existing = await this.getRecordByDate(userId, date);
    if (!existing) {
      throw new Error('Nenhum registro encontrado para reabertura.');
    }

    if (existing.contestacaoStatus !== 'encerrada') {
      throw new Error('A reabertura só é permitida para contestações encerradas.');
    }

    if (!motivo.trim()) {
      throw new Error('Informe o motivo da reabertura.');
    }

    const now = Timestamp.now();
    const nextRecord = {
      ...existing,
      status: 'presenca_contestada' as FrequenciaRegistro['status'],
      contestacaoStatus: 'em_contestacao' as FrequenciaRegistro['contestacaoStatus'],
      contestacaoCiclo: Math.max(existing.contestacaoCiclo ?? 0, 1) + 1,
      contestacaoMotivo: motivo.trim(),
      contestacaoRespostaFuncionario: null,
      contestacaoDecisao: null,
      contestacaoDecididoPor: null,
      contestacaoDecididaEm: null,
      contestacaoReaberturaMotivo: motivo.trim(),
      contestacaoReabertaPor: actorId,
      contestacaoReabertaEm: now,
      editadoPor: actorId,
      editadoEm: now,
    };

    await offlineService.upsertCachedRecord(nextRecord);
    await offlineService.queueAction(buildAction('reopenContestacao', { userId, date, actorId, motivo }));
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
          await registerPunchRemote(action.payload.profile, action.payload.date ?? getTodayKey(), {
            entryTime: action.payload.entryTime,
            exitTime: action.payload.exitTime,
          });
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

        if (action.type === 'contestPresenca') {
          await contestPresencaRemote(action.payload.userId, action.payload.date, action.payload.actorId, action.payload.motivo);
        }

        if (action.type === 'respondContestacao') {
          await respondContestacaoRemote(action.payload.userId, action.payload.date, action.payload.resposta);
        }

        if (action.type === 'encerrarContestacao') {
          await encerrarContestacaoRemote(action.payload.userId, action.payload.date, action.payload.actorId, action.payload.decisao);
        }

        if (action.type === 'reopenContestacao') {
          await reopenContestacaoRemote(action.payload.userId, action.payload.date, action.payload.actorId, action.payload.motivo);
        }

        if (action.type === 'emitFolhaMensal') {
          await emitFolhaMensalRemote(action.payload.userId, action.payload.month, action.payload.year, action.payload.actorId);
        }

        if (action.type === 'uploadFolhaAssinadaFuncionario') {
          await uploadFolhaAssinadaFuncionarioRemote(
            action.payload.userId,
            action.payload.month,
            action.payload.year,
            action.payload.actorId,
            action.payload.pdfFuncionarioAssinadoPath,
            action.payload.pdfFuncionarioAssinadoHash,
          );
        }

        if (action.type === 'reviewFolhaMensalGestor') {
          await reviewFolhaMensalGestorRemote(
            action.payload.userId,
            action.payload.month,
            action.payload.year,
            action.payload.actorId,
            action.payload.decision,
            action.payload.motivo,
          );
        }

        if (action.type === 'uploadFolhaFinalGestor') {
          await uploadFolhaFinalGestorRemote(
            action.payload.userId,
            action.payload.month,
            action.payload.year,
            action.payload.actorId,
            action.payload.pdfGestorFinalPath,
            action.payload.pdfGestorFinalHash,
          );
        }

        if (action.type === 'confirmarCienciaFolhaFuncionario') {
          await confirmarCienciaFolhaFuncionarioRemote(
            action.payload.userId,
            action.payload.month,
            action.payload.year,
            action.payload.actorId,
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