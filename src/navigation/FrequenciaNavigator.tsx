import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { FrequenciaScreen } from '../screens/frequencia/FrequenciaScreen';
import { HistoricoScreen } from '../screens/frequencia/HistoricoScreen';
import { RegistroScreen } from '../screens/frequencia/RegistroScreen';
import { theme } from '../utils/theme';
import { FrequenciaStackParamList } from './types';

const Stack = createNativeStackNavigator<FrequenciaStackParamList>();

export function FrequenciaNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTitleStyle: { color: theme.colors.text, fontWeight: '700' },
      }}
    >
      <Stack.Screen component={FrequenciaScreen} name="FrequenciaHome" options={{ title: 'Frequência' }} />
      <Stack.Screen component={RegistroScreen} name="Registro" options={{ title: 'Registro do dia' }} />
      <Stack.Screen component={HistoricoScreen} name="Historico" options={{ title: 'Histórico' }} />
    </Stack.Navigator>
  );
}