import { NavigationContainer, DefaultTheme } from '@react-navigation/native';

import { useAuth } from '../hooks/useAuth';
import { theme } from '../utils/theme';
import { AppTabs } from './AppTabs';
import { AuthNavigator } from './AuthNavigator';

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: theme.colors.background,
    card: theme.colors.surface,
    text: theme.colors.text,
    primary: theme.colors.primary,
    border: theme.colors.border,
  },
};

export function RootNavigator() {
  const { firebaseUser } = useAuth();

  return <NavigationContainer theme={navigationTheme}>{firebaseUser ? <AppTabs /> : <AuthNavigator />}</NavigationContainer>;
}