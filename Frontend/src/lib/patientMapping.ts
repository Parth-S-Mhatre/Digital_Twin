import type { DigitalTwinData, HealthMetrics, RiskCategory } from '@/constants/health';
import type { PatientInput, PredictionResponse, Sex, SmokingStatus } from '@/types/api';
import { derivedFeaturesToOrgans } from '@/lib/organRiskMap';
import type { PatientProfile } from '@/constants/profile';

/**
 * Converters between the UI form (`PatientProfile`), the API contract
 * (`PatientInput`), and the dashboard's data shape (`DigitalTwinData`).
 *
 * Keeping these as pure functions in `src/lib/` keeps the mapping logic
 * testable and out of the components, matching the existing service-layer
 * convention (see healthService.ts).
 */

const REQUIRED_PREDICTION_KEYS: (keyof PatientProfile)[] = [
  'age',
  'gender',
  'height',
  'weight',
  'systolic',
  'diastolic',
  'activityLevel',
  'dietQuality',
  'smokingStatus',
  'alcoholConsumption',
  'medicalHistoryDiabetes',
  'medicalHistoryHypertension',
  'medicalHistoryHeartDisease',
  'cholesterolLevel',
  'glucoseLevel',
];

function parseNumber(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : NaN;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** height(cm) + weight(kg) → BMI; returns null until both values are valid. */
function computeBmi(heightCm: string, weightKg: string): number | null {
  const h = parseNumber(heightCm) / 100;
  const w = parseNumber(weightKg);
  if (h > 0 && w > 0) {
    return clamp(w / (h * h), 10, 60);
  }
  return null;
}

/** Activity level label → physical_activity binary (0 sedentary, 1 active). */
function activityToBinary(activity: string): 0 | 1 | null {
  const active = new Set(['light', 'moderate', 'active', 'athletic']);
  const key = activity.trim().toLowerCase();
  if (key === 'sedentary') return 0;
  if (active.has(key)) return 1;
  return null;
}

/**
 * Map `sex` from the free-form profile field. The model only accepts Female
 * and Male; any other value returns null so we do not guess.
 */
function normalizeSex(gender: string): Sex | null {
  const g = gender.trim().toLowerCase();
  if (g === 'male' || g === 'm') return 'Male';
  if (g === 'female' || g === 'f') return 'Female';
  return null;
}

/**
 * Map the form profile to the model's 14-feature input.
 *
 * Returns `null` when any required model field is missing or invalid. This
 * keeps the UI from fabricating a prediction with fallback demo values.
 */
export function profileToPatientInput(profile: PatientProfile): PatientInput | null {
  if (!isPredictionReady(profile)) {
    return null;
  }

  const age = clamp(parseNumber(profile.age), 0, 120);
  const sex = normalizeSex(profile.gender);
  const bmi = computeBmi(profile.height, profile.weight);
  const physicalActivity = activityToBinary(profile.activityLevel);
  const dietQuality = parseDietQuality(profile.dietQuality);
  const smokingStatus = normalizeSmoking(profile.smokingStatus);
  const alcoholConsumption = parseBinaryChoice(profile.alcoholConsumption);
  const diabetes = parseBinaryChoice(profile.medicalHistoryDiabetes);
  const hypertension = parseBinaryChoice(profile.medicalHistoryHypertension);
  const heartDisease = parseBinaryChoice(profile.medicalHistoryHeartDisease);
  const systolic = clamp(parseNumber(profile.systolic), 50, 260);
  const diastolic = clamp(parseNumber(profile.diastolic), 30, 180);
  const cholesterolLevel = clamp(parseNumber(profile.cholesterolLevel), 0, 3);
  const glucoseLevel = clamp(parseNumber(profile.glucoseLevel), 0, 3);

  if (
    !Number.isFinite(age) ||
    sex === null ||
    bmi === null ||
    physicalActivity === null ||
    dietQuality === null ||
    smokingStatus === null ||
    alcoholConsumption === null ||
    diabetes === null ||
    hypertension === null ||
    heartDisease === null ||
    !Number.isFinite(systolic) ||
    !Number.isFinite(diastolic) ||
    !Number.isFinite(cholesterolLevel) ||
    !Number.isFinite(glucoseLevel)
  ) {
    return null;
  }

  return {
    age,
    sex,
    bmi,
    physical_activity: physicalActivity,
    diet_quality: dietQuality,
    smoking_status: smokingStatus,
    alcohol_consumption: alcoholConsumption,
    medical_history_diabetes: diabetes,
    medical_history_hypertension: hypertension,
    medical_history_heart_disease: heartDisease,
    blood_pressure_systolic: systolic,
    blood_pressure_diastolic: diastolic,
    cholesterol_level: cholesterolLevel,
    glucose_level: glucoseLevel,
  };
}

function parseDietQuality(value: string): number | null {
  const numeric = parseNumber(value);
  if (Number.isFinite(numeric)) return clamp(numeric, 0, 5);
  // Infer a 0-5 score from the qualitative label.
  const v = value.trim().toLowerCase();
  if (v.includes('plant') || v.includes('balanced')) return 4;
  if (v.includes('high protein')) return 3;
  if (v.includes('poor')) return 1;
  return null;
}

function normalizeSmoking(value: string): SmokingStatus | null {
  const v = value.trim().toLowerCase();
  if (v === 'current' || v === 'smoker') return 'Current';
  if (v === 'former' || v === 'ex-smoker' || v === 'quit') return 'Former';
  if (v === 'never' || v === 'non-smoker' || v === 'non-smoke') return 'Never';
  if (v === 'unknown') return 'Unknown';
  return null;
}

function parseBinaryChoice(value: string): 0 | 1 | null {
  const v = value.trim().toLowerCase();
  if (v === '1' || v === 'yes' || v === 'true' || v === 'y') return 1;
  if (v === '0' || v === 'no' || v === 'false' || v === 'n') return 0;
  return null;
}

export function isPredictionReady(profile: PatientProfile): boolean {
  return REQUIRED_PREDICTION_KEYS.every((key) => profile[key].trim().length > 0);
}

/**
 * Map a prediction result onto the dashboard's `DigitalTwinData` shape so the
 * existing UI (HealthScoreCard, OrganStatusCard, avatar) can render it without
 * changes. The single risk probability drives the overall score and a
 * heuristic organ breakdown.
 */
export function predictionToDigitalTwinData(
  prediction: PredictionResponse,
  profile: PatientProfile,
  userId: string
): DigitalTwinData {
  const riskProbability = clamp(prediction.risk_probability, 0, 1);
  const overallScore = Math.round((1 - riskProbability) * 100);
  const riskCategory = probabilityToCategory(riskProbability);
  const organs = derivedFeaturesToOrgans(prediction.derived_features);

  const systolic = clamp(parseNumber(profile.systolic), 50, 260) || 120;
  const diastolic = clamp(parseNumber(profile.diastolic), 30, 180) || 80;

  const metrics: HealthMetrics = {
    overallScore,
    riskCategory,
    lastUpdated: new Date().toISOString(),
    organs,
    vitals: {
      heartRate: clamp(parseNumber(profile.heartRate), 30, 220) || 72,
      bloodPressure: `${systolic}/${diastolic}`,
      temperature: 98.6,
      oxygenLevel: 98,
    },
    trends: {
      metabolic: prediction.derived_features.glucose_level
        ? Number(prediction.derived_features.glucose_level) >= 2
          ? 'declining'
          : 'stable'
        : 'stable',
      cardiovascular:
        (prediction.derived_features.bp_status as string)?.includes('HTN') ||
        (prediction.derived_features.bp_status as string) === 'Elevated'
          ? 'declining'
          : 'stable',
      respiratory:
        prediction.derived_features.smoking_status === 'Current' ? 'declining' : 'stable',
    },
  };

  return {
    userId,
    metrics,
    recommendations: buildRecommendations(prediction),
    riskFactors: buildRiskFactors(prediction),
  };
}

function probabilityToCategory(p: number): RiskCategory {
  if (p >= 0.8) return 'critical';
  if (p >= 0.6) return 'high';
  if (p >= 0.4) return 'medium';
  if (p >= 0.2) return 'low';
  return 'very-low';
}

function buildRecommendations(prediction: PredictionResponse): string[] {
  const recs: string[] = [];
  const d = prediction.derived_features;

  if ((d.bp_status as string)?.includes('HTN')) {
    recs.push('Reduce sodium intake and monitor blood pressure weekly');
  }
  if (d.bmi_category === 'Obese' || d.bmi_category === 'Overweight') {
    recs.push('Aim for 150 minutes of moderate activity per week');
  }
  if (d.smoking_status === 'Current') {
    recs.push('Consider a smoking cessation program');
  }
  if (Number(d.comorbidity_count) >= 2) {
    recs.push('Schedule a follow-up with your primary care provider');
  }
  recs.push('Maintain consistent sleep and hydration');
  return recs.slice(0, 5);
}

function buildRiskFactors(prediction: PredictionResponse): string[] {
  const factors: string[] = [];
  const d = prediction.derived_features;

  if (d.bmi_category === 'Obese') factors.push('Obesity (high BMI)');
  else if (d.bmi_category === 'Overweight') factors.push('Overweight');
  if ((d.bp_status as string)?.includes('HTN')) factors.push('Hypertension');
  if (d.smoking_status === 'Current') factors.push('Active smoking');
  if (Number(d.comorbidity_count) >= 1) factors.push(`${d.comorbidity_count} comorbidit${Number(d.comorbidity_count) === 1 ? 'y' : 'ies'}`);
  if (d.age_group === '61-75' || d.age_group === '75+') factors.push('Older age group');

  return factors.length > 0 ? factors : ['No major risk factors detected'];
}
