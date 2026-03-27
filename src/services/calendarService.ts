import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';

import { CalendarDay } from '../models/calendar';
import { db, ensureFirebaseConfigured } from './firebase';

const calendarCollection = collection(db, 'calendarDays');

let monthCache = new Map<string, Record<string, CalendarDay>>();

const hydrateCalendarDay = (id: string, data: Record<string, unknown>): CalendarDay => ({
  id,
  data: (data.data as string) ?? id,
  tipo: (data.tipo as CalendarDay['tipo']) ?? 'util',
  requerPonto: (data.requerPonto as boolean) ?? true,
  motivo: (data.motivo as string | null) ?? null,
  horarioEntradaOverride: (data.horarioEntradaOverride as string | null) ?? null,
  horarioSaidaOverride: (data.horarioSaidaOverride as string | null) ?? null,
});

const monthKey = (month: number, year: number) => `${year}-${String(month).padStart(2, '0')}`;

export const calendarService = {
  async getByDate(date: string) {
    try {
      ensureFirebaseConfigured();
      const snapshot = await getDoc(doc(calendarCollection, date));

      if (!snapshot.exists()) {
        return null;
      }

      const policy = hydrateCalendarDay(snapshot.id, snapshot.data() as Record<string, unknown>);
      const [year, month] = date.split('-');
      const cacheId = `${year}-${month}`;
      const monthPolicies = monthCache.get(cacheId) ?? {};
      monthCache.set(cacheId, { ...monthPolicies, [policy.data]: policy });
      return policy;
    } catch {
      const [year, month] = date.split('-');
      const cacheId = `${year}-${month}`;
      const cached = monthCache.get(cacheId);
      return cached?.[date] ?? null;
    }
  },

  async getMonthlyPolicies(month: number, year: number) {
    const cacheId = monthKey(month, year);
    const cached = monthCache.get(cacheId);
    if (cached) {
      return cached;
    }

    try {
      ensureFirebaseConfigured();

      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const end = `${year}-${String(month).padStart(2, '0')}-31`;

      const snapshot = await getDocs(query(calendarCollection, where('data', '>=', start), where('data', '<=', end)));
      const policies = Object.fromEntries(
        snapshot.docs.map((item) => {
          const policy = hydrateCalendarDay(item.id, item.data());
          return [policy.data, policy];
        }),
      );

      monthCache.set(cacheId, policies);
      return policies;
    } catch {
      return cached ?? {};
    }
  },

  clearCache() {
    monthCache = new Map<string, Record<string, CalendarDay>>();
  },
};
