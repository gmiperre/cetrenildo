import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

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
    if (!Device.isDevice) {
      return null;
    }

    const permissions = await Notifications.getPermissionsAsync();
    const granted = permissions.granted || permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

    if (!granted) {
      const requested = await Notifications.requestPermissionsAsync();
      if (!requested.granted) {
        return null;
      }
    }

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });

    return token.data;
  },

  async schedulePunchReminder(time: string) {
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
  },
};