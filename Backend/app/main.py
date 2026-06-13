from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from .schemas import (
    EndpointInfoResponse,
    ExplainRequest,
    ExplainResponse,
    HealthResponse,
    LoginRequest,
    ModelInfoResponse,
    PatientInput,
    PredictRequest,
    PredictionResponse,
    TokenResponse,
)
from .services import service


app = FastAPI(
    title="Digital Twin API",
    description="FastAPI service for hybrid digital twin prediction, forecasting, and XAI.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_api_key(x_api_key: str | None = Header(default=None)) -> str:
    expected = "dev-api-key"
    if x_api_key != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key",
        )
    return x_api_key


@app.get("/", tags=["root"])
def root():
    return {
        "message": "Digital Twin API is running",
        "docs": "/docs",
        "health": "/health",
        "model_info": "/model-info",
    }


@app.get("/health", response_model=HealthResponse, tags=["health"])
def health():
    return service.health_payload()


@app.get("/model-info", response_model=ModelInfoResponse, tags=["model"])
def model_info():
    return service.model_info()


def branch_info_payload(branch: str) -> dict:
    if branch == "xgboost":
        return {
            "endpoint": "/predict/tabular",
            "branch": "xgboost",
            "name": "Tabular Risk Prediction",
            "plain_language": (
                "This is the row-and-column model. It looks at one patient record, "
                "like a spreadsheet row, and learns patterns from clinical values such as "
                "age, BMI, blood pressure, glucose, cholesterol, lifestyle, and medical history."
            ),
            "what_it_uses": [
                "Patient values stored in rows and columns",
                "Clinical features such as age, BMI, blood pressure, glucose, and cholesterol",
                "A fast tree-based model that works very well on structured healthcare data",
            ],
            "what_it_predicts": "The unified integrated-dataset disease risk target (`target_disease`).",
            "when_to_use": (
                "Use this when you want a strong prediction from the current patient profile only, "
                "without sequence history."
            ),
            "notes": [
                "This is not a separate diabetes-only or heart-disease-only endpoint.",
                "It predicts the integrated target from the merged healthcare dataset.",
            ],
        }

    if branch == "bilstm":
        return {
            "endpoint": "/predict/bilstm",
            "branch": "bilstm",
            "name": "Temporal Forecasting Prediction",
            "plain_language": (
                "This is the time-aware model. It tries to understand how a patient's health may "
                "change over time by reading a short sequence of patient states. In this project, "
                "the sequence is a synthetic proxy created from the current patient profile."
            ),
            "what_it_uses": [
                "A sequence of time steps instead of just one row",
                "Health changes over time, such as gradual shifts in BMI or blood pressure",
                "BiLSTM, which reads the sequence in both directions",
            ],
            "what_it_predicts": "The unified integrated-dataset disease risk target (`target_disease`).",
            "when_to_use": (
                "Use this when you want to test a forecasting-style model that captures progression "
                "and temporal patterning."
            ),
            "notes": [
                "The current dataset is not truly longitudinal, so this branch uses a synthetic temporal proxy.",
                "If real visit history becomes available later, this endpoint can be upgraded to real forecasting.",
            ],
        }

    return {
        "endpoint": "/predict",
        "branch": "fusion",
        "name": "Fusion Meta-Learner Prediction",
        "plain_language": (
            "This is the final combined model. It takes the tabular model's result and the temporal "
            "model's result, then merges them into one final digital twin risk score."
        ),
        "what_it_uses": [
            "Tabular XGBoost probability",
            "BiLSTM temporal probability",
            "A small logistic-regression meta-learner that combines both outputs",
        ],
        "what_it_predicts": "The final unified integrated-dataset disease risk target (`target_disease`).",
        "when_to_use": (
            "Use this as the main endpoint when you want the most complete digital twin prediction."
        ),
        "notes": [
            "This is the best endpoint for the main application flow.",
            "It combines both static patient data and temporal behavior.",
        ],
    }


