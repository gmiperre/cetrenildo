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
      
      // Timeout de 5 segundos para evitar que fica pendurada
      const permissionsPromise = Notifications.getPermissionsAsync();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout ao solicitar permissões')), 5000)
      );
      
      const permissions = await Promise.race([permissionsPromise, timeoutPromise]) as Notifications.NotificationPermissionsStatus;
      const granted = permissions.granted || permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

      if (!granted) {
        console.log('📲 Permissões não concedidas - solicitando...');
        const requestedPromise = Notifications.requestPermissionsAsync();
        const requested = await Promise.race([requestedPromise, timeoutPromise]) as Notifications.NotificationPermissionsStatus;
        
        if (!requested.granted) {
          console.log('⚠️ Usuário recusou permissões');
          return null;
        }
      }

      console.log('📲 Obtendo token de push...');
      const tokenPromise = Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });
      
      const token = await Promise.race([tokenPromise, timeoutPromise]);
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