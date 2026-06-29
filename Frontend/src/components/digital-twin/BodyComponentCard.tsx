
import { memo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import {
  BodyComponent,
  BodyComponentId,
  getComponentRisk,
  getStatusColor,
} from '@/types/body-components';
import { AllDiseasePredictionsResponse } from '@/types/api';
import { colors, radius, shadows, spacing } from '@/theme';
import {
  HeartIcon,
  BloodVesselsIcon,
  PancreasLiverIcon,
  KidneysIcon,
  LungsIcon,
  BrainIcon,
} from './BodyPartIcons';

type BodyComponentCardProps = {
  component: BodyComponent;
  predictions: AllDiseasePredictionsResponse;
  onPress: () => void;
};

const IconComponentMap: Record<BodyComponentId, typeof HeartIcon> = {
  heart: HeartIcon,
  'blood-vessels': BloodVesselsIcon,
  'pancreas-liver': PancreasLiverIcon,
  kidneys: KidneysIcon,
  lungs: LungsIcon,
  brain: BrainIcon,
};

function BodyComponentCardBase({
  component,
  predictions,
  onPress,
}: BodyComponentCardProps) {
  const { risk, status } = getComponentRisk(component, predictions);
  const statusColor = getStatusColor(status);
  const IconComponent = IconComponentMap[component.id];

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardContent}>
        <View style={styles.leftSection}>
          <IconComponent size={32} color={component.defaultColor} />
          <View style={styles.textContainer}>
            <Text style={styles.name}>{component.name}</Text>
            <Text style={styles.description}>{component.description}</Text>
          </View>
        </View>
        <View style={styles.rightSection}>
          <View style={[styles.riskBadge, { backgroundColor: `${statusColor}15` }]}>
            <Text style={[styles.riskText, { color: statusColor }]}>
              {Math.round(risk)}%
            </Text>
          </View>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        </View>
      </View>
    </Pressable>
  );
}

export const BodyComponentCard = memo(BodyComponentCardBase);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  textContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  description: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  riskBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
  },
  riskText: {
    fontSize: 14,
    fontWeight: '800',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
