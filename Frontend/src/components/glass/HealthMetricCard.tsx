import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from './GlassCard';
import { theme } from '@/constants/theme';

interface HealthMetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: keyof typeof Ionicons.glyphMap;
  status?: 'healthy' | 'warning' | 'danger';
  subtitle?: string;
}

export const HealthMetricCard = React.memo(function HealthMetricCardInner(
  { title, value, unit, icon, status = 'healthy', subtitle }: HealthMetricCardProps
) {
    const statusColor =
      status === 'danger'
        ? theme.colors.danger
        : status === 'warning'
          ? theme.colors.warning
          : theme.colors.success;

    return (
      <GlassCard style={styles.card}>
        {/* Icon circle */}
        <View style={[styles.iconCircle, { backgroundColor: `${statusColor}18` }]}>
          <Ionicons name={icon} size={26} color={statusColor} />
        </View>

        {/* Value row */}
        <View style={styles.valueRow}>
          <Text style={styles.value}>{value}</Text>
          {unit ? <Text style={styles.unit}>{unit}</Text> : null}
        </View>

        {/* Title + status dot */}
        <View style={styles.labelRow}>
          <View style={[styles.dot, { backgroundColor: statusColor }]} />
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>

        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </GlassCard>
    );
  }
);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  unit: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    flex: 1,
  },
  subtitle: {
    fontSize: 11,
    color: theme.colors.textLight,
    marginTop: 1,
  },
});
