import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
    Animated,
    Easing,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    Platform,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InputField } from '@/components/InputField';
import { MedicalBackdrop } from '@/components/MedicalBackdrop';
import { PrimaryButton } from '@/components/PrimaryButton';
import {
    ACTIVITY_OPTIONS,
    BLOOD_GROUP_OPTIONS,
    CLINICAL_RISK_OPTIONS,
    DEFAULT_PATIENT_PROFILE,
    DIET_OPTIONS,
    GENDER_OPTIONS,
    getProfileCompletion,
    PROFILE_FIELD_GROUPS,
    SMOKING_OPTIONS,
    YES_NO_OPTIONS,
    type PatientProfile,
} from '@/constants/profile';
import { useAuth } from '@/context/AuthContext';
import { useScenario } from '@/context/ScenarioContext';
import { useEntranceAnimation } from '@/hooks/useEntranceAnimation';
import { colors, radius, spacing } from '@/theme';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { LaunchScreen } from '@/components/LaunchScreen';
import { useAlert } from '@/context/AlertContext';
import { profileToPatientInput, predictionToDigitalTwinData } from '@/lib/patientMapping';
import { predictFusion, TimeoutError, NetworkError, ApiError } from '@/services/api';
import { useHealth } from '@/context/HealthContext';

type FormScreenProps = {
  mode?: 'onboarding' | 'profile';
};

