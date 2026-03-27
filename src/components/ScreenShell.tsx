import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav } from './BottomNav';
import { theme } from '../utils/theme';

interface ScreenShellProps {
  children: React.ReactNode;
  scrollable?: boolean;
  showNav?: boolean;
  contentStyle?: ViewStyle;
}

export function ScreenShell({ children, scrollable = true, showNav = true, contentStyle }: ScreenShellProps) {
  const insets = useSafeAreaInsets();
  // Reserve space below scrollable content so nav bar never obscures it.
  // 56 = bar height (icon + label + paddingTop); add device bottom inset on top.
  const navExtraBottom = showNav ? 56 + insets.bottom : 0;

  if (!scrollable) {
    return (
      <View style={styles.outerFill}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={[styles.content, styles.inner, styles.fill, { paddingBottom: theme.spacing.xl + navExtraBottom }, contentStyle]}>
            {children}
          </View>
        </SafeAreaView>
        {showNav ? <BottomNav /> : null}
      </View>
    );
  }

  return (
    <View style={styles.outerFill}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: theme.spacing.xl + navExtraBottom }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.inner, contentStyle]}>{children}</View>
        </ScrollView>
      </SafeAreaView>
      {showNav ? <BottomNav /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  outerFill: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.md,
  },
  inner: {
    gap: theme.spacing.md,
  },
  fill: {
    flex: 1,
  },
});