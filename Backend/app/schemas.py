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
