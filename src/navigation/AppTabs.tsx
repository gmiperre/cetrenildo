import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { HomeScreen } from '../screens/home/HomeScreen';
import { FrequenciaNavigator } from './FrequenciaNavigator';
import { AppTabParamList } from './types';
import { theme } from '../utils/theme';

const Tabs = createBottomTabNavigator<AppTabParamList>();

export function AppTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          height: 72,
          paddingBottom: 10,
          paddingTop: 10,
          backgroundColor: theme.colors.surface,
        },
        tabBarIcon: ({ color, size }) => {
          const iconName = route.name === 'HomeTab' ? 'home-outline' : 'time-outline';
          return <Ionicons color={color} name={iconName} size={size} />;
        },
      })}
    >
      <Tabs.Screen component={HomeScreen} name="HomeTab" options={{ title: 'Início' }} />
      <Tabs.Screen component={FrequenciaNavigator} name="FrequenciaTab" options={{ title: 'Frequência' }} />
    </Tabs.Navigator>
  );
}