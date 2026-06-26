import logging

from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .schemas import (
    EndpointInfoResponse,
    ExplainRequest,
    ExplainResponse,
    HealthResponse,
    LoginRequest,
    LLMProviderInfo,
    MedicalChatRequest,
    MedicalChatResponse,
    MedicalRecommendationsRequest,
    ModelInfoResponse,
    PatientInput,
    PredictRequest,
    PredictionResponse,
    RecommendationResponse,
    RiskDashboardResponse,
    RiskHistoryResponse,
    TokenResponse,
    DiseasePredictionResponse,
    AllDiseasePredictionsResponse,
)
from .services import service, disease_service
from .visualization import build_recommendations, build_risk_dashboard
from .ai_medical_service import medical_llm_service, Message, LLMProvider

logger = logging.getLogger("digital_twin")

app = FastAPI(
    title="Digital Twin API",
    description="FastAPI service for hybrid digital twin prediction and XAI.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all so unhandled failures return a consistent JSON shape instead
    of a bare 500. HTTPException is intentionally NOT caught here — FastAPI's
    own handler still owns those (401/400/422), preserving existing behaviour.
    """
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Internal server error",
            "error_type": "internal_error",
        },
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
            "name": "LightGBM Gradient Boosting Prediction",
            "plain_language": (
                "This is a second tree-based model that uses a different algorithm (LightGBM) from the "
                "XGBoost branch. LightGBM grows trees leaf-by-leaf and uses efficient histogram-based "
                "split finding, providing an independent perspective on the same clinical features."
            ),
            "what_it_uses": [
                "The same patient features as the XGBoost branch (age, BMI, blood pressure, etc.)",
                "LightGBM: leaf-wise tree growth with GOSS and EFB optimizations",
                "Balanced class weighting to handle the disease-risk imbalance",
            ],
            "what_it_predicts": "The unified integrated-dataset disease risk target (`target_disease`).",
            "when_to_use": (
                "Use this as a second-opinion model. It complements the XGBoost branch in the "
                "fusion endpoint."
            ),
            "notes": [
                "Replaces the former BiLSTM temporal branch — the original dataset is "
                "cross-sectional, not longitudinal, so synthetic sequences were removed.",
                "API field names (bilstm_probability, bilstm_prediction) are kept for backward "
                "compatibility but the underlying model is LightGBM.",
            ],
        }

    return {
        "endpoint": "/predict",
        "branch": "fusion",
        "name": "Fusion Meta-Learner Prediction",
        "plain_language": (
            "This is the final combined model. It takes the XGBoost tabular model's result and the "
            "LightGBM model's result, then merges them into one final digital twin risk score."
        ),
        "what_it_uses": [
            "XGBoost tabular probability",
            "LightGBM gradient-boosting probability",
            "A small logistic-regression meta-learner that combines both outputs",
        ],
        "what_it_predicts": "The final unified integrated-dataset disease risk target (`target_disease`).",
        "when_to_use": (
            "Use this as the main endpoint when you want the most complete digital twin prediction."
        ),
        "notes": [
            "This is the best endpoint for the main application flow.",
            "It combines two diverse tree-based models for a more robust ensemble.",
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


# ---------------------------------------------------------------------------
# Visualization & Recommendations
# ---------------------------------------------------------------------------


@app.post(
    "/visuals/risk-dashboard",
    response_model=RiskDashboardResponse,
    tags=["visualization"],
)
def risk_dashboard(patient: PatientInput):
    """Chart-ready payload for the risk dashboard.

    Returns branch comparison bars, top SHAP feature contributions (waterfall),
    a 0–100 risk score, and the risk category — everything the frontend needs
    to render the dashboard charts without calling multiple endpoints.
    """
    result = service.predict(patient, "fusion")

    # Pull local SHAP contributions from the XGBoost branch (the primary
    # explanation source).  Falls back to feature importances if SHAP fails.
    try:
        local_explain = service.explain_local(patient, "xgboost")
        contributions = local_explain.get("top_contributions", [])
    except Exception:
        contributions = []

    encoded_row = service.encode_patient(patient)

    return build_risk_dashboard(
        tabular_proba=result.tabular_probability,
        second_proba=result.bilstm_probability,
        fusion_proba=result.fusion_probability,
        shap_contributions=contributions,
        encoded_row=encoded_row,
        derived_features=result.derived_features,
    )


@app.post(
    "/recommendations",
    response_model=RecommendationResponse,
    tags=["recommendations"],
)
def recommendations(patient: PatientInput):
    """SHAP-prioritized, actionable health recommendations.

    Each recommendation carries a category, priority, rationale tied to the
    model's feature attribution, concrete steps, and the expected health
    impact.  Replaces the client-side heuristic strings.
    """
    result = service.predict(patient, "fusion")

    try:
        local_explain = service.explain_local(patient, "xgboost")
        contributions = local_explain.get("top_contributions", [])
    except Exception:
        contributions = []

    return build_recommendations(
        shap_contributions=contributions,
        derived_features=result.derived_features,
        risk_probability=result.fusion_probability,
        encoded_row=result.encoded_row,
    )


@app.get(
    "/visuals/risk-history/{user_id}",
    response_model=RiskHistoryResponse,
    tags=["visualization"],
)
def risk_history(user_id: str, limit: int = 50):
    """Time-series of past predictions for trend charts.

    Reads from Firestore (``users/{uid}/predictions``), which the frontend
    writes after each prediction.  Returns an empty list if Firebase is not
    configured — the rest of the API remains functional.
    """
    from .firebase_client import get_prediction_history

    return get_prediction_history(user_id, limit=limit)


@app.get("/visuals/info", tags=["visualization", "info"])
def visuals_info():
    return {
        "endpoints": {
            "risk_dashboard": "POST /visuals/risk-dashboard",
            "recommendations": "POST /recommendations",
            "risk_history": "GET /visuals/risk-history/{user_id}",
        },
        "plain_language": (
            "These endpoints return chart-ready data and actionable recommendations "
            "so the frontend can render visualizations and show patients what to "
            "improve or avoid."
        ),
        "dashboard_returns": [
            "Branch comparison bars (XGBoost vs LightGBM vs Fusion)",
            "Top SHAP feature contributions (waterfall chart)",
            "0-100 risk score and category",
            "Risk factor list",
        ],
        "recommendations_return": [
            "Structured recommendations with priority and category",
            "Rationale tied to SHAP feature attribution",
            "Actionable steps and expected health impact",
        ],
        "history_returns": [
            "Chronological list of past predictions",
            "Trend classification (improving / stable / declining)",
        ],
    }


@app.get("/admin/overview", tags=["admin"])
def admin_overview(_: str = Depends(require_api_key)):
    return service.admin_overview()


# ---------------------------------------------------------------------------
# Medical LLM Chatbot Endpoints
# ---------------------------------------------------------------------------

@app.post(
    "/medical-chat",
    response_model=MedicalChatResponse,
    tags=["medical-ai", "chatbot"]
)
async def medical_chat(payload: MedicalChatRequest):
    """Chat with a medical AI assistant that understands health data and can provide personalized guidance."""
    
    history = None
    if payload.conversation_history:
        history = [
            Message(role=msg.role, content=msg.content)
            for msg in payload.conversation_history
        ]
    
    patient_dict = None
    if payload.patient_data:
        patient_dict = payload.patient_data.model_dump()
    
    preferred_provider = None
    if payload.preferred_provider:
        try:
            preferred_provider = LLMProvider(payload.preferred_provider)
        except ValueError:
            pass
    
    result = await medical_llm_service.chat_with_medical_llm(
        user_message=payload.user_message,
        conversation_history=history,
        patient_data=patient_dict,
        preferred_provider=preferred_provider
    )
    
    return {
        "response": result.response,
        "provider": result.provider,
        "model": result.model,
        "success": result.success,
        "error": result.error
    }


@app.post(
    "/medical-recommendations",
    response_model=MedicalChatResponse,
    tags=["medical-ai", "recommendations"]
)
async def medical_recommendations(payload: MedicalRecommendationsRequest):
    """Generate personalized medical recommendations using AI based on patient data and risk profile."""
    
    patient_dict = payload.patient_data.model_dump()
    
    result = await medical_llm_service.generate_personalized_recommendations(
        patient_data=patient_dict,
        risk_score=payload.risk_score,
        risk_category=payload.risk_category
    )
    
    return {
        "response": result.response,
        "provider": result.provider,
        "model": result.model,
        "success": result.success,
        "error": result.error
    }


@app.get(
    "/medical-ai/providers",
    response_model=list[LLMProviderInfo],
    tags=["medical-ai", "info"]
)
def get_llm_providers():
    """Get information about available LLM providers and their medical capabilities."""
    return medical_llm_service.get_available_providers()


@app.get("/medical-ai/info", tags=["medical-ai", "info"])
def medical_ai_info():
    """Information about the medical AI features."""
    return {
        "endpoints": {
            "chat": "POST /medical-chat",
            "recommendations": "POST /medical-recommendations",
            "providers": "GET /medical-ai/providers"
        },
        "features": [
            "Medical chatbot with personalized health guidance",
            "AI-generated recommendations based on patient data",
            "Multiple free LLM providers available",
            "Fallback rule-based system when API keys not set"
        ],
        "free_api_options": [
            {
                "provider": "SiliconFlow",
                "model": "Qwen2.5-7B-Instruct",
                "setup_url": "https://cloud.siliconflow.cn/",
                "medical_capability": "Good",
                "rate_limits": "Free models available",
                "recommended": True
            },
            {
                "provider": "Qwen (Alibaba)",
                "model": "qwen-plus",
                "setup_url": "https://bailian.console.aliyun.com/",
                "medical_capability": "Good",
                "rate_limits": "1M free tokens (90 days)"
            },
            {
                "provider": "Groq",
                "model": "Llama 3.3 70B",
                "setup_url": "https://console.groq.com/keys",
                "medical_capability": "Excellent",
                "rate_limits": "14,400 requests/day"
            },
            {
                "provider": "Google Gemini",
                "model": "Gemini 2.0 Flash",
                "setup_url": "https://aistudio.google.com/app/apikey",
                "medical_capability": "Excellent (Top scores)",
                "rate_limits": "1,500 requests/day"
            },
            {
                "provider": "OpenRouter",
                "model": "qwen/qwen3.6-plus:free",
                "setup_url": "https://openrouter.ai/keys",
                "medical_capability": "Good",
                "rate_limits": "Limited free tier"
            }
        ]
    }


# --- New Disease Prediction Endpoints ---
def _format_disease_prediction(result):
    """Helper function to format disease prediction response"""
    return DiseasePredictionResponse(
        disease=result.disease,
        risk_probability=result.probability,
        predicted_class=result.predicted_class,
        interpretation="High risk" if result.predicted_class == 1 else "Lower risk"
    )


@app.post("/predict/cardiovascular", response_model=DiseasePredictionResponse, tags=["disease-prediction"])
def predict_cardiovascular(patient: PatientInput):
    result = disease_service.predict_cardiovascular(patient)
    return _format_disease_prediction(result)


@app.post("/predict/diabetes", response_model=DiseasePredictionResponse, tags=["disease-prediction"])
def predict_diabetes(patient: PatientInput):
    result = disease_service.predict_diabetes(patient)
    return _format_disease_prediction(result)


@app.post("/predict/heart-disease", response_model=DiseasePredictionResponse, tags=["disease-prediction"])
def predict_heart_disease(patient: PatientInput):
    result = disease_service.predict_heart_disease(patient)
    return _format_disease_prediction(result)


@app.post("/predict/all-diseases", response_model=AllDiseasePredictionsResponse, tags=["disease-prediction"])
def predict_all_diseases(patient: PatientInput):
    results = disease_service.predict_all(patient)
    return AllDiseasePredictionsResponse(
        cardiovascular=_format_disease_prediction(results["cardiovascular"]),
        diabetes=_format_disease_prediction(results["diabetes"]),
        heart_disease=_format_disease_prediction(results["heart_disease"])
    )

