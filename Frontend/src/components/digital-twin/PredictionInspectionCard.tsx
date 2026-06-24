import { StyleSheet, Text, View } from 'react-native';

import type { PredictionResponse } from '@/types/api';
import { colors, radius, shadows, spacing } from '@/theme';

type Props = {
  prediction: PredictionResponse | null;
  title?: string;
};

export function PredictionInspectionCard({ prediction, title = 'Prediction inspection' }: Props) {
  if (!prediction) {
    return null;
  }

  const xgb = clampPercent(prediction.model_outputs.xgboost_probability);
  const bilstm = clampPercent(prediction.model_outputs.bilstm_probability);
  const fusion = clampPercent(
    prediction.model_outputs.fusion_probability ?? prediction.risk_probability
  );

  const disagreement = Math.max(xgb, bilstm, fusion) - Math.min(xgb, bilstm, fusion);
  const hasStrongDisagreement = disagreement >= 50;
  const dominantBranch =
    xgb >= bilstm && xgb >= fusion ? 'Tabular' : bilstm >= fusion ? 'BiLSTM' : 'Fusion';

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            Raw branch outputs for debugging and trust checks.
          </Text>
        </View>
        <View style={[styles.badge, hasStrongDisagreement && styles.badgeWarning]}>
          <Text style={[styles.badgeText, hasStrongDisagreement && styles.badgeTextWarning]}>
            {hasStrongDisagreement ? 'Branches disagree' : 'Branches aligned'}
          </Text>
        </View>
      </View>

      <View style={styles.rows}>
        <InspectionRow label="Tabular" value={xgb} color={colors.primary} />
        <InspectionRow label="BiLSTM" value={bilstm} color={colors.warning} />
        <InspectionRow label="Fusion" value={fusion} color={colors.danger} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerLabel}>Dominant branch</Text>
        <Text style={styles.footerValue}>{dominantBranch}</Text>
      </View>

      {hasStrongDisagreement && (
        <Text style={styles.note}>
          The temporal branch is far higher than the tabular branch. Treat the fused score as a
          disagreement case and inspect the raw branches before trusting the overall risk.
        </Text>
      )}
    </View>
  );
}

function InspectionRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, { color }]}>{value.toFixed(1)}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${value}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function clampPercent(value: number | null | undefined) {
  if (!Number.isFinite(value ?? NaN)) return 0;
  return Math.max(0, Math.min((value ?? 0) * 100, 100));
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeWarning: {
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    borderColor: 'rgba(249, 115, 22, 0.3)',
  },
  badgeText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTextWarning: {
    color: colors.warning,
  },
  rows: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  row: {
    gap: 6,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  footer: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLabel: {
    color: colors.muted,
    fontSize: 12,
  },
  footerValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  note: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.sm,
  },
});
