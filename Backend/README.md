---
title: Digital Twin API
emoji: 🏥
colorFrom: blue
colorTo: green
sdk: docker
pinned: false
---

# Digital Twin API

FastAPI backend for the hybrid digital twin health risk prediction system.

## Endpoints

- `GET /health` — health check
- `GET /docs` — interactive API docs (Swagger UI)
- `POST /predict` — run a prediction (xgboost / bilstm / fusion)
- `POST /predict/tabular` — XGBoost branch
- `POST /predict/bilstm` — LightGBM branch
- `POST /predict/fusion` — Fusion meta-learner
- `POST /explain/xai` — SHAP explanations
- `POST /visuals/risk-dashboard` — chart-ready dashboard data
- `POST /recommendations` — actionable health recommendations
