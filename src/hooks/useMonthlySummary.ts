import { useCallback, useEffect, useState } from 'react';

import { FrequenciaRegistro } from '../models/frequencia';
import { calendarService } from '../services/calendarService';
import { frequenciaService } from '../services/frequenciaService';
import { formatDateKey, isWeekday } from '../utils/date';

export function useMonthlySummary(userId?: string) {
  const [records, setRecords] = useState<FrequenciaRegistro[]>([]);
  const [expectedDays, setExpectedDays] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setRecords([]);
      return;
    }

    setLoading(true);
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    const [remoteRecords, policies] = await Promise.all([
      frequenciaService.getMonthlyRecords(month, year, { userId }),
      calendarService.getMonthlyPolicies(month, year),
    ]);
    setRecords(remoteRecords);

    const lastDay = new Date(year, month, 0).getDate();
    let expected = 0;
    for (let day = 1; day <= lastDay; day += 1) {
      const current = new Date(year, month - 1, day);
      if (current > today) {
        break;
      }

      const dateKey = formatDateKey(current);
      const policy = policies[dateKey];

      if (policy) {
        if (policy.requerPonto) {
          expected += 1;
        }
        continue;
      }

      if (isWeekday(current)) {
        expected += 1;
      }
    }

    setExpectedDays(expected);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh().catch(() => setLoading(false));
  }, [refresh]);

  const workedDays = records.filter((record) => record.status === 'presente' || record.status === 'abono').length;
  const justifiedDays = records.filter((record) => record.status === 'falta_justificada').length;

  return {
    loading,
    workedDays,
    justifiedDays,
    missedDays: Math.max(expectedDays - workedDays - justifiedDays, 0),
    records,
    refresh,
  };
}