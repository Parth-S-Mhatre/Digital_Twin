export type PatientProfile = {
  fullName: string;
  age: string;
  gender: string;
  bloodGroup: string;
  height: string;
  weight: string;
  systolic: string;
  diastolic: string;
  heartRate: string;
  activityLevel: string;
  sleepHours: string;
  dietQuality: string;
  existingConditions: string;
  familyHistory: string;
  medications: string;
  notes: string;
  // --- Clinical model inputs (drive the digital-twin prediction) ---
  smokingStatus: string; // Current | Former | Never | Unknown
  alcoholConsumption: string; // '1' (yes) | '0' (no)
  medicalHistoryDiabetes: string; // '1' | '0'
  medicalHistoryHypertension: string; // '1' | '0'
  medicalHistoryHeartDisease: string; // '1' | '0'
  cholesterolLevel: string; // 0-3 ordinal risk level
  glucoseLevel: string; // 0-3 ordinal risk level
};

export type ProfileFieldGroup = {
  title: string;
  description: string;
  keys: readonly (keyof PatientProfile)[];
};

export const DEFAULT_PATIENT_PROFILE: PatientProfile = {
  fullName: '',
  age: '',
  gender: '',
  bloodGroup: '',
  height: '',
  weight: '',
  systolic: '',
  diastolic: '',
  heartRate: '',
  activityLevel: '',
  sleepHours: '',
  dietQuality: '',
  existingConditions: '',
  familyHistory: '',
  medications: '',
  notes: '',
  smokingStatus: '',
  alcoholConsumption: '',
  medicalHistoryDiabetes: '',
  medicalHistoryHypertension: '',
  medicalHistoryHeartDisease: '',
  cholesterolLevel: '',
  glucoseLevel: '',
};

export const PROFILE_FIELD_GROUPS: ProfileFieldGroup[] = [
  {
    title: 'Core profile',
    description: 'Baseline identity and biometrics for model intake.',
    keys: ['fullName', 'age', 'gender', 'bloodGroup'],
  },
  {
    title: 'Vital signals',
    description: 'Core values the model uses to estimate current health state.',
    keys: ['height', 'weight', 'systolic', 'diastolic', 'heartRate'],
  },
  {
    title: 'Lifestyle pattern',
    description: 'Activity and nutrition signals that shape future projections.',
    keys: ['activityLevel', 'sleepHours', 'dietQuality'],
  },
  {
    title: 'History and context',
    description: 'Conditions, family history, medication, and notes.',
    keys: ['existingConditions', 'familyHistory', 'medications', 'notes'],
  },
  {
    title: 'Clinical model inputs',
    description: 'Parameters the digital-twin model uses directly for its risk estimate.',
    keys: [
      'smokingStatus',
      'alcoholConsumption',
      'medicalHistoryDiabetes',
      'medicalHistoryHypertension',
      'medicalHistoryHeartDisease',
      'cholesterolLevel',
      'glucoseLevel',
    ],
  },
];

export const GENDER_OPTIONS = ['Female', 'Male', 'Other'] as const;
export const BLOOD_GROUP_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export const ACTIVITY_OPTIONS = ['Sedentary', 'Light', 'Moderate', 'Active', 'Athletic'] as const;
export const DIET_OPTIONS = ['Poor', 'Balanced', 'High protein', 'Plant-forward'] as const;

// --- Options for the clinical model inputs ---
export const SMOKING_OPTIONS = ['Never', 'Former', 'Current', 'Unknown'] as const;
export const YES_NO_OPTIONS = ['No', 'Yes'] as const;
// 0 = optimal … 3 = high risk (ordinal, NOT mg/dL — matches the backend enum).
export const CLINICAL_RISK_OPTIONS = ['0 - Optimal', '1 - Mild', '2 - Moderate', '3 - High'] as const;

export function isProfileFilled(profile: PatientProfile, key: keyof PatientProfile) {
  return profile[key].trim().length > 0;
}

export function getProfileCompletion(profile: PatientProfile | null) {
  if (!profile) {
    return 0;
  }

  const total = PROFILE_FIELD_GROUPS.reduce((count, group) => count + group.keys.length, 0);
  const filled = PROFILE_FIELD_GROUPS.reduce(
    (count, group) => count + group.keys.filter((key) => isProfileFilled(profile, key)).length,
    0
  );

  return Math.round((filled / total) * 100);
}

export function isProfileComplete(profile: PatientProfile | null) {
  return getProfileCompletion(profile) === 100;
}

export function mergeProfile(
  base: PatientProfile,
  patch: Partial<PatientProfile> | null | undefined
): PatientProfile {
  return { ...base, ...(patch ?? {}) };
}
