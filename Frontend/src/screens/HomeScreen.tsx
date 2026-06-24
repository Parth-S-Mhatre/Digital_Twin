import { Animated, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MedicalBackdrop } from '@/components/MedicalBackdrop';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuth } from '@/context/AuthContext';
import { colors, radius, spacing } from '@/theme';
import { useEntranceAnimation } from '@/hooks/useEntranceAnimation';

export function HomeScreen() {
  const { user, logout } = useAuth();
  const cardStyle = useEntranceAnimation(80);

  return (
    <SafeAreaView style={styles.safeArea}>
      <MedicalBackdrop />
      <Animated.View style={[styles.card, cardStyle]}>
        <Text style={styles.kicker}>Authenticated session</Text>
        <Text style={styles.title}>Hello, {user?.name ?? 'User'}</Text>
        <Text style={styles.subtitle}>
          You are signed in. This space can become your medical dashboard, vitals view, and digital twin summary.
        </Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{user?.email ?? 'unknown'}</Text>
        </View>

        <PrimaryButton title="Logout" onPress={logout} variant="secondary" />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    boxShadow: '0px 10px 18px rgba(14, 70, 210, 0.12)',
    elevation: 3,
  },
  kicker: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  infoBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    gap: spacing.xs,
  },
  infoLabel: {
    color: colors.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
