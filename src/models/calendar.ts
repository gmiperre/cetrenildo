export type CalendarDayType = 'util' | 'feriado' | 'ponto_facultativo' | 'sem_expediente';

export interface CalendarDay {
  id: string;
  data: string;
  tipo: CalendarDayType;
  requerPonto: boolean;
  motivo: string | null;
  horarioEntradaOverride: string | null;
  horarioSaidaOverride: string | null;
}
