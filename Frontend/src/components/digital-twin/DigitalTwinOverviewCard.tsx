import { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import type { OrganHealth } from '@/constants/health';
import { HEALTH_STATUS_COLORS } from '@/constants/health';
import { colors, radius, shadows, spacing } from '@/theme';

type Props = {
  organs: Record<string, OrganHealth>;
  overallScore: number;
};

export function DigitalTwinOverviewCard({ organs, overallScore }: Props) {
  const organList = useMemo(() => Object.values(organs), [organs]);
  const { width } = useWindowDimensions();
  const isCompact = width < 640;

  return (
    <View style={styles.container}>
      <View style={[styles.header, isCompact && styles.headerCompact]}>
        <View>
          <Text style={styles.title}>Digital Twin Overview</Text>
          <Text style={styles.subtitle}>Systemic Health Status</Text>
        </View>
        <View style={styles.scoreBlock}>
          <Text style={styles.scoreValue}>{overallScore}</Text>
          <Text style={styles.scoreLabel}>Vitals Score</Text>
        </View>
      </View>

      <View style={[styles.organGrid, isCompact && styles.organGridCompact]}>
        {organList.map((organ) => {
          const color = organ.color || HEALTH_STATUS_COLORS[organ.status];
          return (
            <View key={organ.name} style={[styles.organTile, isCompact && styles.organTileCompact]}>
              <View style={[styles.statusDot, { backgroundColor: color }]} />
              <Text style={styles.organName}>{organ.name}</Text>
              {(organ.status === 'warning' || organ.status === 'critical') && (
                <Text style={[styles.alertMark, { color }]}>!</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  headerCompact: {
    gap: spacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  scoreBlock: {
    alignItems: 'flex-end',
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.primary,
  },
  scoreLabel: {
    fontSize: 10,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  organGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  organGridCompact: {
    flexDirection: 'column',
  },
  organTile: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  organTileCompact: {
    width: '100%',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  organName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  alertMark: {
    fontSize: 12,
    fontWeight: '800',
  },
});
