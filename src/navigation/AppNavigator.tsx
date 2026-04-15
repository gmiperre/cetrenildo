import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { HomeScreen } from '../screens/home/HomeScreen';
import { ModulosScreen } from '../screens/home/ModulosScreen';
import { FeriasScreen } from '../screens/ferias/FeriasScreen';
import { MensagensScreen } from '../screens/messages/MensagensScreen';
import { theme } from '../utils/theme';
import { EquipeNavigator } from './EquipeNavigator';
import { FrequenciaNavigator } from './FrequenciaNavigator';
import { AppStackParamList } from './types';

const Stack = createNativeStackNavigator<AppStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTitleStyle: { color: theme.colors.text, fontWeight: '700' },
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen component={HomeScreen} name="Home" options={{ headerShown: false }} />
      <Stack.Screen component={ModulosScreen} name="Modulos" options={{ title: 'Módulos' }} />
      <Stack.Screen component={MensagensScreen} name="MensagensModule" options={{ title: 'Mensagens' }} />
      <Stack.Screen component={FrequenciaNavigator} name="FrequenciaModule" options={{ headerShown: false }} />
      <Stack.Screen component={FeriasScreen} name="FeriasModule" options={{ title: 'Férias' }} />
      <Stack.Screen component={EquipeNavigator} name="EquipeModule" options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}