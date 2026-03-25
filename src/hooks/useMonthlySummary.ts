import { useCallback, useEffect, useState } from 'react';

import { FrequenciaRegistro } from '../models/frequencia';
import { frequenciaService } from '../services/frequenciaService';
import { getExpectedWorkDays } from '../utils/date';

export function useMonthlySummary(userId?: string) {
  const [records, setRecords] = useState<FrequenciaRegistro[]>([]);
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
    const remoteRecords = await frequenciaService.getMonthlyRecords(month, year, { userId });
    setRecords(remoteRecords);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh().catch(() => setLoading(false));
  }, [refresh]);

  const today = new Date();
  const expected = getExpectedWorkDays(today.getMonth() + 1, today.getFullYear());
  const workedDays = records.filter((record) => record.status === 'presente' || record.status === 'abono').length;

  return {
    loading,
    workedDays,
    missedDays: Math.max(expected - workedDays, 0),
    records,
    refresh,
  };
}