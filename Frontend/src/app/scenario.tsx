import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { GlassCard } from '@/components/glass/GlassCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Slider } from '@/components/Slider';
import { useScenario } from '@/context/ScenarioContext';
import { useEntranceAnimation } from '@/hooks/useEntranceAnimation';
import { theme } from '@/constants/theme';
import type { PatientInput } from '@/types/api';

export default function ScenarioScreen() {
  const router = useRouter();
  const {
    baselineInput,
    baselinePrediction,
    baselineData,
    scenarioInput,
    scenarioPrediction,
    scenarioDiseasePredictions,
    loading,
    runScenarioDebounced,
    resetScenario,
    runScenario,
  } = useScenario();

  const heroStyle = useEntranceAnimation(0);
  const contentStyle = useEntranceAnimation(120);

  const hasBaseline = Boolean(baselineInput && baselinePrediction && baselineData);
  const currentInput = scenarioInput ?? baselineInput;

  const updateNumber = useCallback(
    (key: keyof PatientInput, value: number) => {
      if (!currentInput) return;
      runScenarioDebounced({ ...currentInput, [key]: value });
    },
    [currentInput, runScenarioDebounced]
  );

  const updateCategory = useCallback(
    (key: keyof PatientInput, value: string) => {
      if (!currentInput) return;
      runScenarioDebounced({ ...currentInput, [key]: value } as PatientInput);
    },
    [currentInput, runScenarioDebounced]
  );

  const activePrediction = scenarioPrediction ?? baselinePrediction;
  const activeDiseasePredictions =
    scenarioDiseasePredictions ?? baselineData?.diseasePredictions ?? null;

  const riskPercent = activePrediction
    ? Math.round(activePrediction.risk_probability * 100)
    : 50;

  const baselineRisk = baselinePrediction
    ? Math.round(baselinePrediction.risk_probability * 100)
    : 50;

  const delta = riskPercent - baselineRisk;

  const riskColor =
    riskPercent >= 60
      ? theme.colors.danger
      : riskPercent >= 40
        ? theme.colors.warning
        : theme.colors.success;

  const impactLabel = Math.abs(delta) < 2 ? 'Low' : Math.abs(delta) < 10 ? 'Medium' : 'High';
  const impactColor = Math.abs(delta) < 2 ? theme.colors.textLight
    : Math.abs(delta) < 10 ? theme.colors.warning
      : theme.colors.success;

  function getDiseaseColor(score: number) {
    if (score >= 0.6) return theme.colors.danger;
    if (score >= 0.4) return theme.colors.warning;
    return theme.colors.success;
  }

  if (!hasBaseline) {
    return (
      <LinearGradient colors={[theme.colors.backgroundStart, theme.colors.backgroundEnd]} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="options" size={40} color={theme.colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>What-if Scenario is Locked</Text>
            <Text style={styles.emptyText}>
              Complete the model inputs and generate a baseline prediction first.
            </Text>
            <PrimaryButton title="Open Health Form" onPress={() => router.push('/form?mode=profile')} />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[theme.colors.backgroundStart, theme.colors.backgroundEnd]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ── Header ── */}
          <Animated.View style={[styles.header, heroStyle]}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={20} color={theme.colors.primary} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
            <View style={styles.headerTitles}>
              <Text style={styles.title}>What If Scenario</Text>
              <Text style={styles.subtitle}>Simulate changes and see potential impact</Text>
            </View>
            <Pressable onPress={resetScenario} style={styles.resetBtn}>
              <Text style={styles.resetText}>Reset</Text>
            </Pressable>
          </Animated.View>

          <Animated.View style={[styles.body, contentStyle]}>
            {/* ── Parameter Sliders ── */}
            <GlassCard style={styles.sliderCard}>
              <Text style={styles.cardTitle}>Adjust Parameters</Text>
              <Slider
                label="Weight (kg)"
                value={currentInput?.bmi ? Math.round(currentInput.bmi * (1.7 * 1.7)) : 70}
                onValueChange={(v) => updateNumber('bmi', parseFloat((v / (1.7 * 1.7)).toFixed(1)))}
                min={30}
                max={150}
                step={1}
                formatValue={(v) => `${Math.round(v)}`}
              />
              <Slider
                label="Systolic BP (mmHg)"
                value={currentInput?.blood_pressure_systolic ?? 120}
                onValueChange={(v) => updateNumber('blood_pressure_systolic', v)}
                min={90}
                max={180}
                step={1}
                formatValue={(v) => `${Math.round(v)}`}
              />
              <Slider
                label="Diet Quality (0-5)"
                value={currentInput?.diet_quality ?? 3}
                onValueChange={(v) => updateNumber('diet_quality', v)}
                min={0}
                max={5}
                step={1}
                formatValue={(v) => `${Math.round(v)}`}
              />
              <Slider
                label="Cholesterol Risk"
                value={currentInput?.cholesterol_level ?? 0}
                onValueChange={(v) => updateNumber('cholesterol_level', v)}
                min={0}
                max={3}
                step={1}
                formatValue={(v) => ['Optimal', 'Mild', 'Moderate', 'High'][Math.round(v)] ?? 'Optimal'}
              />

              {/* Categorical pickers */}
              <View style={styles.divider} />
              <CategoricalPicker
                label="Smoking"
                options={['Never', 'Former', 'Current']}
                value={currentInput?.smoking_status ?? 'Never'}
                onChange={(v) => updateCategory('smoking_status', v)}
              />
              <CategoricalPicker
                label="Alcohol"
                options={['No', 'Yes']}
                value={currentInput?.alcohol_consumption === 1 ? 'Yes' : 'No'}
                onChange={(v) => updateNumber('alcohol_consumption', v === 'Yes' ? 1 : 0)}
              />
            </GlassCard>

            {/* ── Simulation Summary ── */}
            <GlassCard style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Text style={styles.cardTitle}>Simulation Summary</Text>
                {loading && <ActivityIndicator size="small" color={theme.colors.primary} />}
              </View>

              <View style={styles.summaryRow}>
                <View>
                  <Text style={styles.summaryLabel}>Improvement Potential</Text>
                  <View style={styles.riskRow}>
                    <View style={[styles.riskBar, { backgroundColor: `${riskColor}18` }]}>
                      <View style={[styles.riskFill, { width: `${riskPercent}%`, backgroundColor: riskColor }]} />
                    </View>
                    <Text style={[styles.riskPct, { color: riskColor }]}>{riskPercent}%</Text>
                  </View>
                </View>
                <View style={[styles.impactBadge, { backgroundColor: `${impactColor}18` }]}>
                  <Text style={[styles.impactText, { color: impactColor }]}>{impactLabel}</Text>
                </View>
              </View>

              {delta !== 0 && (
                <View style={styles.deltaRow}>
                  <Ionicons
                    name={delta < 0 ? 'arrow-down' : 'arrow-up'}
                    size={16}
                    color={delta < 0 ? theme.colors.success : theme.colors.danger}
                  />
                  <Text style={{ color: delta < 0 ? theme.colors.success : theme.colors.danger, fontSize: 13, fontWeight: '700' }}>
                    {Math.abs(delta)}% {delta < 0 ? 'improvement' : 'increase'} from baseline
                  </Text>
                </View>
              )}
            </GlassCard>

            {/* ── Disease Risk Cards ── */}
            {activeDiseasePredictions && (
              <GlassCard style={styles.diseaseCard}>
                <Text style={styles.cardTitle}>Top Positive Impacts</Text>
                <View style={styles.diseaseList}>
                  <DiseaseRow
                    label="Heart Health"
                    icon="heart"
                    score={activeDiseasePredictions.cardiovascular.risk_probability}
                    interpretation={activeDiseasePredictions.cardiovascular.interpretation}
                    getDiseaseColor={getDiseaseColor}
                  />
                  <DiseaseRow
                    label="Blood Pressure"
                    icon="pulse"
                    score={activePrediction?.derived_features.bp_status === 'Normal' ? 0.1 : 0.6}
                    interpretation={activePrediction?.derived_features.bp_status === 'Normal' ? 'Normal' : 'Elevated'}
                    getDiseaseColor={getDiseaseColor}
                  />
                  <DiseaseRow
                    label="Diabetes Risk"
                    icon="medical"
                    score={activeDiseasePredictions.diabetes.risk_probability}
                    interpretation={activeDiseasePredictions.diabetes.interpretation}
                    getDiseaseColor={getDiseaseColor}
                  />
                  <DiseaseRow
                    label="Liver Health"
                    icon="flask"
                    score={activeDiseasePredictions.heart_disease.risk_probability}
                    interpretation={activeDiseasePredictions.heart_disease.interpretation}
                    getDiseaseColor={getDiseaseColor}
                  />
                </View>
              </GlassCard>
            )}

            {/* ── Run Simulation Button ── */}
            <PrimaryButton
              title={loading ? 'Running Simulation...' : 'Run Simulation'}
              onPress={() => currentInput && runScenario(currentInput)}
              loading={loading}
              disabled={loading}
            />
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

/* ── Sub-components ── */

function CategoricalPicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
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

function DiseaseRow({
  label,
  icon,
  score,
  interpretation,
  getDiseaseColor,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  score: number;
  interpretation: string;
  getDiseaseColor: (s: number) => string;
}) {
  const color = getDiseaseColor(score);
  const improved = score < 0.4;
  return (
    <View style={diseaseRowStyles.row}>
      <View style={[diseaseRowStyles.icon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={diseaseRowStyles.label}>{label}</Text>
      <Text style={[diseaseRowStyles.interp, { color }]}>{interpretation}</Text>
      <Ionicons
        name={improved ? 'arrow-up' : 'remove'}
        size={14}
        color={improved ? theme.colors.success : theme.colors.textLight}
      />
    </View>
  );
}

const diseaseRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary },
  interp: { fontSize: 12, fontWeight: '600' },
});

const pickerStyles = StyleSheet.create({
  container: { gap: theme.spacing.xs },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  pillSelected: { backgroundColor: theme.colors.fill, borderColor: theme.colors.primary },
  pillText: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  pillTextSelected: { color: theme.colors.primary, fontWeight: '700' },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { color: theme.colors.primary, fontSize: 15, fontWeight: '600' },
  headerTitles: { flex: 1, gap: 2 },
  title: { fontSize: 20, fontWeight: '800', color: theme.colors.textPrimary },
  subtitle: { fontSize: 12, color: theme.colors.textSecondary },
  resetBtn: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.fill,
  },
  resetText: { color: theme.colors.primary, fontSize: 13, fontWeight: '600' },
  body: { gap: theme.spacing.md },
  sliderCard: { gap: theme.spacing.md },
  cardTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: theme.spacing.sm },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: theme.spacing.sm },
  summaryCard: { gap: theme.spacing.sm },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary, marginBottom: 6 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  riskRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flex: 1 },
  riskBar: { flex: 1, height: 8, borderRadius: 999, overflow: 'hidden' },
  riskFill: { height: '100%', borderRadius: 999 },
  riskPct: { fontSize: 18, fontWeight: '900', minWidth: 44 },
  impactBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  impactText: { fontSize: 12, fontWeight: '700' },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  diseaseCard: { gap: theme.spacing.sm },
  diseaseList: {},
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl, gap: theme.spacing.lg },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.textPrimary, textAlign: 'center' },
  emptyText: { fontSize: 15, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
