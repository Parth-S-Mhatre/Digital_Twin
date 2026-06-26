import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HumanBodyAvatar } from '@/components/digital-twin/HumanBodyAvatar';
import { PredictionInspectionCard } from '@/components/digital-twin';
import { MedicalBackdrop } from '@/components/MedicalBackdrop';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Slider } from '@/components/Slider';
import { useScenario } from '@/context/ScenarioContext';
import { useEntranceAnimation } from '@/hooks/useEntranceAnimation';
import { colors, radius, shadows, spacing } from '@/theme';
import type { PatientInput } from '@/types/api';

/**
 * What-if scenario screen. Pushed from the dashboard's "What-if scenario" button.
 * Users slide model inputs and watch the avatar update in real time.
 *
 * Route: /scenario (file-based, auto-registered by expo-router Stack).
 */
export default function ScenarioScreen() {
  const router = useRouter();
  const {
    baselineInput,
    baselinePrediction,
    baselineData,
    scenarioInput,
    scenarioPrediction,
    scenarioOrgans,
    loading,
    runScenarioDebounced,
    resetScenario,
  } = useScenario();
  const { width } = useWindowDimensions();
  const isWide = width >= 960;
  const isCompact = width < 500;

  const heroStyle = useEntranceAnimation(0);
  const avatarStyle = useEntranceAnimation(120);

  const hasBaseline = Boolean(baselineInput && baselinePrediction && baselineData);
  const currentInput = scenarioInput ?? baselineInput;

  /** Update a single numeric field on the scenario input. */
  const updateNumber = useCallback(
    (key: keyof PatientInput, value: number) => {
      if (!currentInput) return;
      runScenarioDebounced({ ...currentInput, [key]: value });
    },
    [currentInput, runScenarioDebounced]
  );

  /** Update a single categorical field on the scenario input. */
  const updateCategory = useCallback(
    (key: keyof PatientInput, value: string) => {
      if (!currentInput) return;
      runScenarioDebounced({ ...currentInput, [key]: value } as PatientInput);
    },
    [currentInput, runScenarioDebounced]
  );

  const activePrediction = scenarioPrediction ?? baselinePrediction;
  const activeData = scenarioPrediction
    ? scenarioOrgans
    : baselineData?.metrics.organs ?? null;
  const riskPercent = activePrediction
    ? Math.round(activePrediction.risk_probability * 100)
    : 50;
  const riskColor =
    riskPercent >= 60
      ? colors.danger
      : riskPercent >= 40
        ? colors.warning
        : colors.success;

  if (!hasBaseline) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <MedicalBackdrop />
        <View style={styles.emptyStateShell}>
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateTitle}>What-if scenario is locked</Text>
            <Text style={styles.emptyStateText}>
              Complete the model inputs and generate a baseline prediction first. The scenario
              screen only works from a real patient profile, not demo values.
            </Text>
            <PrimaryButton title="Open form" onPress={() => router.push('/form?mode=profile')} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <MedicalBackdrop />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, isCompact && styles.scrollContentCompact]}
      >
        <View style={styles.shell}>
          {/* Header */}
          <Animated.View style={[styles.header, heroStyle]}>
            <Pressable hitSlop={12} onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backText}>← Back</Text>
            </Pressable>
            <Text style={styles.title}>What-if scenario</Text>
            <Text style={styles.subtitle}>Adjust inputs to see how your digital twin responds.</Text>
          </Animated.View>

          {/* Main content: avatar + sliders side by side on wide, stacked on compact */}
          <View style={[styles.grid, isWide && styles.gridWide]}>
            {/* Avatar column */}
            <Animated.View style={[styles.avatarColumn, avatarStyle]}>
              <View style={styles.avatarCard}>
                <HumanBodyAvatar
                  organs={activeData ?? {}}
                  maxWidth={isWide ? width * 0.45 : width - spacing.lg * 2 - 32}
                  interactive={false}
                  showLabels={!isCompact}
                />
              </View>

              {/* Risk summary card */}
              <View style={styles.riskCard}>
                <View style={styles.riskRow}>
                  <Text style={styles.riskLabel}>Risk level</Text>
                  <Text style={[styles.riskValue, { color: riskColor }]}>{riskPercent}%</Text>
                </View>
                <View style={[styles.riskBar, { backgroundColor: `${riskColor}18` }]}>
                  <View
                    style={[styles.riskBarFill, { width: `${riskPercent}%`, backgroundColor: riskColor }]}
                  />
                </View>
                {activePrediction && (
                  <Text style={styles.riskInterpretation}>
                    {activePrediction.interpretation} · Confidence {Math.round(activePrediction.confidence * 100)}%
                  </Text>
                )}
                {loading && (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.loadingText}>Updating prediction…</Text>
                  </View>
                )}
              </View>

              <PredictionInspectionCard title="Inspect branches" prediction={activePrediction} />
            </Animated.View>

            {/* Sliders column */}
            <View style={styles.sliderColumn}>
              <Text style={styles.sectionTitle}>Model parameters</Text>

              <Slider
                label="Age"
                value={currentInput?.age ?? 0}
                onValueChange={(v) => updateNumber('age', v)}
                min={0}
                max={120}
                step={1}
                formatValue={(v) => `${Math.round(v)} yr`}
              />
              <Slider
                label="BMI"
                value={currentInput?.bmi ?? 0}
                onValueChange={(v) => updateNumber('bmi', v)}
                min={10}
                max={60}
                step={0.1}
                formatValue={(v) => v.toFixed(1)}
              />
              <Slider
                label="Systolic BP"
                value={currentInput?.blood_pressure_systolic ?? 0}
                onValueChange={(v) => updateNumber('blood_pressure_systolic', v)}
                min={50}
                max={260}
                step={1}
                formatValue={(v) => `${Math.round(v)} mmHg`}
              />
              <Slider
                label="Diastolic BP"
                value={currentInput?.blood_pressure_diastolic ?? 0}
                onValueChange={(v) => updateNumber('blood_pressure_diastolic', v)}
                min={30}
                max={180}
                step={1}
                formatValue={(v) => `${Math.round(v)} mmHg`}
              />
              <Slider
                label="Diet quality"
                value={currentInput?.diet_quality ?? 0}
                onValueChange={(v) => updateNumber('diet_quality', v)}
                min={0}
                max={5}
                step={1}
                formatValue={(v) => `${Math.round(v)} / 5`}
              />
              <Slider
                label="Cholesterol risk"
                value={currentInput?.cholesterol_level ?? 0}
                onValueChange={(v) => updateNumber('cholesterol_level', v)}
                min={0}
                max={3}
                step={1}
                formatValue={(v) => ['Optimal', 'Mild', 'Moderate', 'High'][Math.round(v)]}
              />
              <Slider
                label="Glucose risk"
                value={currentInput?.glucose_level ?? 0}
                onValueChange={(v) => updateNumber('glucose_level', v)}
                min={0}
                max={3}
                step={1}
                formatValue={(v) => ['Optimal', 'Mild', 'Moderate', 'High'][Math.round(v)]}
              />

              {/* Categorical pickers */}
              <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>Categories</Text>

              <CategoricalPicker
                label="Sex"
                options={['Female', 'Male']}
                value={currentInput?.sex ?? ''}
                onChange={(v) => updateCategory('sex', v)}
              />
              <CategoricalPicker
                label="Smoking"
                options={['Never', 'Former', 'Current', 'Unknown']}
                value={currentInput?.smoking_status ?? ''}
                onChange={(v) => updateCategory('smoking_status', v)}
              />
              <CategoricalPicker
                label="Physical activity"
                options={['No', 'Yes']}
                value={currentInput?.physical_activity === 1 ? 'Yes' : currentInput ? 'No' : ''}
                onChange={(v) => updateNumber('physical_activity', v === 'Yes' ? 1 : 0)}
              />
              <CategoricalPicker
                label="Alcohol"
                options={['No', 'Yes']}
                value={currentInput?.alcohol_consumption === 1 ? 'Yes' : currentInput ? 'No' : ''}
                onChange={(v) => updateNumber('alcohol_consumption', v === 'Yes' ? 1 : 0)}
              />
              <CategoricalPicker
                label="Diabetes"
                options={['No', 'Yes']}
                value={currentInput?.medical_history_diabetes === 1 ? 'Yes' : currentInput ? 'No' : ''}
                onChange={(v) => updateNumber('medical_history_diabetes', v === 'Yes' ? 1 : 0)}
              />
              <CategoricalPicker
                label="Hypertension"
                options={['No', 'Yes']}
                value={currentInput?.medical_history_hypertension === 1 ? 'Yes' : currentInput ? 'No' : ''}
                onChange={(v) => updateNumber('medical_history_hypertension', v === 'Yes' ? 1 : 0)}
              />
              <CategoricalPicker
                label="Heart disease"
                options={['No', 'Yes']}
                value={currentInput?.medical_history_heart_disease === 1 ? 'Yes' : currentInput ? 'No' : ''}
                onChange={(v) => updateNumber('medical_history_heart_disease', v === 'Yes' ? 1 : 0)}
              />

              {/* Reset button */}
              <View style={styles.resetRow}>
                <PrimaryButton
                  title="Reset to baseline"
                  onPress={resetScenario}
                  variant="secondary"
                />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- Small pill-picker for categorical fields ---------- */

function CategoricalPicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={pickerStyles.container}>
      <Text style={pickerStyles.label}>{label}</Text>
      <View style={pickerStyles.row}>
        {options.map((opt) => {
          const selected = opt === value;
          return (
            <Pressable
              key={opt}
              onPress={() => onChange(opt)}
              style={[pickerStyles.pill, selected && pickerStyles.pillSelected]}
            >
              <Text style={[pickerStyles.pillText, selected && pickerStyles.pillTextSelected]}>
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  scrollContentCompact: {
    padding: spacing.md,
  },
  shell: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: spacing.xs,
  },
  backText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  grid: {
    gap: spacing.lg,
  },
  gridWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarColumn: {
    gap: spacing.md,
  },
  avatarCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.card,
  },
  riskCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  riskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  riskLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  riskValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  riskBar: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  riskBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  riskInterpretation: {
    color: colors.muted,
    fontSize: 13,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 13,
  },
  sliderColumn: {
    flex: 1,
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  resetRow: {
    marginTop: spacing.sm,
  },
  emptyStateShell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  emptyStateCard: {
    width: '100%',
    maxWidth: 420,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    ...shadows.card,
  },
  emptyStateTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  emptyStateText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});

const pickerStyles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  pillSelected: {
    backgroundColor: '#EAF3FF',
    borderColor: colors.primary,
  },
  pillText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  pillTextSelected: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
});