@app.get("/predict/tabular/info", response_model=EndpointInfoResponse, tags=["predict", "info"])
def predict_tabular_info():
    return branch_info_payload("xgboost")


@app.get("/predict/bilstm/info", response_model=EndpointInfoResponse, tags=["predict", "info"])
def predict_bilstm_info():
    return branch_info_payload("bilstm")


@app.get("/predict/fusion/info", response_model=EndpointInfoResponse, tags=["predict", "info"])
def predict_fusion_info():
    return branch_info_payload("fusion")


@app.post("/predict", response_model=PredictionResponse, tags=["predict"])
def predict(payload: PredictRequest):
    result = service.predict(payload.patient, payload.branch.value)
    probability = (
        result.fusion_probability
        if payload.branch.value == "fusion"
        else result.tabular_probability
        if payload.branch.value == "xgboost"
        else result.bilstm_probability
    )
    threshold = (
        result.fusion_threshold
        if payload.branch.value == "fusion"
        else result.tabular_threshold
        if payload.branch.value == "xgboost"
        else result.bilstm_threshold
    )
    prediction = (
        result.fusion_prediction
        if payload.branch.value == "fusion"
        else result.tabular_prediction
        if payload.branch.value == "xgboost"
        else result.bilstm_prediction
    )

    return {
        "branch": payload.branch.value,
        "risk_probability": float(probability),
        "predicted_class": int(prediction),
        "threshold": float(threshold),
        "interpretation": "High risk" if int(prediction) == 1 else "Lower risk",
        "confidence": float(probability if int(prediction) == 1 else 1.0 - probability),
        "model_outputs": {
            "xgboost_probability": float(result.tabular_probability),
            "bilstm_probability": float(result.bilstm_probability),
            "fusion_probability": float(result.fusion_probability)
            if result.fusion_probability == result.fusion_probability
            else None,
        },
        "derived_features": result.derived_features,
    }


@app.post("/predict/tabular", response_model=PredictionResponse, tags=["predict"])
def predict_tabular(patient: PatientInput):
    payload = PredictRequest(patient=patient, branch="xgboost")
    return predict(payload)


@app.post("/predict/bilstm", response_model=PredictionResponse, tags=["predict"])
def predict_bilstm(patient: PatientInput):
    payload = PredictRequest(patient=patient, branch="bilstm")
    return predict(payload)


@app.post("/predict/fusion", response_model=PredictionResponse, tags=["predict"])
def predict_fusion(patient: PatientInput):
    payload = PredictRequest(patient=patient, branch="fusion")
    return predict(payload)


@app.post("/explain/xai", response_model=ExplainResponse, tags=["xai"])
def explain_xai(payload: ExplainRequest):
    if payload.scope.value == "global":
        summary = service.explain_global(payload.branch.value)
    else:
        if payload.patient is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="patient is required for local explanations",
            )
        summary = service.explain_local(payload.patient, payload.branch.value)

    return {
        "branch": payload.branch.value,
        "scope": payload.scope.value,
        "summary": summary,
    }


@app.get("/explain/xai/info", tags=["xai", "info"])
def explain_xai_info():
    return {
        "endpoint": "/explain/xai",
        "purpose": "Explains why the model gave a prediction.",
        "plain_language": (
            "This endpoint is like asking the model, 'What made you say this?' It returns the most "
            "important features for a branch and, when possible, a patient-level explanation."
        ),
        "available_scopes": ["global", "local"],
        "global": "Shows which features matter most across many patients.",
        "local": "Shows why one specific patient was scored the way they were.",
        "branches": ["xgboost", "bilstm", "fusion"],
    }


@app.post("/auth/login", response_model=TokenResponse, tags=["auth"])
def login(payload: LoginRequest):
    expected_user = "admin"
    expected_pass = "admin123"
    if payload.username != expected_user or payload.password != expected_pass:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    return {"access_token": "dev-api-key", "token_type": "api_key"}


@app.get("/admin/overview", tags=["admin"])
def admin_overview(_: str = Depends(require_api_key)):
    return service.admin_overview()