export function FormScreen({ mode = 'onboarding' }: FormScreenProps) {
  const router = useRouter();
  const { user, logout, profile, saveProfile, profileInitializing } = useAuth();
  const { setBaseline } = useScenario();
  const { setHealthData } = useHealth();
  const { showAlert } = useAlert();
  const { width } = useWindowDimensions();
  const isWide = width >= 920;
  const isCompact = width < 460;
  const isTiny = width < 390;
  const heroStyle = useEntranceAnimation(80);
  const cardStyle = useEntranceAnimation(180);
  const formStyle = useEntranceAnimation(260);
  const summaryStyle = useEntranceAnimation(340);
  const useNativeDriver = Platform.OS !== 'web';
  const [form, setForm] = useState<PatientProfile>(profile ?? DEFAULT_PATIENT_PROFILE);
  const [saving, setSaving] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [restPulse] = useState(() => new Animated.Value(0));
  const [savePulse] = useState(() => new Animated.Value(0));
  const predictionInput = useMemo(() => profileToPatientInput(form), [form]);
  const canPredict = Boolean(predictionInput);

  useEffect(() => {
    if (profile) {
      // Updating form state when profile arrives. This can run synchronously
      // when profile is provided from the auth context. ESLint warns about
      // calling setState directly in effects; this update is intentional.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(profile);
      setIsDirty(false);
    }
  }, [profile]);

  useEffect(() => {
    if (!isDirty || saving) {
      restPulse.stopAnimation();
      restPulse.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(restPulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver,
        }),
        Animated.timing(restPulse, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver,
        }),
      ])
    );

    loop.start();
    return () => {
      loop.stop();
    };
  }, [isDirty, saving, restPulse]);

  useEffect(() => {
    if (!saving) {
      savePulse.stopAnimation();
      savePulse.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(savePulse, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver,
        }),
        Animated.timing(savePulse, {
          toValue: 0,
          duration: 650,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [saving, savePulse]);

  const completion = getProfileCompletion(form);

  const allKeys = Object.keys(form) as (keyof PatientProfile)[];
  const totalFields = allKeys.length;
  const filledFields = allKeys.filter((key) => form[key].trim().length > 0).length;

  const sectionProgress = (keys: readonly (keyof PatientProfile)[]) =>
    Math.round((keys.filter((key) => form[key].trim().length > 0).length / keys.length) * 100);

  const update = (key: keyof PatientProfile, value: string) =>
    setForm((current) => {
      if (!isDirty) {
        setIsDirty(true);
      }
      return { ...current, [key]: value };
    });

  const persistProfile = async (goToDashboard = false) => {
    setSaving(true);
    try {
      await saveProfile(form);
      setIsDirty(false);
      if (goToDashboard) {
        // Run prediction against backend, then navigate with results.
        await runPredictionAndNavigate();
      }
    } catch (err) {
      showAlert({
        level: 'warning',
        title: 'Profile save failed',
        message: err instanceof Error ? err.message : 'Could not save your profile.',
      });
    } finally {
      setSaving(false);
    }
  };

  /**
   * Convert the form to model input, call the backend, push results into
   * HealthContext so the dashboard renders them, then navigate.
   * If the model inputs are incomplete, we stop before calling the backend.
   */
  const runPredictionAndNavigate = async () => {
    if (!predictionInput) {
      showAlert({
        level: 'warning',
        title: 'Prediction inputs incomplete',
        message: 'Fill the required model inputs before requesting a prediction.',
      });
      return;
    }

    setPredicting(true);
    try {
      const prediction = await predictFusion(predictionInput);
      const data = predictionToDigitalTwinData(prediction, form, user?.id ?? '');
      setHealthData(data);
      setBaseline(predictionInput, prediction, data);
    } catch (err) {
      if (err instanceof TimeoutError) {
        showAlert({
          level: 'critical',
          title: 'Request timed out',
          message: 'The prediction server took too long to respond. The dashboard will stay empty.',
        });
      } else if (err instanceof NetworkError) {
        showAlert({
          level: 'critical',
          title: 'Cannot reach server',
          message: 'The backend is not running or unreachable. No prediction was created.',
        });
      } else if (err instanceof ApiError) {
        showAlert({
          level: 'warning',
          title: `Prediction error (${err.status})`,
          message: String(err.message),
        });
      } else {
        showAlert({
          level: 'critical',
          title: 'Internal error',
          message: 'An unexpected error occurred during prediction.',
        });
      }
    } finally {
      setPredicting(false);
      router.replace('/dashboard');
    }
  };

  const saveOnly = async () => {
    await persistProfile(false);
  };

  if (profileInitializing && mode === 'profile') {
    return <LaunchScreen />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LoadingOverlay visible={predicting} />
      <MedicalBackdrop />
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={[
          styles.scrollContent,
          isTiny && styles.scrollContentTiny,
        ]}
      >
        <View style={styles.shell}>
          <Animated.View style={[styles.hero, heroStyle]}>
            <View style={[styles.heroTopRow, isCompact && styles.heroTopRowCompact]}>
              <View style={styles.badge}>
                <View style={styles.badgeDot} />
                <Text style={styles.badgeText}>Step 1 of 2</Text>
              </View>

              <Pressable onPress={logout} style={styles.signOutButton}>
                <Text style={styles.signOutText}>Sign out</Text>
              </Pressable>
            </View>

            <Text style={[styles.title, isCompact && styles.titleCompact]}>Health intake form</Text>
            <Text style={[styles.subtitle, isCompact && styles.subtitleCompact]}>
              {user?.name ? `Welcome ${user.name}. ` : ''}
              {mode === 'profile'
                ? 'Keep your profile updated so the dashboard stays accurate.'
                : 'Fill the model inputs before prediction. The dashboard stays empty until the trained feature set is complete.'}
            </Text>

            <View style={[styles.progressBlock, isCompact && styles.progressBlockCompact]}>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>Form completion</Text>
                <Text style={styles.progressValue}>{completion}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${completion}%` }]} />
              </View>
              <Text style={styles.progressHint}>
                Each section shows its own completion bar so the intake flow feels guided, not
                overwhelming.
              </Text>
            </View>

            <Animated.View
              style={[
                styles.restingCard,
                saving && styles.restingCardSaving,
                {
                  opacity: restPulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.72, 1],
                  }),
                  transform: [
                    {
                      translateY: restPulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -4],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.restingDot} />
              <View style={styles.restingCopy}>
                <Text style={styles.restingTitle}>
                  {saving ? 'Saving profile' : isDirty ? 'Resting while you edit' : 'Ready state'}
                </Text>
                <Text style={styles.restingText}>
                  {saving
                    ? 'Updating your profile and syncing the latest data.'
                    : isDirty
                      ? 'A gentle idle animation keeps the intake flow calm while you continue typing.'
                      : 'Your profile is resting until the next edit.'}
                </Text>
              </View>
            </Animated.View>
          </Animated.View>

          <Animated.View style={[styles.bannerCard, cardStyle]}>
              <Text style={styles.bannerTitle}>Prediction inputs</Text>
            <Text style={styles.bannerText}>
              The model only predicts when the required inputs are present. No fallback values are
              inserted, so the result stays tied to the actual patient data.
            </Text>
          </Animated.View>

          <View style={[styles.contentGrid, isWide && styles.contentGridWide]}>
            <Animated.View style={[styles.formColumn, formStyle]}>
              {PROFILE_FIELD_GROUPS.map((group) => (
                <SectionCard
                  key={group.title}
                  title={group.title}
                  description={group.description}
                  progress={sectionProgress(group.keys)}
                >
                  {group.title === 'Core profile' && (
                    <>
                      <InputField
                        label="Full name"
                        value={form.fullName}
                        onChangeText={(value) => update('fullName', value)}
                        placeholder="Enter patient name"
                      />
                      <View style={[styles.twoCol, !isCompact && isWide && styles.twoColWide]}>
                        <View style={styles.flexItem}>
                          <InputField
                            label="Age"
                            value={form.age}
                            onChangeText={(value) => update('age', value)}
                            keyboardType="number-pad"
                            placeholder="Years"
                          />
                        </View>
                        <View style={styles.flexItem}>
                        <ChoiceRow
                          label="Blood group"
                            options={BLOOD_GROUP_OPTIONS}
                            value={form.bloodGroup}
                            onChange={(value) => update('bloodGroup', value)}
                          />
                        </View>
                      </View>
                      <ChoiceRow
                        label="Gender"
                        options={GENDER_OPTIONS}
                        value={form.gender}
                        onChange={(value) => update('gender', value)}
                      />
                    </>
                  )}

                  {group.title === 'Vital signals' && (
                    <>
                      <View style={[styles.twoCol, !isCompact && isWide && styles.twoColWide]}>
                        <View style={styles.flexItem}>
                          <InputField
                            label="Height (cm)"
                            value={form.height}
                            onChangeText={(value) => update('height', value)}
                            keyboardType="decimal-pad"
                            placeholder="170"
                          />
                        </View>
                        <View style={styles.flexItem}>
                          <InputField
                            label="Weight (kg)"
                            value={form.weight}
                            onChangeText={(value) => update('weight', value)}
                            keyboardType="decimal-pad"
                            placeholder="68"
                          />
                        </View>
                      </View>
                      <View style={[styles.twoCol, !isCompact && isWide && styles.twoColWide]}>
                        <View style={styles.flexItem}>
                          <InputField
                            label="Systolic"
                            value={form.systolic}
                            onChangeText={(value) => update('systolic', value)}
                            keyboardType="number-pad"
                            placeholder="120"
                          />
                        </View>
                        <View style={styles.flexItem}>
                          <InputField
                            label="Diastolic"
                            value={form.diastolic}
                            onChangeText={(value) => update('diastolic', value)}
                            keyboardType="number-pad"
                            placeholder="80"
                          />
                        </View>
                      </View>
                      <InputField
                        label="Resting heart rate (bpm)"
                        value={form.heartRate}
                        onChangeText={(value) => update('heartRate', value)}
                        keyboardType="number-pad"
                        placeholder="72"
                      />
                    </>
                  )}

                  {group.title === 'Lifestyle pattern' && (
                    <>
                      <ChoiceRow
                        label="Activity level"
                        options={ACTIVITY_OPTIONS}
                        value={form.activityLevel}
                        onChange={(value) => update('activityLevel', value)}
                      />
                      <InputField
                        label="Sleep hours"
                        value={form.sleepHours}
                        onChangeText={(value) => update('sleepHours', value)}
                        keyboardType="decimal-pad"
                        placeholder="7.5"
                      />
                      <ChoiceRow
                        label="Diet quality"
                        options={DIET_OPTIONS}
                        value={form.dietQuality}
                        onChange={(value) => update('dietQuality', value)}
                      />
                    </>
                  )}

                  {group.title === 'History and context' && (
                    <>
                      <InputField
                        label="Existing conditions"
                        value={form.existingConditions}
                        onChangeText={(value) => update('existingConditions', value)}
                        placeholder="Diabetes, asthma, etc."
                        multiline
                        numberOfLines={3}
                        style={styles.multilineInput}
                      />
                      <InputField
                        label="Family medical history"
                        value={form.familyHistory}
                        onChangeText={(value) => update('familyHistory', value)}
                        placeholder="Cardiovascular, metabolic, hereditary notes"
                        multiline
                        numberOfLines={3}
                        style={styles.multilineInput}
                      />
                      <View style={[styles.twoCol, isCompact && styles.twoColStacked]}>
                        <View style={styles.flexItem}>
                          <InputField
                            label="Medication notes"
                            value={form.medications}
                            onChangeText={(value) => update('medications', value)}
                            placeholder="Current meds"
                          />
                        </View>
                        <View style={styles.flexItem}>
                          <InputField
                            label="Clinical notes"
                            value={form.notes}
                            onChangeText={(value) => update('notes', value)}
                            placeholder="Anything helpful"
                          />
                        </View>
                      </View>
                    </>
                  )}

                  {group.title === 'Clinical model inputs' && (
                    <>
                      <ChoiceRow
                        label="Smoking status"
                        options={[...SMOKING_OPTIONS]}
                        value={form.smokingStatus}
                        onChange={(value) => update('smokingStatus', value)}
                      />
                      <ChoiceRow
                        label="Alcohol consumption"
                        options={[...YES_NO_OPTIONS]}
                        value={form.alcoholConsumption === '1' ? 'Yes' : form.alcoholConsumption}
                        onChange={(value) => update('alcoholConsumption', value === 'Yes' ? '1' : '0')}
                      />
                      <View style={[styles.twoCol, isCompact && styles.twoColStacked]}>
                        <View style={styles.flexItem}>
                          <ChoiceRow
                            label="Diabetes"
                            options={[...YES_NO_OPTIONS]}
                            value={form.medicalHistoryDiabetes === '1' ? 'Yes' : form.medicalHistoryDiabetes}
                            onChange={(value) => update('medicalHistoryDiabetes', value === 'Yes' ? '1' : '0')}
                          />
                        </View>
                        <View style={styles.flexItem}>
                          <ChoiceRow
                            label="Hypertension"
                            options={[...YES_NO_OPTIONS]}
                            value={form.medicalHistoryHypertension === '1' ? 'Yes' : form.medicalHistoryHypertension}
                            onChange={(value) => update('medicalHistoryHypertension', value === 'Yes' ? '1' : '0')}
                          />
                        </View>
                      </View>
                      <ChoiceRow
                        label="Heart disease"
                        options={[...YES_NO_OPTIONS]}
                        value={form.medicalHistoryHeartDisease === '1' ? 'Yes' : form.medicalHistoryHeartDisease}
                        onChange={(value) => update('medicalHistoryHeartDisease', value === 'Yes' ? '1' : '0')}
                      />
                      <View style={[styles.twoCol, isCompact && styles.twoColStacked]}>
                        <View style={styles.flexItem}>
                          <ChoiceRow
                            label="Cholesterol risk"
                            options={[...CLINICAL_RISK_OPTIONS]}
                            value={mapClinicalRiskToLabel(form.cholesterolLevel)}
                            onChange={(value) => update('cholesterolLevel', mapLabelToClinicalRisk(value))}
                          />
                        </View>
                        <View style={styles.flexItem}>
                          <ChoiceRow
                            label="Glucose risk"
                            options={[...CLINICAL_RISK_OPTIONS]}
                            value={mapClinicalRiskToLabel(form.glucoseLevel)}
                            onChange={(value) => update('glucoseLevel', mapLabelToClinicalRisk(value))}
                          />
                        </View>
                      </View>
                    </>
                  )}
                </SectionCard>
              ))}

              <Animated.View style={[styles.actionCard, summaryStyle]}>
                <View style={styles.actionHeader}>
                  <Text style={styles.actionTitle}>Ready for dashboard</Text>
                  <Text style={styles.actionScore}>{completion}%</Text>
                </View>
                <Text style={styles.actionText}>
                  Once the model inputs are complete, the dashboard tab can begin prediction,
                  explanation, and simulation workflows.
                </Text>
                <Animated.View
                  style={[
                    styles.actionStatusGlow,
                    {
                      pointerEvents: 'none',
                      opacity: savePulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.06, 0.18],
                      }),
                      transform: [
                        {
                          scale: savePulse.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.98, 1.03],
                          }),
                        },
                      ],
                    },
                  ]}
                />

                <View style={[styles.actionButtons, isCompact && styles.actionButtonsStacked]}>
                  <View style={styles.actionButton}>
                    <PrimaryButton
                      title={mode === 'profile' ? 'Save profile' : 'Save'}
                      onPress={saveOnly}
                      loading={saving}
                      disabled={saving}
                      variant={mode === 'profile' ? 'primary' : 'secondary'}
                    />
                  </View>

                  <View style={styles.actionButton}>
                    <PrimaryButton
                      title="Go to dashboard"
                      onPress={async () => {
                        await persistProfile(true);
                      }}
                      loading={saving}
                      disabled={saving || !canPredict}
                      variant={canPredict || mode === 'profile' ? 'primary' : 'secondary'}
                    />
                  </View>
                </View>

                <Text style={styles.actionHint}>
                  {saving
                    ? 'Saving your profile now. Please wait a moment.'
                    : mode === 'profile'
                      ? 'Saving updates the shared profile used by the dashboard. The dashboard still waits for the required model inputs.'
                      : canPredict
                        ? 'All model inputs are complete. You can move into the dashboard.'
                        : 'Complete the required model inputs to unlock the dashboard view.'}
                </Text>
              </Animated.View>
            </Animated.View>

            <Animated.View style={[styles.summaryColumn, summaryStyle]}>
              <View style={styles.stickyCard}>
                <Text style={styles.stickyTitle}>
                  {mode === 'profile' ? 'Profile snapshot' : 'Intake snapshot'}
                </Text>
                <SummaryMetric label="Completion" value={`${completion}%`} />
                <SummaryMetric label="Sections done" value={`${filledFields} / ${totalFields}`} />
                <SummaryMetric label="Current mode" value="Prediction-ready" />

                <View style={styles.snapshotList}>
                  {PROFILE_FIELD_GROUPS.map((group) => (
                    <View key={group.title} style={styles.snapshotRow}>
                      <View style={styles.snapshotCopy}>
                        <Text style={styles.snapshotTitle}>{group.title}</Text>
                        <Text style={styles.snapshotText}>{group.description}</Text>
                      </View>
                      <View style={styles.snapshotBarWrap}>
                        <View
                          style={[
                            styles.snapshotBarFill,
                            { width: `${sectionProgress(group.keys)}%` },
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </Animated.View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionCard({
  title,
  description,
  progress,
  children,
}: {
  title: string;
  description: string;
  progress: number;
  children: ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeadingCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionDescription}>{description}</Text>
        </View>
        <Text style={styles.sectionProgressText}>{progress}%</Text>
      </View>
      <View style={styles.sectionTrack}>
        <View style={[styles.sectionFill, { width: `${progress}%` }]} />
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function ChoiceRow({
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
    <View style={styles.choiceBlock}>
      <Text style={styles.choiceLabel}>{label}</Text>
      <View style={styles.choiceWrap}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              style={({ pressed }) => [
                styles.choicePill,
                selected && styles.choicePillSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

/** Convert the stored ordinal '0'/'1'/'2'/'3' back to its display label. */
function mapClinicalRiskToLabel(value: string): string {
  const map: Record<string, string> = { '0': '0 - Optimal', '1': '1 - Mild', '2': '2 - Moderate', '3': '3 - High' };
  return map[value] ?? value;
}

/** Convert the display label back to the stored ordinal. */
function mapLabelToClinicalRisk(label: string): string {
  const map: Record<string, string> = { '0 - Optimal': '0', '1 - Mild': '1', '2 - Moderate': '2', '3 - High': '3' };
  return map[label] ?? label;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  scrollContentTiny: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  shell: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    gap: spacing.lg,
  },
  hero: {
    gap: spacing.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  heroTopRowCompact: {
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  badgeText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  signOutButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  signOutText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
  },
  titleCompact: {
    fontSize: 30,
    lineHeight: 36,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 860,
  },
  subtitleCompact: {
    fontSize: 14,
    lineHeight: 20,
  },
  progressBlock: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    boxShadow: '0px 14px 28px rgba(14, 70, 210, 0.08)',
    elevation: 2,
  },
  progressBlockCompact: {
    padding: spacing.md,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  progressValue: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: '800',
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#DCEAFB',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  progressHint: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  restingCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  restingCardSaving: {
    borderColor: colors.primary,
  },
  restingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  restingCopy: {
    flex: 1,
    gap: 4,
  },
  restingTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  restingText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  bannerCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: '#F7FBFF',
    borderWidth: 1,
    borderColor: '#D9E6F7',
    gap: 6,
  },
  bannerTitle: {
    color: colors.primaryDark,
    fontSize: 16,
    fontWeight: '800',
  },
  bannerText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 840,
  },
  contentGrid: {
    gap: spacing.lg,
  },
  contentGridWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  formColumn: {
    flex: 1,
    gap: spacing.lg,
  },
  summaryColumn: {
    gap: spacing.lg,
  },
  sectionCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    boxShadow: '0px 12px 24px rgba(14, 70, 210, 0.08)',
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionHeadingCopy: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionProgressText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: '800',
  },
  sectionTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E3EEFC',
    overflow: 'hidden',
  },
  sectionFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  sectionBody: {
    gap: spacing.md,
  },
  twoCol: {
    gap: spacing.md,
  },
  twoColStacked: {
    flexDirection: 'column',
  },
  flexItem: {
    flex: 1,
  },
  multilineInput: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  choiceBlock: {
    gap: spacing.xs,
  },
  choiceLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  choiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choicePill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  choicePillSelected: {
    backgroundColor: '#EAF3FF',
    borderColor: colors.primary,
  },
  choiceText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  choiceTextSelected: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  actionCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    boxShadow: '0px 12px 24px rgba(14, 70, 210, 0.08)',
    elevation: 2,
  },
  actionStatusGlow: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(14, 70, 210, 0.12)',
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  actionScore: {
    color: colors.primaryDark,
    fontSize: 18,
    fontWeight: '900',
  },
  actionText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  actionHint: {
    color: colors.muted,
    fontSize: 13,
  },
  stickyCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    boxShadow: '0px 16px 32px rgba(14, 70, 210, 0.08)',
    elevation: 3,
  },
  stickyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  metricRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  metricValue: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: '800',
  },
  snapshotList: {
    gap: spacing.sm,
  },
  snapshotRow: {
    gap: 8,
  },
  snapshotCopy: {
    gap: 4,
  },
  snapshotTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  snapshotText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  snapshotBarWrap: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E5EDF8',
    overflow: 'hidden',
  },
  snapshotBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  twoColWide: {
    flexDirection: 'row',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButtonsStacked: {
    flexDirection: 'column',
  },
  actionButton: {
    flex: 1,
  },
});
