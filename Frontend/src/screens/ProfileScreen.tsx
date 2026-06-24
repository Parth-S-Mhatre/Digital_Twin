import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MedicalBackdrop } from '@/components/MedicalBackdrop';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuth } from '@/context/AuthContext';
import { colors, radius, spacing } from '@/theme';

export function ProfileScreen() {
  const { user, profile, profileInitializing, logout, clearProfile } = useAuth();
  const router = useRouter();

  if (profileInitializing) return null;

  const bmi = (() => {
    if (!profile?.height || !profile?.weight) return '';
    const h = parseFloat(profile.height);
    const w = parseFloat(profile.weight);
    if (!h || !w) return '';
    const value = w / ((h / 100) * (h / 100));
    return `${value.toFixed(1)}`;
  })();

  return (
    <SafeAreaView style={styles.safeArea}>
      <MedicalBackdrop />
      <View style={styles.container}>
        <Text style={styles.title}>{user?.name ?? 'Your profile'}</Text>
        <Text style={styles.subtitle}>{user?.email}</Text>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Completion</Text>
            <Text style={styles.metricValue}>{profile ? 'Saved' : 'Not started'}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Blood group</Text>
            <Text style={styles.metricValue}>{profile?.bloodGroup || '—'}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>BMI</Text>
            <Text style={styles.metricValue}>{bmi || '—'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <Text style={styles.sectionText}>{profile?.notes || 'No clinical notes provided.'}</Text>
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            title="Edit profile"
            onPress={() => void router.push('/form?mode=profile')}
          />
          <PrimaryButton title="Sign out" onPress={logout} variant="secondary" />
          <PrimaryButton title="Clear profile" onPress={clearProfile} variant="secondary" />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  metricCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 12,
  },
  metricValue: {
    color: colors.primaryDark,
    fontSize: 16,
    fontWeight: '800',
  },
  section: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 16,
  },
  sectionText: {
    color: colors.muted,
    marginTop: spacing.sm,
  },
  actions: {
    gap: spacing.sm,
  },
});
