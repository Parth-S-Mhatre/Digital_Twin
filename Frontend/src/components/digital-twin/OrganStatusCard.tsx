import { useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
  useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';

import type { OrganHealth } from '@/constants/health';
import { HEALTH_STATUS_COLORS } from '@/constants/health';
import { colors, radius, shadows, spacing } from '@/theme';

type Props = {
  organ: OrganHealth | null;
  isSelected?: boolean;
  onPress?: (organ: OrganHealth) => void;
  variant?: 'compact' | 'detail';
};

const STATUS_LABELS: Record<OrganHealth['status'], string> = {
  healthy: 'Healthy',
  moderate: 'Moderate',
  warning: 'Warning',
  critical: 'Critical',
};

const DIAGNOSTIC_NOTES: Record<string, string> = {
  Brain: 'Neural activity and cognitive stress levels are within optimal ranges.',
  Heart: 'Cardiovascular rhythm and rate are being monitored for sustained anomalies.',
  Lungs: 'Respiratory function and oxygen saturation are tracked continuously.',
  Liver: 'Hepatic enzyme levels indicate metabolic processing efficiency.',
  Kidneys: 'Renal filtration rates and hydration markers are within expected bounds.',
  Digestive: 'Microbiome diversity and gut processing are evaluated regularly.',
};

function getTrend(status: OrganHealth['status']) {
  if (status === 'healthy') return 'Stable';
  if (status === 'moderate') return '+5%';
  if (status === 'warning') return '+10%';
  return '+15%';
}

export function OrganStatusCard({ organ, isSelected = false, onPress, variant = 'compact' }: Props) {
  const [scale] = useState(() => new Animated.Value(1));
  const { width } = useWindowDimensions();
  const isCompact = width < 640;

  if (!organ) {
    if (variant !== 'detail') return null;

    return (
      <View style={styles.detailEmpty}>
        <Text style={styles.detailEmptyTitle}>Organ Diagnostics</Text>
        <View style={styles.detailEmptyBody}>
          <Text style={styles.detailEmptyIcon}>◎</Text>
          <Text style={styles.detailEmptyText}>
            Select an organ on the 3D model to view detailed diagnostics.
          </Text>
        </View>
      </View>
    );
  }

  const color = organ.color || HEALTH_STATUS_COLORS[organ.status];
  const trend = getTrend(organ.status);
  const notes = DIAGNOSTIC_NOTES[organ.name] ?? 'Health metrics are being analyzed.';

  const animatePress = () => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.96,
        duration: 90,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 120,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };

  const handlePress = (_event: GestureResponderEvent) => {
    animatePress();
    onPress?.(organ);
  };

  if (variant === 'detail') {
    return (
      <View style={styles.detailContainer}>
        <View style={[styles.detailBanner, { backgroundColor: color }]} />
        <View style={[styles.detailHeader, isCompact && styles.detailHeaderCompact]}>
          <Text style={styles.detailTitle}>{organ.name} Diagnostics</Text>
          <Text style={styles.menu}>•••</Text>
        </View>

        <View style={[styles.detailStatusRow, isCompact && styles.detailStatusRowCompact]}>
          <View style={[styles.detailOrganBadge, { backgroundColor: `${color}22`, borderColor: color }]}>
            <Text style={[styles.detailOrganInitial, { color }]}>{organ.name.charAt(0)}</Text>
          </View>
          <View>
            <Text style={styles.detailOrganName}>{organ.name}</Text>
            <Text style={[styles.detailStatusBadge, { color }]}>{STATUS_LABELS[organ.status]}</Text>
          </View>
        </View>

        <View style={[styles.detailMetrics, isCompact && styles.detailMetricsCompact]}>
          <View style={styles.detailMetricBox}>
            <Text style={styles.detailMetricLabel}>Health Score</Text>
            <Text style={styles.detailMetricValue}>
              {organ.percentage}
              <Text style={styles.detailMetricUnit}>%</Text>
            </Text>
          </View>
          <View style={styles.detailMetricBox}>
            <Text style={styles.detailMetricLabel}>Recent Trend</Text>
            <Text
              style={[
                styles.detailTrendValue,
                trend.includes('+') && organ.status !== 'healthy'
                  ? styles.trendWarning
                  : styles.trendStable,
              ]}
            >
              {trend}
            </Text>
          </View>
        </View>

        <View style={styles.detailNotes}>
          <Text style={styles.detailNotesTitle}>Diagnostic Notes</Text>
          <Text style={styles.detailNotesBody}>{notes}</Text>
        </View>

        <View style={styles.detailDiagnosticsList}>
          {Object.values(STATUS_LABELS).map((label) => (
            <View key={label} style={styles.detailDiagnosticRow}>
              <Text style={styles.detailDiagnosticLabel}>{organ.name}</Text>
              <View
                style={[
                  styles.detailDiagnosticBadge,
                  {
                    backgroundColor:
                      label === STATUS_LABELS[organ.status] ? `${color}22` : colors.surfaceAlt,
                    borderColor: label === STATUS_LABELS[organ.status] ? color : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.detailDiagnosticBadgeText,
                    { color: label === STATUS_LABELS[organ.status] ? color : colors.muted },
                  ]}
                >
                  {label}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <Pressable onPress={handlePress} accessibilityRole="button" accessibilityLabel={`${organ.name} health card`}>
      <Animated.View
        style={[
          styles.card,
          {
            borderColor: isSelected ? color : colors.border,
            backgroundColor: `${color}12`,
            transform: [{ scale }],
          },
          isSelected && styles.cardSelected,
        ]}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.name}>{organ.name}</Text>
            <Text style={styles.statusText}>{STATUS_LABELS[organ.status]}</Text>
          </View>
          <View style={[styles.badge, { borderColor: color, backgroundColor: `${color}20` }]}>
            <Text style={[styles.badgeText, { color }]}>{organ.percentage}%</Text>
          </View>
        </View>

        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${organ.percentage}%`, backgroundColor: color }]} />
        </View>

        <Text style={styles.label} numberOfLines={2}>
          {organ.percentage}% estimated health
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    backgroundColor: colors.surface,
    minWidth: 140,
    ...shadows.card,
  },
  cardSelected: {
    borderWidth: 1.5,
    ...shadows.glow,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  name: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  statusText: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  badge: {
    minWidth: 56,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    alignItems: 'center',
  },
  badgeText: {
    fontWeight: '800',
    fontSize: 12,
  },
  barTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
  },
  label: {
    marginTop: spacing.sm,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  detailContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    flex: 1,
    minHeight: 420,
    ...shadows.card,
  },
  detailBanner: {
    height: 4,
    width: '100%',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  detailHeaderCompact: {
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  menu: {
    color: colors.muted,
    fontSize: 16,
    letterSpacing: 2,
  },
  detailStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  detailStatusRowCompact: {
    alignItems: 'flex-start',
  },
  detailOrganBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailOrganInitial: {
    fontSize: 22,
    fontWeight: '800',
  },
  detailOrganName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  detailStatusBadge: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  detailMetrics: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  detailMetricsCompact: {
    flexDirection: 'column',
  },
  detailMetricBox: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  detailMetricLabel: {
    fontSize: 11,
    color: colors.muted,
    marginBottom: 4,
  },
  detailMetricValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  detailMetricUnit: {
    fontSize: 12,
    color: colors.muted,
  },
  detailTrendValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  trendStable: {
    color: colors.primary,
  },
  trendWarning: {
    color: colors.warning,
  },
  detailNotes: {
    margin: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailNotesTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  detailNotesBody: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
  },
  detailDiagnosticsList: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  detailDiagnosticRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailDiagnosticLabel: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  detailDiagnosticBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  detailDiagnosticBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  detailEmpty: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flex: 1,
    minHeight: 420,
    ...shadows.card,
  },
  detailEmptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    padding: spacing.lg,
  },
  detailEmptyBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  detailEmptyIcon: {
    fontSize: 40,
    color: colors.faint,
    marginBottom: spacing.md,
  },
  detailEmptyText: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
