import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';

import { FrequenciaRegistro } from '../models/frequencia';
import { buildJustificativaUpdateState, computeJustificativaStatus, getJustificativaStatusLabel } from './frequencia';

const createBaseRecord = (): FrequenciaRegistro => ({
  id: 'user-1_2026-03-25',
  userId: 'user-1',
  data: '2026-03-25',
  horaEntrada: null,
  horaSaida: null,
  status: 'falta',
  justificativaTexto: null,
  justificativaCanal: null,
  justificativaStatus: 'sem_justificativa',
  justificativaEmailEnviado: false,
  justificativaEmailEm: null,
  justificativaEmailAssunto: null,
  justificativaEmailProtocolo: null,
  justificativaObservacaoGestor: null,
  justificativaValidadaPor: null,
  justificativaValidadaEm: null,
  assinaturaUsuario: {
    confirmado: false,
    userId: null,
    timestamp: null,
  },
  assinaturaGestor: {
    confirmado: false,
    userId: null,
    timestamp: null,
  },
  editadoPor: null,
  editadoEm: null,
  criadoEm: Timestamp.fromMillis(1_742_860_800_000),
});

describe('frequencia domain', () => {
  it('returns explicit status when provided', () => {
    expect(computeJustificativaStatus('validada', 'texto', false)).toBe('validada');
  });

  it('returns sem_justificativa when text is empty', () => {
    expect(computeJustificativaStatus(undefined, '   ', false)).toBe('sem_justificativa');
  });

  it('returns pendente_envio when text exists but email was not sent', () => {
    expect(computeJustificativaStatus(undefined, 'Atestado médico', false)).toBe('pendente_envio');
  });

  it('returns em_analise when text exists and email was sent', () => {
    expect(computeJustificativaStatus(undefined, 'Atestado médico', true)).toBe('em_analise');
  });

  it('builds justificativa update state consistently', () => {
    const now = Timestamp.fromMillis(1_742_900_000_000);
    const baseRecord = createBaseRecord();

    const result = buildJustificativaUpdateState(
      baseRecord,
      {
        userId: 'user-1',
        data: '2026-03-25',
        actorId: 'user-1',
        justificativaTexto: 'Consulta médica',
        justificativaEmailEnviado: true,
        justificativaEmailAssunto: 'JUSTIFICATIVA | 123 | 2026-03-25 | CONSULTA',
      },
      now,
    );

    expect(result.justificativaCanal).toBe('email');
    expect(result.justificativaStatus).toBe('em_analise');
    expect(result.justificativaEmailEm).toEqual(now);
    expect(result.justificativaEmailAssunto).toContain('JUSTIFICATIVA');
  });

  it('returns the default label for empty status', () => {
    expect(getJustificativaStatusLabel(undefined)).toBe('Sem justificativa');
  });

  it('returns the configured label for recusada', () => {
    expect(getJustificativaStatusLabel('recusada')).toBe('Recusada');
  });
});