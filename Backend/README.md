# Digital Twin FastAPI Backend

FastAPI service for:

- health check
- XGBoost tabular prediction
- LightGBM second branch prediction (migrated from BiLSTM)
- fusion/meta-learner prediction
- XAI explanations (SHAP-based)
- SHAP-driven actionable health recommendations
- chart-ready risk dashboard payloads
- prediction history time-series (Firebase/Firestore)
- lightweight admin monitoring

## Run

From the project root:

```bash
cd Backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open:

- Swagger: `http://127.0.0.1:8000/docs`
- Health: `http://127.0.0.1:8000/health`

## Deployment Configs

This repo now includes deployment manifests without actually deploying anything:

- `Backend/railway.toml` for Railway testing
- `render.yaml` at the repo root for the future Render deployment

Both configs run the same FastAPI app with:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Expected runtime files and env vars:

- `Backend/requirements.txt`
- `Modellling/outputs/hybrid_digital_twin_model.joblib`
- `DT_API_KEY`
- `DT_ADMIN_USER`
- `DT_ADMIN_PASSWORD`
- `GOOGLE_APPLICATION_CREDENTIALS` only if you want Firestore history reads

## Authentication

Admin routes use a simple API key for now.

Login demo:

`POST /auth/login`

Request body:

```json
{
  "username": "admin",
  "password": "admin123"
}
```

Response:

```json
{
  "access_token": "dev-api-key",
  "token_type": "api_key"
}
```

Use the returned token as:

```http
X-API-Key: dev-api-key
```

## Core Endpoints

### 1. Health check

`GET /health`

### 2. General prediction

`POST /predict`

Body:

```json
{
  "branch": "fusion",
  "patient": {
    "age": 52,
    "sex": "Male",
    "bmi": 28.4,
    "physical_activity": 1,
    "diet_quality": 3,
    "smoking_status": "Current",
    "alcohol_consumption": 0,
    "medical_history_diabetes": 0,
    "medical_history_hypertension": 1,
    "medical_history_heart_disease": 0,
    "blood_pressure_systolic": 142,
    "blood_pressure_diastolic": 92,
    "cholesterol_level": 2,
    "glucose_level": 1
  }
}
```

### 3. XGBoost tabular prediction

`POST /predict/tabular`

### 4. LightGBM second branch

`POST /predict/bilstm`

> **Note:** The URL path still uses `/bilstm` for backward compatibility, but the
> model has been migrated to LightGBM gradient-boosted trees.

### 5. Fusion prediction

`POST /predict/fusion`

### 6. Explainability

`POST /explain/xai`

Example global explanation:

```json
{
  "branch": "xgboost",
  "scope": "global"
}
```

Example local explanation:

```json
{
  "branch": "xgboost",
  "scope": "local",
  "patient": {
    "age": 52,
    "sex": "Male",
    "bmi": 28.4,
    "physical_activity": 1,
    "diet_quality": 3,
    "smoking_status": "Current",
    "alcohol_consumption": 0,
    "medical_history_diabetes": 0,
    "medical_history_hypertension": 1,
    "medical_history_heart_disease": 0,
    "blood_pressure_systolic": 142,
    "blood_pressure_diastolic": 92,
    "cholesterol_level": 2,
    "glucose_level": 1
  }
}
```

### 7. Risk Dashboard (Visualization)

`POST /visuals/risk-dashboard`

Accepts the same `PatientInput` body. Returns a chart-ready JSON payload with:

- `risk_score`: 0–100 overall risk score
- `risk_category`: very-low / low / medium / high / critical
- `branch_comparison`: array of `{branch, probability, color}` bars
- `feature_contributions`: array of `{feature, shap_value, direction, color}` bars
- `risk_factors`: list of identified risk factor strings

### 8. SHAP Recommendations

`POST /recommendations`

Accepts the same `PatientInput` body. Returns SHAP-prioritized recommendations:

- Each recommendation has: `category`, `priority` (critical/high/medium/low),
  `title`, `rationale`, `actionable_steps[]`, `expected_impact`, `shap_contribution`
- Only features with **positive** SHAP values (increasing risk) generate recommendations
- One-hot features are cross-checked against encoded values to avoid model artefacts

### 9. Risk History

`GET /visuals/risk-history/{user_id}?limit=50`

Returns time-series of past predictions for trend charts. Reads from
Firestore (`users/{uid}/predictions/`). Returns an empty list if Firebase
is not configured — the rest of the API remains functional.

### 10. Admin overview

`GET /admin/overview`

Header:

```http
X-API-Key: dev-api-key
```

## Postman Testing

Use the Postman collection file included in this folder:

- `Digital_Twin_API.postman_collection.json`

For the broader endpoint design, including visualization and feedback
endpoints, see `API_DESIGN.md`.

Import it into Postman:

1. Open Postman.
2. Click `Import`.
3. Choose `File`.
4. Select `Backend/Digital_Twin_API.postman_collection.json`.
5. Confirm the import.

After import, update the `baseUrl` variable if needed. The default value is:

```text
http://127.0.0.1:8000
```

You can then run the prepared requests directly from the collection.

If you also need the data used for preprocessing and testing, download it from Google Drive:

- [Digital Twin Data](https://drive.google.com/file/d/1QR8p17qVFjmH8wwBHH9ndR_DZq3GJy5j/view?usp=sharing)

If you prefer to create requests manually, use these examples:

1. `GET http://127.0.0.1:8000/health`
2. `POST http://127.0.0.1:8000/predict/fusion`
3. `POST http://127.0.0.1:8000/predict/tabular`
4. `POST http://127.0.0.1:8000/predict/bilstm`
5. `POST http://127.0.0.1:8000/explain/xai`
6. `POST http://127.0.0.1:8000/visuals/risk-dashboard`
7. `POST http://127.0.0.1:8000/recommendations`
8. `GET http://127.0.0.1:8000/visuals/risk-history/demo-user-001`
9. `POST http://127.0.0.1:8000/auth/login`
10. `GET http://127.0.0.1:8000/admin/overview`

## Notes

- The backend loads the saved hybrid artifact from `Modellling/outputs/hybrid_digital_twin_model.joblib`
- The second branch has been migrated from BiLSTM to LightGBM for better performance and interpretability
- Risk history requires Firebase configuration (service account key or ADC). Without it, the endpoint returns an empty history gracefully.
- The frontend writes prediction history to Firestore after each prediction; the backend reads it for trend visualization.
- Large raw datasets are kept out of GitHub and stored separately in Google Drive
- Local XAI for the XGBoost branch falls back to feature-importance summaries if the encoded dataset is not available locally
- Full JWT and Spring Boot integration can be added later
