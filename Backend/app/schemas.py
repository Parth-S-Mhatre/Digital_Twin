from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field


class Sex(str, Enum):
    female = "Female"
    male = "Male"


class SmokingStatus(str, Enum):
    current = "Current"
    never = "Never"
    former = "Former"
    unknown = "Unknown"


class PredictionBranch(str, Enum):
    xgboost = "xgboost"
    bilstm = "bilstm"
    fusion = "fusion"


class ExplainScope(str, Enum):
    global_ = "global"
    local = "local"


class PatientInput(BaseModel):
    age: float = Field(..., ge=0, le=120, description="Age in years")
    sex: Sex
    bmi: float = Field(..., gt=0, le=80, description="Body mass index")
    physical_activity: int = Field(..., ge=0, le=1, description="0 or 1")
    diet_quality: float = Field(..., ge=0, le=5, description="Diet quality score")
    smoking_status: SmokingStatus
    alcohol_consumption: int = Field(..., ge=0, le=1, description="0 or 1")
    medical_history_diabetes: int = Field(..., ge=0, le=1, description="0 or 1")
    medical_history_hypertension: int = Field(..., ge=0, le=1, description="0 or 1")
    medical_history_heart_disease: int = Field(..., ge=0, le=1, description="0 or 1")
    blood_pressure_systolic: float = Field(..., ge=50, le=260)
    blood_pressure_diastolic: float = Field(..., ge=30, le=180)
    cholesterol_level: float = Field(..., ge=0, le=3, description="Ordinal cholesterol risk level")
    glucose_level: float = Field(..., ge=0, le=3, description="Ordinal glucose risk level")


class PredictRequest(BaseModel):
    patient: PatientInput
    branch: PredictionBranch = PredictionBranch.fusion


class ExplainRequest(BaseModel):
    patient: Optional[PatientInput] = None
    branch: PredictionBranch = PredictionBranch.xgboost
    scope: ExplainScope = ExplainScope.global_


class LoginRequest(BaseModel):
    username: str
    password: str


class PredictionResponse(BaseModel):
    branch: str
    risk_probability: float
    predicted_class: int
    threshold: float
    interpretation: str
    confidence: float
    model_outputs: dict
    derived_features: dict


class ExplainResponse(BaseModel):
    branch: str
    scope: str
    summary: dict


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str


class ModelInfoResponse(BaseModel):
    model_name: str
    static_branch_name: str
    second_branch_name: str
    feature_count: int
    static_threshold: float
    bilstm_threshold: float
    fusion_threshold: float
    feature_columns: list[str]


class EndpointInfoResponse(BaseModel):
    endpoint: str
    branch: str
    name: str
    plain_language: str
    what_it_uses: list[str]
    what_it_predicts: str
    when_to_use: str
    notes: list[str]


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "api_key"


# ---------------------------------------------------------------------------
# Visualization & Recommendation schemas
# ---------------------------------------------------------------------------

class RiskCategory(str, Enum):
    very_low = "very-low"
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class RecommendationPriority(str, Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


class RecommendationCategory(str, Enum):
    blood_pressure = "blood_pressure"
    weight = "weight"
    smoking = "smoking"
    lifestyle = "lifestyle"
    comorbidity = "comorbidity"
    metabolic = "metabolic"
    general = "general"


class Recommendation(BaseModel):
    category: RecommendationCategory
    priority: RecommendationPriority
    title: str
    rationale: str
    actionable_steps: list[str]
    expected_impact: str
    shap_contribution: float = Field(description="SHAP value that triggered this recommendation")
    feature_name: str = Field(description="Model feature that drove this recommendation")


class RecommendationResponse(BaseModel):
    recommendations: list[Recommendation]
    total_risk_factors: int
    top_risk_driver: str
    risk_probability: float


class BranchBarData(BaseModel):
    branch: str
    probability: float
    color: str


class ShapContribution(BaseModel):
    feature: str
    shap_value: float
    direction: str = Field(description="'increases_risk' or 'decreases_risk'")
    raw_value: float | str = Field(description="Original patient value (number, or 'Present'/'Absent' for one-hot)")
    unit: str = Field(default="", description="Human-readable unit (mmHg, kg/m², etc.)")


class RiskDashboardResponse(BaseModel):
    risk_score: int = Field(description="0-100 health score (100 - risk_probability * 100)")
    risk_category: RiskCategory
    risk_probability: float
    branch_comparison: list[BranchBarData]
    feature_contributions: list[ShapContribution]
    risk_factors: list[str]


class RiskHistoryPoint(BaseModel):
    date: str = Field(description="ISO 8601 timestamp")
    risk_probability: float
    risk_category: RiskCategory
    branch_scores: dict[str, float] = Field(description="Per-branch probabilities")


class RiskHistoryResponse(BaseModel):
    user_id: str
    predictions: list[RiskHistoryPoint]
    trend: str = Field(description="'improving', 'stable', or 'declining'")
    earliest_date: str | None = None
    latest_date: str | None = None


# ---------------------------------------------------------------------------
# Medical LLM Chat Schemas
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str


class MedicalChatRequest(BaseModel):
    user_message: str
    conversation_history: Optional[list[ChatMessage]] = None
    patient_data: Optional[PatientInput] = None
    preferred_provider: Optional[str] = Field(default=None, description="'groq', 'gemini', 'openrouter', or None")


class MedicalChatResponse(BaseModel):
    response: str
    provider: str
    model: str
    success: bool
    error: Optional[str] = None


class LLMProviderInfo(BaseModel):
    name: str
    model: str
    status: str
    free_tier: bool
    medical_capability: str


class MedicalRecommendationsRequest(BaseModel):
    patient_data: PatientInput
    risk_score: Optional[float] = None
    risk_category: Optional[str] = None

