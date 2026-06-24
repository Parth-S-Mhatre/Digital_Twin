import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DigitalTwinCard,
  HealthScoreCard,
  OrganStatusCard,
  PredictionInspectionCard,
} from '@/components/digital-twin';
import { DashboardSkeleton } from '@/components/digital-twin/DashboardSkeleton';
import { MedicalBackdrop } from '@/components/MedicalBackdrop';
import { PrimaryButton } from '@/components/PrimaryButton';
import { HEALTH_STATUS_COLORS } from '@/constants/health';
import { useAuth } from '@/context/AuthContext';
import { useHealth } from '@/context/HealthContext';
import { useScenario } from '@/context/ScenarioContext';
import { useAlert } from '@/context/AlertContext';
import { useEntranceAnimation } from '@/hooks/useEntranceAnimation';
import { colors, radius, shadows, spacing } from '@/theme';

export function DashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { data, loading, error, refreshHealth } = useHealth();
  const { baselinePrediction, scenarioPrediction } = useScenario();
  const { showAlert } = useAlert();
  const { width } = useWindowDimensions();
  const isWide = width >= 980;
  const isCompact = width < 640;
  const [showSkeleton, setShowSkeleton] = useState(false);

  // Surface backend/health errors as a non-blocking alert.
  useEffect(() => {
    if (error) {
      showAlert({
        level: 'warning',
        title: 'Could not load health data',
        message: error,
      });
    }
  }, [error, showAlert]);

  useEffect(() => {
    if (data) {
      setShowSkeleton(false);
      return;
    }

    if (!loading) {
      setShowSkeleton(Boolean(error));
      return;
    }

    const timer = setTimeout(() => setShowSkeleton(true), 1200);
    return () => clearTimeout(timer);
  }, [data, loading, error]);

  const heroStyle = useEntranceAnimation(80);
  const leftStyle = useEntranceAnimation(180);
  const rightStyle = useEntranceAnimation(260);

  const criticalOrgans = useMemo(
    () => Object.values(data?.metrics.organs ?? {}).filter((organ) => organ.status === 'critical'),
    [data]
  );

  const riskColor = useMemo(() => {
    switch (data?.metrics.riskCategory) {
      case 'medium':
        return HEALTH_STATUS_COLORS.moderate;
      case 'high':
        return HEALTH_STATUS_COLORS.warning;
      case 'critical':
        return HEALTH_STATUS_COLORS.critical;
      default:
        return HEALTH_STATUS_COLORS.healthy;
    }
  }, [data]);
  const activePrediction = scenarioPrediction ?? baselinePrediction;

  const handleSignOut = async () => {
    await logout();
    router.replace('/');
  };

  if (!data) {
    return (
      <DashboardSkeleton
        state={error ? 'offline' : loading && showSkeleton ? 'slow' : 'loading'}
        message={
          error
            ? `We could not reach the backend. ${error}`
            : loading && showSkeleton
              ? 'This is a lightweight shell while your data loads.'
              : loading
                ? 'Loading your digital twin...'
                : 'No digital twin data is available yet.'
        }
        onRetry={refreshHealth}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <MedicalBackdrop />
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshHealth} />}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.shell}>
          <Animated.View style={[styles.hero, heroStyle]}>
            <View style={[styles.heroTopRow, isCompact && styles.heroTopRowCompact]}>
              <View style={styles.badge}>
                <View style={styles.badgeDot} />
                <Text style={styles.badgeText}>Live dashboard</Text>
              </View>

              <Pressable onPress={handleSignOut} style={styles.signOutButton}>
                <Text style={styles.signOutText}>Sign out</Text>
              </Pressable>
            </View>

            <Text style={styles.title}>Health dashboard</Text>
            <Text style={styles.subtitle}>
              {user?.name ? `${user.name}'s ` : 'Your '}digital twin is now routed through the
              unified avatar stack, with live organ signals, a risk banner, and refresh support.
            </Text>

            {criticalOrgans.length > 0 && (
              <View style={styles.alertBanner}>
                <Text style={styles.alertTitle}>Critical attention required</Text>
                <Text style={styles.alertText}>
                  {criticalOrgans.map((organ) => organ.name).join(', ')} are marked critical.
                  Review the detailed twin view for more context.
                </Text>
              </View>
            )}
          </Animated.View>

          <View style={[styles.grid, isWide && styles.gridWide, !isWide && styles.gridStacked]}>
            <Animated.View style={[styles.leftColumn, isCompact && styles.columnCompact, leftStyle]}>
              <DigitalTwinCard onPress={() => router.push('/digital-twin')} />

              <View style={styles.panel}>
                <View style={styles.panelHeader}>
                  <View>
                    <Text style={styles.panelTitle}>Overall health</Text>
                    <Text style={styles.panelSubtitle}>Summary score and current risk band</Text>
                  </View>
                </View>
                <HealthScoreCard
                  score={data.metrics.overallScore}
                  riskCategory={data.metrics.riskCategory}
                  riskColor={riskColor}
                />
                <View style={styles.inspectionSpacer}>
                  <PredictionInspectionCard
                    title="Branch inspection"
                    prediction={activePrediction}
                  />
                </View>
              </View>

              {/* What-if scenario entry point */}
              <Pressable
                style={({ pressed }) => [styles.scenarioCard, pressed && styles.scenarioCardPressed]}
                onPress={() => router.push('/scenario')}
              >
                <View style={styles.scenarioIconRow}>
                  <View style={styles.scenarioIcon}>
                    <Text style={styles.scenarioIconText}>∿</Text>
                  </View>
                  <View style={styles.scenarioCopy}>
                    <Text style={styles.scenarioTitle}>What-if scenario</Text>
                    <Text style={styles.scenarioText}>
                      Adjust sliders for age, BMI, blood pressure and more — watch your digital
                      twin respond in real time.
                    </Text>
                  </View>
                  <Text style={styles.scenarioChevron}>→</Text>
                </View>
              </Pressable>
            </Animated.View>

            <Animated.View style={[styles.rightColumn, isCompact && styles.columnCompact, rightStyle]}>
              <View style={styles.panel}>
                <View style={styles.panelHeader}>
                  <View>
                    <Text style={styles.panelTitle}>Vital signs</Text>
                    <Text style={styles.panelSubtitle}>Pulled from the current mock health context</Text>
                  </View>
                </View>

                <View style={styles.vitalsGrid}>
                  <VitalCard label="Heart rate" value={`${data.metrics.vitals.heartRate}`} unit="bpm" compact={isCompact} />
                  <VitalCard label="Blood pressure" value={data.metrics.vitals.bloodPressure} unit="" compact={isCompact} />
                  <VitalCard label="Temperature" value={`${data.metrics.vitals.temperature}`} unit="°F" compact={isCompact} />
                  <VitalCard label="Oxygen" value={`${data.metrics.vitals.oxygenLevel}`} unit="%" compact={isCompact} />
                </View>
              </View>

              <View style={styles.panel}>
                <View style={styles.panelHeader}>
                  <View>
                    <Text style={styles.panelTitle}>Organ health</Text>
                    <Text style={styles.panelSubtitle}>Compact tiles with score bars and status badges</Text>
                  </View>
                </View>

                <View style={styles.organGrid}>
                  {Object.entries(data.metrics.organs).map(([key, organ]) => (
                    <OrganStatusCard key={key} organ={organ} />
                  ))}
                </View>
              </View>

              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Insight summary</Text>
                <Text style={styles.summaryText}>
                  Cardiovascular markers are stable, while liver and digestive health should stay on
                  watch. Use the detailed digital twin screen for organ-by-organ inspection and tap
                  interactions.
                </Text>
                <View style={styles.summaryActions}>
                  <PrimaryButton title="Open Digital Twin" onPress={() => router.push('/digital-twin')} />
                  <PrimaryButton title="Refresh Data" onPress={refreshHealth} variant="secondary" />
                </View>
              </View>
            </Animated.View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function VitalCard({
  label,
  value,
  unit,
  compact = false,
}: {
  label: string;
  value: string;
  unit: string;
  compact?: boolean;
}) {
  return (
    <View style={[styles.vitalCard, compact && styles.vitalCardCompact]}>
      <Text style={styles.vitalLabel}>{label}</Text>
      <View style={styles.vitalRow}>
        <Text style={styles.vitalValue}>{value}</Text>
        {unit ? <Text style={styles.vitalUnit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  shell: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  hero: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    ...shadows.card,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroTopRowCompact: {
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  badgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  signOutButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signOutText: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    marginTop: spacing.lg,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  alertBanner: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(217, 45, 32, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(217, 45, 32, 0.25)',
  },
  alertTitle: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '800',
  },
  alertText: {
    color: colors.text,
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  grid: {
    gap: spacing.lg,
  },
  gridStacked: {
    flexDirection: 'column',
  },
  gridWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  leftColumn: {
    flex: 1,
    gap: spacing.lg,
  },
  rightColumn: {
    flex: 1,
    gap: spacing.lg,
  },
  columnCompact: {
    width: '100%',
  },
  panel: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    ...shadows.card,
  },
  panelHeader: {
    marginBottom: spacing.md,
  },
  inspectionSpacer: {
    marginTop: spacing.md,
  },
  panelTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  panelSubtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  vitalCard: {
    width: '48%',
    minWidth: 140,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  vitalCardCompact: {
    width: '100%',
    minWidth: 0,
  },
  vitalLabel: {
    color: colors.muted,
    fontSize: 12,
  },
  vitalRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginTop: spacing.xs,
  },
  vitalValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  vitalUnit: {
    color: colors.faint,
    fontSize: 12,
    marginBottom: 2,
  },
  organGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  summaryActions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  scenarioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    ...shadows.glow,
  },
  scenarioCardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  scenarioIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  scenarioIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EAF3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scenarioIconText: {
    fontSize: 24,
    color: colors.primary,
    fontWeight: '900',
  },
  scenarioCopy: {
    flex: 1,
    gap: 4,
  },
  scenarioTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  scenarioText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  scenarioChevron: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 15,
  },
});
