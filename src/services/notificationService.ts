import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

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
};