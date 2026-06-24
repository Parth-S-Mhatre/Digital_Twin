import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadows, spacing } from '@/theme';

type Props = {
  score: number;
  riskCategory: string;
  riskColor: string;
};

export function HealthScoreCard({ score, riskCategory, riskColor }: Props) {
  const normalized = Math.max(0, Math.min(score, 100));

  return (
    <View style={styles.container}>
      <View style={styles.scoreRow}>
        <View style={[styles.scoreCircle, { borderColor: riskColor }]}>
          <Text style={styles.scoreNumber}>{normalized}</Text>
          <Text style={styles.scoreLabel}>score</Text>
        </View>

        <View style={styles.copyColumn}>
          <Text style={styles.title}>Overall health</Text>
          <Text style={styles.subtitle}>
            The current digital twin profile is evaluated against the latest mock metrics.
          </Text>
          <View style={[styles.badge, { borderColor: riskColor, backgroundColor: `${riskColor}18` }]}>
            <Text style={[styles.badgeText, { color: riskColor }]}>{riskCategory}</Text>
          </View>
        </View>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${normalized}%`, backgroundColor: riskColor }]} />
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
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  scoreCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundElement,
  },
  scoreNumber: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 32,
  },
  scoreLabel: {
    color: colors.muted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  copyColumn: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginTop: spacing.md,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
    marginTop: spacing.lg,
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});
