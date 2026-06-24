import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { HumanBodyAvatar, type HealthStatus } from './HumanBodyAvatar';
import type { OrganHealth } from '@/constants/health';
import { HEALTH_STATUS_COLORS } from '@/constants/health';
import { colors, radius, shadows, spacing } from '@/theme';

type Props = {
  organs: Record<string, OrganHealth>;
  scale?: number;
  interactive?: boolean;
  selectedOrganId?: string | null;
  onSelectOrgan?: (organId: string | null) => void;
};

const LEGEND: { label: string; status: HealthStatus }[] = [
  { label: 'Healthy', status: 'healthy' },
  { label: 'Moderate', status: 'moderate' },
  { label: 'Warning', status: 'warning' },
  { label: 'Critical', status: 'critical' },
];

export function DigitalTwinBody3D({
  organs,
  scale = 1,
  interactive = true,
  selectedOrganId: controlledSelected,
  onSelectOrgan,
}: Props) {
  const { width } = useWindowDimensions();
  const [internalSelected, setInternalSelected] = useState<string | null>(null);
  const [avatarWidth, setAvatarWidth] = useState(0);

  const selectedOrganId = controlledSelected !== undefined ? controlledSelected : internalSelected;
  const setSelectedOrgan = onSelectOrgan ?? setInternalSelected;

  const panelCompact = width < 720;

  const selected = useMemo(() => {
    if (!selectedOrganId) return null;
    return organs[selectedOrganId] ?? null;
  }, [organs, selectedOrganId]);

  const handleOrganPress = (organId: string) => {
    const next = selectedOrganId === organId ? null : organId;
    setSelectedOrgan(next);
  };

  return (
    <View style={[styles.container, panelCompact && styles.containerCompact]}>
      <View
        style={styles.avatarWrap}
        onLayout={(e) => setAvatarWidth(e.nativeEvent.layout.width)}
      >
        <HumanBodyAvatar
          organs={organs}
          scale={scale}
          maxWidth={avatarWidth || undefined}
          selectedOrgan={selectedOrganId}
          interactive={interactive}
          onOrganPress={interactive ? handleOrganPress : undefined}
        />
      </View>

      <View style={styles.legendRow}>
        {LEGEND.map((item) => (
          <View key={item.status} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: HEALTH_STATUS_COLORS[item.status] }]} />
            <Text style={styles.legendText}>{item.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.hintBar}>
        <Text style={styles.hintText}>
          {selected
            ? `${selected.name}: ${selected.status} · ${selected.percentage}%`
            : 'Tap organs on the avatar to inspect diagnostics'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    minHeight: 480,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  containerCompact: {
    alignItems: 'stretch',
    minHeight: 380,
  },
  avatarWrap: {
    position: 'relative',
    paddingVertical: spacing.xs,
    zIndex: 2,
    alignSelf: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    zIndex: 2,
    paddingHorizontal: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  hintBar: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 2,
  },
  hintText: {
    color: colors.muted,
    fontSize: 12,
    textAlign: 'center',
  },
});
