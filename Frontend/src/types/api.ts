/**
 * Type definitions mirroring `Backend/app/schemas.py` 1:1.
 * Enum values are case-sensitive capitalized strings — keep them verbatim,
 * the FastAPI layer validates against the same tokens.
 */

export type Sex = 'Female' | 'Male';

export type SmokingStatus = 'Current' | 'Never' | 'Former' | 'Unknown';

export type PredictionBranch = 'xgboost' | 'bilstm' | 'fusion';

/**
 * The 14 features the digital twin model consumes.
 * Mirrors `PatientInput` (schemas.py:30). ALL fields required.
 */
export type PatientInput = {
  age: number; // 0-120 years
  sex: Sex;
  bmi: number; // >0, ≤80
  physical_activity: 0 | 1; // binary
  diet_quality: number; // 0-5 score
  smoking_status: SmokingStatus;
  alcohol_consumption: 0 | 1; // binary
  medical_history_diabetes: 0 | 1; // binary
  medical_history_hypertension: 0 | 1; // binary
  medical_history_heart_disease: 0 | 1; // binary
  blood_pressure_systolic: number; // 50-260
  blood_pressure_diastolic: number; // 30-180
  cholesterol_level: number; // 0-3 ordinal risk level (NOT mg/dL)
  glucose_level: number; // 0-3 ordinal risk level (NOT mg/dL)
};

/**
 * Server-derived categories (services.py `_derive_categories`).
 * Returned inside `PredictionResponse.derived_features`.
 */
export type DerivedFeatures = {
  age_group: '18-30' | '31-45' | '46-60' | '61-75' | '75+' | string;
  bmi_category: 'Underweight' | 'Normal' | 'Overweight' | 'Obese' | string;
  bp_status: 'Normal' | 'Elevated' | 'Stage1_HTN' | 'Stage2_HTN' | string;
  smoking_status: SmokingStatus | string;
  pulse_pressure: number; // sbp − dbp
  comorbidity_count: number; // 0-3
  [key: string]: unknown;
};

/**
 * Mirrors `PredictionResponse` (schemas.py:63).
 * `predicted_class`: 1 = High risk, 0 = Lower risk.
 */
export type PredictionResponse = {
  branch: string;
  risk_probability: number; // 0-1
  predicted_class: 0 | 1;
  threshold: number;
  interpretation: string; // "High risk" | "Lower risk"
  confidence: number; // 0-1
  model_outputs: {
    xgboost_probability?: number | null;
    bilstm_probability?: number | null;
    fusion_probability?: number | null;
    [key: string]: unknown;
  };
  derived_features: DerivedFeatures;
};

export type ModelInfoResponse = {
  model_name: string;
  static_branch_name: string;
  feature_count: number;
  static_threshold: number;
  bilstm_threshold: number;
  fusion_threshold: number;
  feature_columns: string[];
};

export type HealthResponse = {
  status: string;
  service: string;
  version: string;
};

// ---------------------------------------------------------------------------
// Visualization & Recommendation types
// (mirror Backend/app/schemas.py — Recommendation, RiskDashboard, RiskHistory)
// ---------------------------------------------------------------------------

export type RiskCategory = 'very-low' | 'low' | 'medium' | 'high' | 'critical';

export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low';

export type RecommendationCategory =
  | 'blood_pressure'
  | 'weight'
  | 'smoking'
  | 'lifestyle'
  | 'comorbidity'
  | 'metabolic'
  | 'general';

export type Recommendation = {
  category: RecommendationCategory;
  priority: RecommendationPriority;
  title: string;
  rationale: string;
  actionable_steps: string[];
  expected_impact: string;
  shap_contribution: number;
  feature_name: string;
};

export type RecommendationResponse = {
  recommendations: Recommendation[];
  total_risk_factors: number;
  top_risk_driver: string;
  risk_probability: number;
};

export type BranchBarData = {
  branch: string;
  probability: number; // 0-100
  color: string; // hex
};

export type ShapContribution = {
  feature: string;
  shap_value: number;
  direction: 'increases_risk' | 'decreases_risk';
  raw_value: number | string;
  unit: string;
};

export type RiskDashboardResponse = {
  risk_score: number; // 0-100
  risk_category: RiskCategory;
  risk_probability: number; // 0-1
  branch_comparison: BranchBarData[];
  feature_contributions: ShapContribution[];
  risk_factors: string[];
};

export type RiskHistoryPoint = {
  date: string; // ISO 8601
  risk_probability: number;
  risk_category: RiskCategory;
  branch_scores: Record<string, number>;
};

export type RiskHistoryResponse = {
  user_id: string;
  predictions: RiskHistoryPoint[];
  trend: 'improving' | 'stable' | 'declining';
  earliest_date: string | null;
  latest_date: string | null;
};
