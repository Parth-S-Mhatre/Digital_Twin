# Digital Twin FastAPI Backend

FastAPI service for:

- health check
- XGBoost tabular prediction
- BiLSTM forecasting
- fusion/meta-learner prediction
- XAI explanations
- lightweight admin monitoring

## Run

From the project root:

```bash
cd Backend
uvicorn app.main:app --reload
```

Open:

- Swagger: `http://127.0.0.1:8000/docs`
- Health: `http://127.0.0.1:8000/health`

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

### 4. BiLSTM forecasting

`POST /predict/bilstm`

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
  "branch": "bilstm",
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

### 7. Admin overview

`GET /admin/overview`

Header:

```http
X-API-Key: dev-api-key
```

## Postman Testing

Import these requests manually or copy the examples into Postman:

1. `GET http://127.0.0.1:8000/health`
2. `POST http://127.0.0.1:8000/predict/fusion`
3. `POST http://127.0.0.1:8000/predict/tabular`
4. `POST http://127.0.0.1:8000/predict/bilstm`
5. `POST http://127.0.0.1:8000/explain/xai`
6. `POST http://127.0.0.1:8000/auth/login`
7. `GET http://127.0.0.1:8000/admin/overview`

## Notes

- The backend loads the saved hybrid artifact from `Modellling/outputs/hybrid_digital_twin_model.joblib`
- The BiLSTM branch uses a synthetic temporal proxy until real longitudinal data is available
- Large raw datasets are kept out of GitHub and stored separately in Google Drive
- Local XAI for the XGBoost branch falls back to feature-importance summaries if the encoded dataset is not available locally
- Full JWT and Spring Boot integration can be added later
