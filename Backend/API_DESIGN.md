# API Design Proposal

This document groups the backend into four layers so Postman can cover the full
project story: prediction, visualization, user reaction, and analysis.

## 1. Prediction

These endpoints serve the core model outputs.

- `GET /health`
- `GET /model-info`
- `POST /predict`
- `POST /predict/tabular`
- `POST /predict/bilstm` (LightGBM second branch — URL preserved for backward compat)
- `POST /predict/fusion`

Recommended Postman folders:
- `Core`
- `Tabular`
- `Second Branch`
- `Fusion`

## 2. Explainability and Analysis

These endpoints help understand why the model produced a score.

- `POST /explain/xai`
- `GET /explain/xai/info`
- `GET /predict/tabular/info`
- `GET /predict/bilstm/info`
- `GET /predict/fusion/info`
- `GET /admin/overview`

Recommended additions for later:
- `GET /analytics/calibration`
- `GET /analytics/fairness`
- `GET /analytics/branch-disagreement`
- `GET /analytics/feature-importance`

These would let the frontend and Postman inspect confidence, fairness, and
branch disagreement without reading raw model internals.

## 3. Visualization & Recommendations

### Implemented Endpoints

- `POST /visuals/risk-dashboard` — chart-ready risk dashboard payload
  - Returns: `{risk_score, risk_category, risk_probability, branch_comparison[], feature_contributions[], risk_factors[]}`
  - Frontend renders the structured data as bar charts, gauges, etc.

- `POST /recommendations` — SHAP-driven actionable health recommendations
  - Returns: `{recommendations[], total_risk_factors, top_risk_driver, risk_probability}`
  - Each recommendation: `{category, priority, title, rationale, actionable_steps[], expected_impact, shap_contribution, feature_name}`
  - Only positive SHAP features generate recommendations (risk-increasing only)
  - One-hot features cross-checked against encoded values to prevent model artefacts

- `GET /visuals/risk-history/{user_id}?limit=50` — time-series for trend charts
  - Returns: `{user_id, predictions[], trend, earliest_date, latest_date}`
  - Reads from Firestore (`users/{uid}/predictions/`)
  - Frontend writes to Firestore after each prediction; backend reads for display

- `GET /visuals/info` — describes visualization endpoints

### Future Additions

- `GET /visuals/branch-comparison/{prediction_id}`
- `GET /visuals/organ-status/{prediction_id}`

Recommended response shape:
- `labels`: array of chart labels
- `series`: array of numeric values
- `metadata`: branch name, timestamp, and confidence

## 4. Reaction and Feedback

This layer collects user feedback about whether a prediction was useful.

Suggested endpoints:
- `POST /feedback`
- `GET /feedback/{prediction_id}`
- `PATCH /feedback/{prediction_id}`

Recommended fields:
- `prediction_id`
- `user_id`
- `reaction`: `helpful`, `not_helpful`, `unclear`
- `comment`
- `confirmed_outcome`

This gives you a path to close the loop later and use real-world feedback for
retraining and monitoring.

## 5. Postman Collection Structure

Suggested folders:
- `00. Model Guides`
- `01. Health and Access`
- `02. Integrated Dataset Predictions`
- `03. Explainability`
- `04. Visualization & Recommendations`
- `Admin`

Suggested environment variables:
- `baseUrl`
- `apiKey`
- `userId`
- `predictionId`

## 6. Model Quality Notes

Current findings from the hybrid stack:

- Tabular XGBoost behaves reasonably on both healthy and high-risk samples.
- The second branch has been migrated from BiLSTM to LightGBM, resolving the
  previous overconfidence issue.
- Fusion now combines two gradient-boosted tree models (XGBoost + LightGBM),
  producing well-calibrated combined risk scores.
- SHAP explainability works consistently for both branches via TreeExplainer.
- Recommendations are filtered to only positive SHAP contributions, preventing
  healthy patients from receiving inappropriate "critical" recommendations.
