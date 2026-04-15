import { Timestamp } from 'firebase/firestore';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FrequenciaRegistro, OfflineAction } from '../models/frequencia';

const storage = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
    clear: vi.fn(async () => {
      storage.clear();
    }),
  },
}));

import { offlineService } from './offlineService';

const createRecord = (): FrequenciaRegistro => ({
  id: 'user-1_2026-03-25',
  userId: 'user-1',
  data: '2026-03-25',
  horaEntrada: Timestamp.fromMillis(1_742_860_800_000),
  horaSaida: Timestamp.fromMillis(1_742_889_600_000),
  status: 'presente',
  justificativaTexto: 'Consulta médica',
  justificativaCanal: 'email',
  justificativaStatus: 'em_analise',
  justificativaEmailEnviado: true,
  justificativaEmailEm: Timestamp.fromMillis(1_742_860_800_000),
  justificativaEmailAssunto: 'Assunto',
  justificativaEmailProtocolo: 'msg-1',
  justificativaObservacaoGestor: null,
  justificativaValidadaPor: null,
  justificativaValidadaEm: null,
  assinaturaUsuario: {
    confirmado: true,
    userId: 'user-1',
    timestamp: Timestamp.fromMillis(1_742_860_800_000),
  },
  assinaturaGestor: {
    confirmado: false,
    userId: null,
    timestamp: null,
  },
  contestacaoStatus: 'sem_contestacao',
  contestacaoCiclo: 0,
  contestacaoMotivo: null,
  contestacaoRespostaFuncionario: null,
  contestacaoDecisao: null,
  contestacaoDecididoPor: null,
  contestacaoDecididaEm: null,
  contestacaoReaberturaMotivo: null,
  contestacaoReabertaPor: null,
  contestacaoReabertaEm: null,
  editadoPor: 'user-1',
  editadoEm: Timestamp.fromMillis(1_742_860_800_000),
  criadoEm: Timestamp.fromMillis(1_742_860_800_000),
});

describe('offlineService', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('rehydrates Timestamp fields when reading cached records', async () => {
    await offlineService.setCachedRecords('user-1', [createRecord()]);

    const records = await offlineService.getCachedRecords('user-1');

    expect(records).toHaveLength(1);
    expect(records[0].horaEntrada).toBeInstanceOf(Timestamp);
    expect(records[0].horaSaida).toBeInstanceOf(Timestamp);
    expect(records[0].assinaturaUsuario.timestamp).toBeInstanceOf(Timestamp);
    expect(records[0].horaEntrada?.toMillis()).toBe(1_742_860_800_000);
  });

  it('preserves typed payload and timestamp data in pending actions', async () => {
    const action: OfflineAction<'updateRegistro'> = {
      id: 'action-1',
      type: 'updateRegistro',
      payload: {
        userId: 'user-1',
        data: '2026-03-25',
        actorId: 'user-1',
        justificativaTexto: 'Consulta médica',
        justificativaEmailEnviado: true,
        justificativaEmailEm: Timestamp.fromMillis(1_742_860_800_000),
      },
      createdAt: '2026-03-25T12:00:00.000Z',
      retryCount: 0,
      lastAttemptAt: null,
      lastError: null,
    };

    await offlineService.queueAction(action);

    const actions = await offlineService.getPendingActions();

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('updateRegistro');
    if (actions[0].type !== 'updateRegistro') {
      throw new Error('Tipo de ação inesperado no teste.');
    }
    expect(actions[0].payload.justificativaEmailEm).toBeInstanceOf(Timestamp);
    expect(actions[0].payload.justificativaEmailEm?.toMillis()).toBe(1_742_860_800_000);
  });
});