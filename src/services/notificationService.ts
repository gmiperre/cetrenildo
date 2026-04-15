import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { calendarService } from './calendarService';
import { frequenciaService } from './frequenciaService';
import { getTodayKey, isWorkdayForDate } from '../utils/date';
import { messageService } from './messageService';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const parseHourAndMinute = (time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  return { hour, minute };
};

const withTimeout = <T>(promise: Promise<T>, timeoutMessage: string, timeoutMs = 5000) => {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
};

const PENDING_ATTENDANCE_LAST_SENT_PREFIX = 'pending-attendance-last-sent';
const PENDING_ATTENDANCE_HISTORY_PREFIX = 'pending-attendance-history';
const NOTIFICATION_RETENTION_DAYS = 90;

type PendingAttendanceHistoryItem = {
  sentAt: string;
  pendingCount: number;
  oldestPendingDate: string | null;
};

const getPendingAttendanceStorageKey = (userId: string) => `${PENDING_ATTENDANCE_LAST_SENT_PREFIX}:${userId}`;
const getPendingAttendanceHistoryKey = (userId: string) => `${PENDING_ATTENDANCE_HISTORY_PREFIX}:${userId}`;

const getRetentionCutoffTime = () => {
  const now = new Date();
  now.setDate(now.getDate() - NOTIFICATION_RETENTION_DAYS);
  return now.getTime();
};

const prunePendingAttendanceHistory = (history: PendingAttendanceHistoryItem[]) => {
  const cutoff = getRetentionCutoffTime();
  return history.filter((item) => {
    const timestamp = new Date(item.sentAt).getTime();
    return Number.isFinite(timestamp) && timestamp >= cutoff;
  });
};

export const notificationService = {
  configure() {
    Notifications.setNotificationChannelAsync('default', {
      name: 'Padrão',
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => undefined);
  },

  async registerForPushNotifications() {
    // Web não suporta push notifications
    if (Platform.OS === 'web') {
      console.log('ℹ️ Push notifications não suportado em web');
      return null;
    }

    if (!Device.isDevice) {
      console.log('ℹ️ Aplicação rodando em emulador/simulador');
      return null;
    }

    try {
      console.log('📲 Solicitando permissões de notificação...');

      const permissions = await withTimeout(
        Notifications.getPermissionsAsync(),
        'Timeout ao solicitar permissões',
      );
      const granted = permissions.granted || permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

      if (!granted) {
        console.log('📲 Permissões não concedidas - solicitando...');
        const requested = await withTimeout(
          Notifications.requestPermissionsAsync(),
          'Timeout ao solicitar permissões',
        );
        
        if (!requested.granted) {
          console.log('⚠️ Usuário recusou permissões');
          return null;
        }
      }

      console.log('📲 Obtendo token de push...');
      const token = await withTimeout(
        Notifications.getExpoPushTokenAsync({
          projectId: Constants.expoConfig?.extra?.eas?.projectId,
        }),
        'Timeout ao obter token de push',
      );
      console.log('✅ Token de push obtido');
      return token.data;
    } catch (error) {
      console.warn('⚠️ Erro ao registrar push notifications:', error);
      return null;
    }
  },

  async schedulePunchReminder(time: string) {
    // Web não suporta notificações agendadas
    if (Platform.OS === 'web') {
      console.log('ℹ️ Notificações agendadas não suportado em web');
      return;
    }

    try {
      const { hour, minute } = parseHourAndMinute(time);

      await Notifications.cancelAllScheduledNotificationsAsync();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Lembrete de frequência',
          body: 'Registre seu ponto no Equipe Cetreina.',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      });
      console.log('✅ Notificação agendada para', time);
    } catch (error) {
      console.warn('⚠️ Erro ao agendar notificação:', error);
    }
  },

  async syncDailyReminderMessage(userId: string) {
    if (Platform.OS === 'web') {
      return;
    }

    try {
      const todayKey = getTodayKey();
      const [todayPolicy, todayRecord] = await Promise.all([
        calendarService.getByDate(todayKey),
        frequenciaService.getRecordByDate(userId, todayKey),
      ]);

      if (!isWorkdayForDate(todayKey, todayPolicy)) {
        return;
      }

      const hasCompletePunch = Boolean(todayRecord?.horaEntrada && todayRecord?.horaSaida);
      const isJustifiedAbsence = todayRecord?.status === 'falta_justificada' || todayRecord?.justificativaStatus === 'validada';
      const isExcusedDay = todayRecord?.status === 'abono';

      if (hasCompletePunch || isJustifiedAbsence || isExcusedDay) {
        return;
      }

      await messageService.pruneExpiredMessages(userId);
      await messageService.upsertDailyReminderMessage(userId, todayKey);
    } catch (error) {
      console.warn('⚠️ Erro ao sincronizar lembrete diário na caixa de mensagens:', error);
    }
  },

  async notifyPendingAttendance(userId: string) {
    if (Platform.OS === 'web') {
      return;
    }

    try {
      const todayKey = getTodayKey();
      const storageKey = getPendingAttendanceStorageKey(userId);
      const historyKey = getPendingAttendanceHistoryKey(userId);
      const lastSentDate = await AsyncStorage.getItem(storageKey);
      const rawHistory = await AsyncStorage.getItem(historyKey);
      const parsedHistory = rawHistory ? (JSON.parse(rawHistory) as PendingAttendanceHistoryItem[]) : [];
      const retainedHistory = prunePendingAttendanceHistory(parsedHistory);

      if (retainedHistory.length !== parsedHistory.length) {
        await AsyncStorage.setItem(historyKey, JSON.stringify(retainedHistory));
      }

      if (lastSentDate === todayKey) {
        return;
      }

      const pendingDates = await frequenciaService.getPendingAttendanceDates(userId, todayKey);
      await messageService.pruneExpiredMessages(userId);

      if (!pendingDates.length) {
        return;
      }

      await messageService.upsertPendingAttendanceMessage(
        userId,
        todayKey,
        pendingDates.length,
        pendingDates[0] ?? null,
      );

      const firstPending = pendingDates[0].split('-').reverse().join('/');
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Frequência pendente',
          body:
            pendingDates.length === 1
              ? `Você tem 1 pendência de frequência (${firstPending}). Toque para regularizar.`
              : `Você tem ${pendingDates.length} pendências de frequência. A mais antiga é ${firstPending}.`,
        },
        trigger: null,
      });

      await AsyncStorage.setItem(storageKey, todayKey);
      const updatedHistory = prunePendingAttendanceHistory([
        ...retainedHistory,
        {
          sentAt: new Date().toISOString(),
          pendingCount: pendingDates.length,
          oldestPendingDate: pendingDates[0] ?? null,
        },
      ]);
      await AsyncStorage.setItem(historyKey, JSON.stringify(updatedHistory));
    } catch (error) {
      console.warn('⚠️ Erro ao notificar pendências de frequência:', error);
    }
  },
};