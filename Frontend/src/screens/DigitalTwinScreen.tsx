
import { useRouter } from 'expo-router';
import { useMemo, useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionItemsPanel,
  DashboardSkeleton,
  DigitalTwinOverviewCard,
  HealthNotificationPanel,
  BodyComponentCard,
  BodyComponentDetailModal,
  ModernHumanBody,
} from '@/components/digital-twin';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useHealth } from '@/context/HealthContext';
import { useEntranceAnimation } from '@/hooks/useEntranceAnimation';
import { sendDemoHealthNotification } from '@/services/notifications';
import { colors, radius, shadows, spacing } from '@/theme';
import { BODY_COMPONENTS, BodyComponent } from '@/types/body-components';

export function DigitalTwinScreen() {
  const router = useRouter();
  const { data, loading, refreshHealth } = useHealth();
  const { width } = useWindowDimensions();
  const [selectedComponent, setSelectedComponent] = useState<BodyComponent | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const isCompact = width < 640;

  const heroStyle = useEntranceAnimation(80);
  const listStyle = useEntranceAnimation(160);

  // Scroll animations
  const headerScale = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.95],
    extrapolate: 'clamp',
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.85],
    extrapolate: 'clamp',
  });

  const organs = useMemo(() => data?.metrics.organs ?? {}, [data]);
  const diseasePredictions = useMemo(
    () => data?.diseasePredictions ?? {
      cardiovascular: { disease: 'cardiovascular', risk_probability: 0.2, predicted_class: 0, interpretation: 'Low risk' },
      diabetes: { disease: 'diabetes', risk_probability: 0.15, predicted_class: 0, interpretation: 'Low risk' },
      heart_disease: { disease: 'heart_disease', risk_probability: 0.18, predicted_class: 0, interpretation: 'Low risk' },
    },
    [data]
  );

  const notifications = useMemo(() => {
    // Use AI notifications first if available
    if (data?.notifications && data.notifications.length > 0) {
      return data.notifications;
    }

    // Fallback to demo notifications if no AI ones
    if (!data) return [];

    const items = [];
    const { metrics } = data;

    if (metrics.overallScore < 80) {
      items.push({
        id: 'overall-score',
        level: 'info' as const,
        title: 'Overall score is below the ideal range',
        message: `Your current score is ${metrics.overallScore}`,
        source: 'Derived from overallScore',
      });
    }

    if (metrics.vitals.heartRate < 60 || metrics.vitals.heartRate > 100) {
      items.push({
        id: 'heart-rate',
        level: 'warning' as const,
        title: 'Heart rate needs attention',
        message: `Heart rate is ${metrics.vitals.heartRate} bpm. Consider reviewing exercise, stress, and hydration.`,
        source: 'Derived from vitals.heartRate',
      });
    }

    if (metrics.vitals.oxygenLevel < 95) {
      items.push({
        id: 'oxygen',
        level: 'warning' as const,
        title: 'Oxygen level is low',
        message: `SpO2 is ${metrics.vitals.oxygenLevel}%`,
        source: 'Derived from vitals.oxygenLevel',
      });
    }

    if (metrics.vitals.temperature > 99.5 || metrics.vitals.temperature < 97) {
      items.push({
        id: 'temperature',
        level: 'warning' as const,
        title: 'Temperature is outside the normal band',
        message: `Current temperature is ${metrics.vitals.temperature}°F`,
        source: 'Derived from vitals.temperature',
      });
    }

    Object.entries(metrics.organs)
      .filter(([, organ]) => organ.status !== 'healthy')
      .slice(0, 3)
      .forEach(([key, organ]) => {
        items.push({
          id: `organ-${key}`,
          level: organ.status === 'critical' ? ('critical' as const) : ('warning' as const),
          title: `${organ.name} is showing ${organ.status} status`,
          message: `${organ.percentage}% health detected`,
          source: `Derived from organs.${key}`,
        });
      });

    if (items.length === 0) {
      items.push({
        id: 'all-clear',
        level: 'info' as const,
        title: 'No urgent alerts',
        message: 'All monitored parameters are within the normal range right now.',
      });
    }

    return items;
  }, [data]);

  const handleComponentPress = (component: BodyComponent) => {
    setSelectedComponent(component);
    setModalVisible(true);
  };

  if (!data) {
    return (
      <DashboardSkeleton
        state={loading ? 'slow' : 'offline'}
        message={
          loading
            ? 'Preparing the component view while your metrics load.'
            : 'The backend is unavailable, so the detailed twin is not ready yet.'
        }
        onRetry={refreshHealth}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        <View style={styles.shell}>
          <Animated.View style={[styles.header, isCompact && styles.headerCompact, heroStyle, { transform: [{ scale: headerScale }], opacity: headerOpacity }]}>
            <View style={[styles.headerLeft, isCompact && styles.headerLeftCompact]}>
              <Pressable onPress={() => router.back()} style={styles.backButton}>
                <Text style={styles.backButtonText}>← Back</Text>
              </Pressable>
              <View>
                <Text style={styles.title}>Digital Twin</Text>
                <Text style={styles.subtitle}>Your personal health avatar</Text>
              </View>
            </View>

            <View style={[styles.headerRight, isCompact && styles.headerRightCompact]}>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Live Telemetry</Text>
              </View>
            </View>
          </Animated.View>

          <View style={styles.notificationRow}>
            <HealthNotificationPanel
              notifications={notifications}
              onTriggerSystemNotification={() => void sendDemoHealthNotification(data)}
            />
          </View>

          <Animated.View style={[styles.overviewSection, listStyle]}>
            <DigitalTwinOverviewCard
              organs={organs}
              overallScore={data.metrics.overallScore}
            />
          </Animated.View>

          {/* Whole Body Section */}
          <Animated.View style={[styles.wholeBodySection, listStyle]}>
            <ModernHumanBody organs={organs} />
          </Animated.View>

          {/* Components Section */}
          <Animated.View style={[styles.componentList, listStyle]}>
            {Object.values(BODY_COMPONENTS).map((component) => (
              <BodyComponentCard
                key={component.id}
                component={component}
                predictions={diseasePredictions}
                onPress={() => handleComponentPress(component)}
              />
            ))}
          </Animated.View>

          <Animated.View style={[styles.actionSection, listStyle]}>
            <ActionItemsPanel
              recommendations={data.recommendations}
              organs={organs}
              onSelectOrgan={() => {}}
            />
          </Animated.View>

          <View style={styles.footerActions}>
            <PrimaryButton title="Refresh Health Data" onPress={refreshHealth} variant="secondary" />
          </View>
        </View>
      </Animated.ScrollView>

      <BodyComponentDetailModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        component={selectedComponent}
        predictions={diseasePredictions}
      />
    </SafeAreaView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  headerLeftCompact: {
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  backButton: {
    padding: spacing.sm,
  },
  backButtonText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerRightCompact: {
    alignItems: 'flex-start',
  },
  headerCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: spacing.md,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  liveText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  notificationRow: {
    marginBottom: spacing.sm,
  },
  overviewSection: {
    width: '100%',
  },
  wholeBodySection: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  componentList: {
    gap: spacing.md,
  },
  actionSection: {
    width: '100%',
  },
  footerActions: {
    marginTop: spacing.sm,
  },
});

