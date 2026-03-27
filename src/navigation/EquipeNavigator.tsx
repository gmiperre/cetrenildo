import { Pressable, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CadastroFuncionarioScreen } from '../screens/equipe/CadastroFuncionarioScreen';
import { EquipeScreen } from '../screens/equipe/EquipeScreen';
import { theme } from '../utils/theme';
import { EquipeStackParamList } from './types';

const Stack = createNativeStackNavigator<EquipeStackParamList>();

export function EquipeNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTitleStyle: { color: theme.colors.text, fontWeight: '700' },
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen
        component={EquipeScreen}
        name="EquipeHome"
        options={({ navigation }) => ({
          title: 'Equipe',
          headerLeft: () => (
            <Pressable onPress={() => navigation.getParent()?.goBack()} style={{ paddingVertical: 4, paddingRight: 12 }}>
              <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Módulos</Text>
            </Pressable>
          ),
        })}
      />
      <Stack.Screen
        component={CadastroFuncionarioScreen}
        name="CadastroFuncionario"
        options={{ title: 'Cadastrar Funcionário' }}
      />
    </Stack.Navigator>
  );
}
