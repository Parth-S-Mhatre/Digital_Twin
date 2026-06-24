import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MedicalBackdrop } from '@/components/MedicalBackdrop';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, radius, shadows, spacing } from '@/theme';

export type DashboardSkeletonState = 'loading' | 'slow' | 'offline';

type Props = {
  state: DashboardSkeletonState;
  message?: string;
  onRetry?: () => void;
};

export function DashboardSkeleton({ state, message, onRetry }: Props) {
  const { width } = useWindowDimensions();
  const isWide = width >= 980;
  const isCompact = width < 640;
  const [pulse] = useState(() => new Animated.Value(0.35));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <MedicalBackdrop />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.shell}>
          <View style={[styles.hero, isCompact && styles.heroCompact]}>
            <View style={[styles.heroTopRow, isCompact && styles.heroTopRowCompact]}>
              <SkeletonBlock style={styles.badge} pulse={pulse} />
              <SkeletonBlock style={styles.smallPill} pulse={pulse} />
            </View>
            <SkeletonBlock style={styles.titleLine} pulse={pulse} />
            <SkeletonBlock style={styles.subtitleLine} pulse={pulse} />
            <SkeletonBlock style={[styles.subtitleLine, styles.subtitleLineShort]} pulse={pulse} />

            <View style={styles.statusRow}>
              <View style={styles.statusDotWrap}>
                <View style={styles.statusDot} />
              </View>
              <View style={styles.statusCopy}>
                <Text style={styles.statusTitle}>
                  {state === 'offline'
                    ? 'Backend unavailable'
                    : state === 'slow'
                      ? 'Connection is slow'
                      : 'Loading your digital twin'}
                </Text>
                <Text style={styles.statusText}>
                  {message ??
                    (state === 'offline'
                      ? 'We could not reach the backend. The shell below keeps the page usable while you retry.'
                      : state === 'slow'
                        ? 'Your connection looks constrained, so we are showing a lightweight dashboard shell.'
                        : 'We are preparing your dashboard and digital twin metrics.' )}
                </Text>
              </View>
            </View>

            {onRetry ? (
              <View style={styles.retryRow}>
                <PrimaryButton title="Retry" onPress={onRetry} variant="secondary" />
              </View>
            ) : null}
          </View>

          <View style={[styles.grid, isWide && styles.gridWide]}>
            <View style={[styles.column, isWide && styles.columnWide]}>
              <View style={styles.card}>
                <SkeletonBlock style={styles.cardTitle} pulse={pulse} />
                <View style={styles.avatarSkeleton}>
                  <SkeletonBlock style={styles.avatarHead} pulse={pulse} />
                  <SkeletonBlock style={styles.avatarBody} pulse={pulse} />
                  <View style={styles.avatarOrgansRow}>
                    <SkeletonBlock style={styles.avatarOrgan} pulse={pulse} />
                    <SkeletonBlock style={styles.avatarOrgan} pulse={pulse} />
                    <SkeletonBlock style={styles.avatarOrgan} pulse={pulse} />
                  </View>
                </View>
              </View>

              <View style={styles.card}>
                <SkeletonBlock style={styles.sectionTitle} pulse={pulse} />
                <View style={styles.metricGrid}>
                  <SkeletonMetric pulse={pulse} />
                  <SkeletonMetric pulse={pulse} />
                </View>
              </View>
            </View>

            <View style={[styles.column, isWide && styles.columnWide]}>
              <View style={styles.card}>
                <SkeletonBlock style={styles.sectionTitle} pulse={pulse} />
                <View style={styles.listBlock}>
                  <SkeletonLine pulse={pulse} width="100%" />
                  <SkeletonLine pulse={pulse} width="86%" />
                  <SkeletonLine pulse={pulse} width="92%" />
                  <SkeletonLine pulse={pulse} width="74%" />
                </View>
              </View>

              <View style={styles.card}>
                <SkeletonBlock style={styles.sectionTitle} pulse={pulse} />
                <View style={[styles.chartBlock, isCompact && styles.chartBlockCompact]}>
                  <SkeletonLine pulse={pulse} width="100%" height={18} />
                  <SkeletonLine pulse={pulse} width="92%" height={18} />
                  <SkeletonLine pulse={pulse} width="80%" height={18} />
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SkeletonBlock({ pulse, style }: { pulse: Animated.Value; style: StyleProp<ViewStyle> }) {
  return <Animated.View style={[styles.block, { opacity: pulse }, style]} />;
}

function SkeletonLine({
  pulse,
  width,
  height = 12,
}: {
  pulse: Animated.Value;
  width: number | `${number}%`;
  height?: number;
}) {
  return <Animated.View style={[styles.block, { opacity: pulse, width, height, borderRadius: height / 2 }]} />;
}

function SkeletonMetric({ pulse }: { pulse: Animated.Value }) {
  return (
    <View style={styles.metricCard}>
      <SkeletonLine pulse={pulse} width={60} height={10} />
      <SkeletonLine pulse={pulse} width={44} height={26} />
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
    padding: spacing.lg,
    gap: spacing.lg,
  },
  hero: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  heroCompact: {
    padding: spacing.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  heroTopRowCompact: {
    flexWrap: 'wrap',
  },
  badge: {
    width: 120,
    height: 28,
    borderRadius: 999,
  },
  smallPill: {
    width: 88,
    height: 28,
    borderRadius: 999,
  },
  titleLine: {
    width: '72%',
    height: 28,
    borderRadius: 14,
  },
  subtitleLine: {
    width: '100%',
    height: 14,
    borderRadius: 7,
  },
  subtitleLineShort: {
    width: '78%',
  },
  statusRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    marginTop: spacing.xs,
  },
  statusDotWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  statusCopy: {
    flex: 1,
    gap: 6,
  },
  statusTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  statusText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  retryRow: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  grid: {
    gap: spacing.lg,
  },
  gridWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  column: {
    gap: spacing.lg,
  },
  columnWide: {
    flex: 1,
    minWidth: 0,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  cardTitle: {
    width: '46%',
    height: 18,
    borderRadius: 9,
  },
  sectionTitle: {
    width: '38%',
    height: 16,
    borderRadius: 8,
  },
  avatarSkeleton: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  avatarHead: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarBody: {
    width: '70%',
    height: 180,
    borderRadius: 32,
  },
  avatarOrgansRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  avatarOrgan: {
    width: 68,
    height: 36,
    borderRadius: 18,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricCard: {
    flex: 1,
    minWidth: 0,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  listBlock: {
    gap: spacing.sm,
  },
  chartBlock: {
    gap: spacing.sm,
  },
  chartBlockCompact: {
    gap: spacing.xs,
  },
  block: {
    backgroundColor: 'rgba(148, 163, 184, 0.18)',
  },
});
