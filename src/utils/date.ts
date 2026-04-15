import { Timestamp } from 'firebase/firestore';

import { CalendarDay } from '../models/calendar';
import { FrequenciaRegistro, RegistroListItem } from '../models/frequencia';

const MONTH_FORMATTER = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const DAY_FORMATTER = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const TIME_FORMATTER = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

export const getTodayKey = () => formatDateKey(new Date());

export const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const parseDateKey = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const formatDisplayDate = (value: string) => DAY_FORMATTER.format(parseDateKey(value));

export const formatMonthLabel = (month: number, year: number) => {
  return MONTH_FORMATTER.format(new Date(year, month - 1, 1));
};

export const formatTime = (value?: Timestamp | Date | null) => {
  if (!value) {
    return '--:--';
  }

  const date = value instanceof Timestamp ? value.toDate() : value;
  return TIME_FORMATTER.format(date);
};

export const isWeekday = (date: Date) => date.getDay() !== 0 && date.getDay() !== 6;

/**
 * Retorna se a data exige frequência.
 * - Dia útil sem política de calendário: exige.
 * - Fim de semana sem política: NÃO exige.
 * - Qualquer dia COM política: respeita o campo `requerPonto` da política.
 */
export const isWorkdayForDate = (dateKey: string, dayPolicy: CalendarDay | null): boolean => {
  if (dayPolicy !== null) {
    return dayPolicy.requerPonto;
  }

  return isWeekday(parseDateKey(dateKey));
};

export const getMonthDateRange = (month: number, year: number) => {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);

  return {
    start: formatDateKey(start),
    end: formatDateKey(end),
  };
};

export const getExpectedWorkDays = (month: number, year: number) => {
  const today = new Date();
  const lastDay = month === today.getMonth() + 1 && year === today.getFullYear() ? today.getDate() : new Date(year, month, 0).getDate();

  let count = 0;
  for (let day = 1; day <= lastDay; day += 1) {
    if (isWeekday(new Date(year, month - 1, day))) {
      count += 1;
    }
  }

  return count;
};

export const getStatusColor = (status: FrequenciaRegistro['status'], pending = false) => {
  if (pending) {
    return '#D5A021';
  }

  if (status === 'presente') {
    return '#218A5A';
  }

  if (status === 'falta_justificada') {
    return '#B7791F';
  }

  if (status === 'abono') {
    return '#2A6F97';
  }

  if (status === 'presenca_contestada') {
    return '#7C3AED';
  }

  return '#C44536';
};

export const buildSyntheticRecord = (userId: string, date: string, status: FrequenciaRegistro['status'] = 'falta'): RegistroListItem => {
  const now = Timestamp.now();

  return {
    id: `synthetic-${userId}-${date}`,
    userId,
    data: date,
    horaEntrada: null,
    horaSaida: null,
    status,
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
    editadoPor: null,
    editadoEm: null,
    criadoEm: now,
    isSynthetic: true,
  };
};

export const buildMonthlyTimeline = (records: FrequenciaRegistro[], month: number, year: number, userId?: string) => {
  if (!userId) {
    return [...records].sort((left, right) => right.data.localeCompare(left.data));
  }

  const byDate = new Map(records.map((record) => [record.data, record]));
  const today = new Date();
  const lastDay = month === today.getMonth() + 1 && year === today.getFullYear() ? today.getDate() : new Date(year, month, 0).getDate();

  const timeline: RegistroListItem[] = [];

  for (let day = 1; day <= lastDay; day += 1) {
    const current = new Date(year, month - 1, day);
    if (!isWeekday(current)) {
      continue;
    }

    const dateKey = formatDateKey(current);
    const existing = byDate.get(dateKey);
    timeline.push(existing ? existing : buildSyntheticRecord(userId, dateKey));
  }

  return timeline.sort((left, right) => right.data.localeCompare(left.data));
};

export const getMonthNavigation = (month: number, year: number, direction: 'prev' | 'next') => {
  const date = new Date(year, month - 1, 1);
  date.setMonth(date.getMonth() + (direction === 'prev' ? -1 : 1));

  return {
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
};

export const buildMonthlyTimelineByPolicy = (
  records: FrequenciaRegistro[],
  month: number,
  year: number,
  userId?: string,
  calendarPolicies: Record<string, CalendarDay> = {},
) => {
  if (!userId) {
    return [...records].sort((left, right) => right.data.localeCompare(left.data));
  }

  const byDate = new Map(records.map((record) => [record.data, record]));
  const today = new Date();
  const lastDay = month === today.getMonth() + 1 && year === today.getFullYear() ? today.getDate() : new Date(year, month, 0).getDate();

  const timeline: RegistroListItem[] = [];

  for (let day = 1; day <= lastDay; day += 1) {
    const current = new Date(year, month - 1, day);
    const dateKey = formatDateKey(current);
    const policy = calendarPolicies[dateKey];
    const includeDay = policy ? true : isWeekday(current);

    if (!includeDay) {
      continue;
    }

    const existing = byDate.get(dateKey);
    if (existing) {
      timeline.push(existing);
      continue;
    }

    const syntheticStatus: FrequenciaRegistro['status'] = policy && !policy.requerPonto ? 'abono' : 'falta';
    timeline.push(buildSyntheticRecord(userId, dateKey, syntheticStatus));
  }

  return timeline.sort((left, right) => right.data.localeCompare(left.data));
};