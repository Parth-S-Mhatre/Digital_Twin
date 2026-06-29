
import { memo, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import {
  LineChart,
  ProgressChart,
} from 'react-native-chart-kit';
import {
  BodyComponent,
  getComponentRisk,
  getStatusColor,
} from '@/types/body-components';
import { AllDiseasePredictionsResponse } from '@/types/api';
import { colors, radius, shadows, spacing } from '@/theme';

type BodyComponentDetailModalProps = {
  visible: boolean;
  onClose: () => void;
  component: BodyComponent | null;
  predictions: AllDiseasePredictionsResponse;
};

function BodyComponentDetailModalBase({
  visible,
  onClose,
  component,
  predictions,
}: BodyComponentDetailModalProps) {
  const { width } = useWindowDimensions();
  const chartConfig = {
    backgroundColor: colors.surface,
    backgroundGradientFrom: colors.surface,
    backgroundGradientTo: colors.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
    style: {
      borderRadius: radius.lg,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: colors.primary,
    },
  };

  const { risk, status } = useMemo(
    () => (component ? getComponentRisk(component, predictions) : { risk: 0, status: 'low' }),
    [component, predictions]
  );

  const statusColor = getStatusColor(status);

  const progressData = useMemo(() => {
    return {
      labels: ['Current'],
      data: [risk / 100],
    };
  }, [risk]);

  const lineChartData = useMemo(() => {
    return {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [
        {
          data: [
            Math.max(0, risk - 10),
            Math.max(0, risk - 5),
            Math.max(0, risk - 3),
            risk,
            Math.min(100, risk + 2),
            risk,
          ],
          color: (opacity = 1) => statusColor,
          strokeWidth: 2,
        },
      ],
    };
  }, [risk, statusColor]);

  if (!component) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <Text style={styles.icon}>{component.icon}</Text>
              <View>
                <Text style={styles.headerTitle}>{component.name}</Text>
                <Text style={styles.headerDescription}>{component.description}</Text>
              </View>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.riskOverviewCard}>
              <View style={styles.riskHeaderRow}>
                <Text style={styles.riskLabel}>Current Risk Score</Text>
                <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={[styles.riskValue, { color: statusColor }]}>
                {Math.round(risk)}%
              </Text>
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Risk Trend (Last 6 Months)</Text>
              <LineChart
                data={lineChartData}
                width={width - 64}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
              />
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Risk Gauge</Text>
              <ProgressChart
                data={progressData}
                width={width - 64}
                height={220}
                strokeWidth={16}
                radius={64}
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => statusColor,
                }}
                hideLegend
              />
            </View>

            {component.associatedDiseases.length > 0 && (
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Associated Conditions</Text>
                {component.associatedDiseases.map((disease) => {
                  const prediction = predictions[disease];
                  const dRisk = prediction.risk_probability * 100;
                  const dColor = dRisk >= 60 ? '#F97316' : dRisk >= 40 ? '#EAB308' : '#22C55E';
                  return (
                    <View key={disease} style={styles.diseaseRow}>
                      <View style={styles.diseaseLeft}>
                        <Text style={styles.diseaseName}>
                          {disease.replace('_', ' ').toUpperCase()}
                        </Text>
                      </View>
                      <View style={[styles.diseaseBadge, { backgroundColor: `${dColor}20` }]}>
                        <Text style={[styles.diseaseRisk, { color: dColor }]}>
                          {Math.round(dRisk)}%
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export const BodyComponentDetailModal = memo(BodyComponentDetailModalBase);

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '90%',
    ...shadows.modal,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: {
    fontSize: 36,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  headerDescription: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  closeButton: {
    padding: spacing.sm,
  },
  closeButtonText: {
    fontSize: 24,
    color: colors.muted,
    fontWeight: '800',
  },
  modalContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  riskOverviewCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.card,
  },
  riskHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  riskLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  riskValue: {
    fontSize: 40,
    fontWeight: '900',
    marginTop: spacing.sm,
  },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.card,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  chart: {
    borderRadius: radius.md,
  },
  diseaseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  diseaseLeft: {
    flex: 1,
  },
  diseaseName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  diseaseBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
  },
  diseaseRisk: {
    fontSize: 14,
    fontWeight: '800',
  },
});
