import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { HumanBodyAvatar } from './HumanBodyAvatar';
import { OrganStatusCard } from './OrganStatusCard';
import { HEALTH_STATUS_COLORS } from '@/constants/health';
import { useHealth } from '@/context/HealthContext';
import { colors, radius, shadows, spacing } from '@/theme';

type Props = {
  onPress?: () => void;
};

export function DigitalTwinCard({ onPress }: Props) {
  const { data, loading } = useHealth();
  const { width } = useWindowDimensions();
  const [selectedOrgan, setSelectedOrgan] = useState<string | null>(null);
  const [avatarWidth, setAvatarWidth] = useState(0);

  const isWide = width >= 760;
  const isCompact = width < 640;

  const organs = useMemo(() => data?.metrics.organs ?? {}, [data]);
  const organList = useMemo(() => Object.values(organs), [organs]);
  const averageScore = useMemo(() => {
    if (!organList.length) return 0;
    return Math.round(organList.reduce((sum, organ) => sum + organ.percentage, 0) / organList.length);
  }, [organList]);

  const riskColor =
    data?.metrics.riskCategory === 'medium'
      ? HEALTH_STATUS_COLORS.moderate
      : data?.metrics.riskCategory === 'high'
      ? HEALTH_STATUS_COLORS.warning
      : data?.metrics.riskCategory === 'critical'
      ? HEALTH_STATUS_COLORS.critical
      : HEALTH_STATUS_COLORS.healthy;

  if (loading || !data) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading digital twin...</Text>
      </View>
    );
  }

  return (
    <Pressable style={styles.container} onPress={onPress}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Digital twin</Text>
          <Text style={styles.subtitle}>Avatar preview with organ status overview</Text>
        </View>

        <View style={[styles.scoreBadge, { borderColor: riskColor, backgroundColor: `${riskColor}1F` }]}>
          <Text style={[styles.scoreValue, { color: riskColor }]}>{averageScore}</Text>
          <Text style={styles.scoreLabel}>avg</Text>
        </View>
      </View>

      <View style={[styles.bodyRow, isWide ? styles.bodyRowWide : styles.bodyRowStacked]}>
        <View
          style={styles.avatarPane}
          onLayout={(e) => setAvatarWidth(e.nativeEvent.layout.width)}
        >
          <HumanBodyAvatar
            organs={organs}
            scale={isWide ? 0.52 : isCompact ? 0.34 : 0.42}
            maxWidth={avatarWidth || undefined}
            selectedOrgan={selectedOrgan}
            onOrganPress={setSelectedOrgan}
            interactive
          />
        </View>

        <View style={styles.organRail}>
          <Text style={styles.railTitle}>Organ status</Text>
          <ScrollView
            horizontal={!isCompact}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.railContent, isCompact && styles.railContentStacked]}
          >
            {organList.map((organ) => (
              <View key={organ.name} style={[styles.organTileWrap, isCompact && styles.organTileWrapStacked]}>
                <OrganStatusCard
                  organ={organ}
                  isSelected={selectedOrgan === organ.name.toLowerCase()}
                  onPress={(next) => setSelectedOrgan(next.name.toLowerCase())}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      </View>

      <View style={[styles.footerRow, isCompact && styles.footerRowStacked]}>
        <View>
          <Text style={styles.footerLabel}>Heart rate</Text>
          <Text style={styles.footerValue}>{data.metrics.vitals.heartRate} bpm</Text>
        </View>
        <View>
          <Text style={styles.footerLabel}>Oxygen</Text>
          <Text style={styles.footerValue}>{data.metrics.vitals.oxygenLevel}%</Text>
        </View>
        <View>
          <Text style={styles.footerLabel}>BP</Text>
          <Text style={styles.footerValue}>{data.metrics.vitals.bloodPressure}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  scoreBadge: {
    minWidth: 70,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  scoreLabel: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bodyRow: {
    marginTop: spacing.lg,
  },
  bodyRowStacked: {
    gap: spacing.md,
  },
  bodyRowWide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  avatarPane: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  organRail: {
    flex: 1,
    minWidth: 0,
  },
  railTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  railContent: {
    paddingRight: spacing.md,
    gap: spacing.sm,
  },
  organTileWrap: {
    width: 150,
  },
  railContentStacked: {
    flexDirection: 'column',
    paddingRight: 0,
  },
  organTileWrapStacked: {
    width: '100%',
  },
  footerRow: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  footerRowStacked: {
    flexWrap: 'wrap',
  },
  footerLabel: {
    color: colors.muted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  footerValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  loadingText: {
    textAlign: 'center',
    color: colors.muted,
    paddingVertical: spacing.xl,
  },
});
