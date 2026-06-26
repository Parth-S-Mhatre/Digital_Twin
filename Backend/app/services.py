from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
try:
    import shap
except Exception:  # pragma: no cover - optional dependency
    shap = None


BASE_DIR = Path(__file__).resolve().parents[1]
MODEL_PATH = BASE_DIR / "models" / "hybrid_digital_twin_model.joblib"
DATA_PATH = BASE_DIR / "data" / "healthcare_dataset_encoded.csv"
FAIRNESS_SEX_PATH = BASE_DIR / "models" / "fairness_report_by_sex.csv"
FAIRNESS_SOURCE_PATH = BASE_DIR / "models" / "fairness_report_by_data_source.csv"


def _clip(value: float, low: float, high: float) -> float:
    return float(np.clip(value, low, high))


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _one_hot(mapping: dict[str, str], value: str) -> dict[str, int]:
    result = {k: 0 for k in mapping.values()}
    result[mapping.get(value, "")] = 1 if mapping.get(value, "") else 0
    return result


@dataclass
class PredictionBundle:
    tabular_probability: float
    bilstm_probability: float
    fusion_probability: float
    tabular_prediction: int
    bilstm_prediction: int
    fusion_prediction: int
    tabular_threshold: float
    bilstm_threshold: float
    fusion_threshold: float
    encoded_row: dict[str, float]
    derived_features: dict[str, Any]


class DigitalTwinService:
    def __init__(self) -> None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Model artifact not found: {MODEL_PATH}")

        artifact = joblib.load(MODEL_PATH)
        self.static_branch_name = artifact["static_branch_name"]
        self.static_model = artifact["static_model"]
        self.static_threshold = 0.3 # float(artifact["static_threshold"])
        # Second branch: LightGBM (replaces the BiLSTM).  Older artifacts may
        # still carry a BiLSTM; we support both for backward compatibility but
        # prefer LightGBM when present.
        if "lightgbm_model" in artifact:
            self.second_branch_name = "lightgbm"
            self.second_branch_model = artifact["lightgbm_model"]
            self.second_branch_threshold = 0.3 # float(artifact["lightgbm_threshold"])
        else:  # legacy BiLSTM artifact
            self.second_branch_name = "bilstm"
            self.second_branch_model = artifact["bilstm_model"]
            self.second_branch_threshold = 0.3 # float(artifact["bilstm_threshold"])
        # Public attributes kept under the bilstm_* names for backward
        # compatibility with the API response schema and existing callers.
        self.bilstm_threshold = self.second_branch_threshold
        self.meta_learner = artifact["meta_learner"]
        self.fusion_threshold = 0.3 # float(artifact["fusion_threshold"])
        self.feature_columns = list(artifact["feature_columns"])
        self.continuous_columns = list(artifact["continuous_columns"])
        self.random_state = int(artifact.get("random_state", 42))
        self.feature_count = len(self.feature_columns)

        # Preprocessing StandardScaler parameters (z-score standardisation
        # applied during data preprocessing).  Used to transform raw patient
        # values into the same distribution the models were trained on.
        self.scaler_params = artifact.get("preprocessing_scaler_params", {})

        # Legacy: post-hoc isotonic calibrator for the BiLSTM branch.
        # Only used when the second branch is the old BiLSTM.
        self.bilstm_calibrator = artifact.get("bilstm_calibrator")

        self._background = None
        self._shap_explainer = None
        self._background_loaded = False

        self._load_supporting_reports()

    def _load_supporting_reports(self) -> None:
        self.fairness_by_sex = self._load_csv_if_exists(FAIRNESS_SEX_PATH)
        self.fairness_by_source = self._load_csv_if_exists(FAIRNESS_SOURCE_PATH)

    @staticmethod
    def _load_csv_if_exists(path: Path) -> pd.DataFrame | None:
        if path.exists():
            return pd.read_csv(path)
        return None

    def health_payload(self) -> dict[str, str]:
        return {
            "status": "ok",
            "service": "digital-twin-fastapi",
            "version": "1.0.0",
        }

    def model_info(self) -> dict[str, Any]:
        return {
            "model_name": "hybrid_digital_twin_model",
            "static_branch_name": self.static_branch_name,
            "second_branch_name": self.second_branch_name,
            "feature_count": self.feature_count,
            "static_threshold": self.static_threshold,
            "bilstm_threshold": self.bilstm_threshold,
            "fusion_threshold": self.fusion_threshold,
            "feature_columns": self.feature_columns,
        }

    def _derive_categories(self, patient) -> dict[str, Any]:
        age = _safe_float(patient.age)
        bmi = _safe_float(patient.bmi)
        sbp = _safe_float(patient.blood_pressure_systolic)
        dbp = _safe_float(patient.blood_pressure_diastolic)

        if age < 31:
            age_group = "18-30"
        elif age < 46:
            age_group = "31-45"
        elif age < 61:
            age_group = "46-60"
        elif age < 76:
            age_group = "61-75"
        else:
            age_group = "75+"

        if bmi < 18.5:
            bmi_category = "Underweight"
        elif bmi < 25:
            bmi_category = "Normal"
        elif bmi < 30:
            bmi_category = "Overweight"
        else:
            bmi_category = "Obese"

        if sbp >= 140 or dbp >= 90:
            bp_status = "Stage2_HTN"
        elif sbp >= 130 or dbp >= 80:
            bp_status = "Stage1_HTN"
        elif sbp >= 120 and dbp < 80:
            bp_status = "Elevated"
        else:
            bp_status = "Normal"

        smoking = patient.smoking_status.value

        return {
            "age_group": age_group,
            "bmi_category": bmi_category,
            "bp_status": bp_status,
            "smoking_status": smoking,
            "pulse_pressure": sbp - dbp,
            "comorbidity_count": int(
                _safe_int(patient.medical_history_diabetes)
                + _safe_int(patient.medical_history_hypertension)
                + _safe_int(patient.medical_history_heart_disease)
            ),
        }

    def _zscore(self, feature_name: str, value: float) -> float:
        """Apply z-score standardisation using preprocessing scaler params.

        Falls back to returning the raw value when scaler params are missing
        (e.g. a freshly retrained artifact that does not yet include them).
        """
        params = self.scaler_params.get(feature_name)
        if params is None:
            return float(value)
        return (value - params["mean"]) / max(params["std"], 1e-8)

    def encode_patient(self, patient) -> dict[str, float]:
        derived = self._derive_categories(patient)
        encoded = {feature: 0.0 for feature in self.feature_columns}

        age = _safe_float(patient.age)
        bmi = _safe_float(patient.bmi)
        sbp = _safe_float(patient.blood_pressure_systolic)
        dbp = _safe_float(patient.blood_pressure_diastolic)
        cholesterol = _safe_float(patient.cholesterol_level)
        glucose = _safe_float(patient.glucose_level)

        encoded.update(
            {
                "age": self._zscore("age", age),
                "bmi": self._zscore("bmi", bmi),
                "physical_activity": _safe_int(patient.physical_activity),
                "diet_quality": _safe_float(patient.diet_quality),
                "alcohol_consumption": _safe_int(patient.alcohol_consumption),
                "medical_history_diabetes": _safe_int(patient.medical_history_diabetes),
                "medical_history_hypertension": _safe_int(patient.medical_history_hypertension),
                "medical_history_heart_disease": _safe_int(patient.medical_history_heart_disease),
                "blood_pressure_systolic": self._zscore("blood_pressure_systolic", sbp),
                "blood_pressure_diastolic": self._zscore("blood_pressure_diastolic", dbp),
                "cholesterol": self._zscore("cholesterol", cholesterol),
                "glucose": self._zscore("glucose", glucose),
                "pulse_pressure": self._zscore("pulse_pressure", derived["pulse_pressure"]),
                "comorbidity_count": _clip(float(derived["comorbidity_count"]), 0.0, 3.0),
            }
        )

        sex_key = f"sex_{patient.sex.value}"
        if sex_key in encoded:
            encoded[sex_key] = 1.0

        smoking_map = {
            "Current": "smoking_status_Current",
            "Never": "smoking_status_Never",
            "Former": "",
            "Unknown": "",
        }
        smoking_key = smoking_map.get(derived["smoking_status"], "")
        if smoking_key and smoking_key in encoded:
            encoded[smoking_key] = 1.0

        bmi_key = f"bmi_category_{derived['bmi_category']}"
        if bmi_key in encoded:
            encoded[bmi_key] = 1.0

        bp_key = f"bp_status_{derived['bp_status']}"
        if bp_key in encoded:
            encoded[bp_key] = 1.0

        age_key = f"age_group_{derived['age_group']}"
        if age_key in encoded:
            encoded[age_key] = 1.0

        return encoded

    def _to_dataframe(self, encoded_row: dict[str, float]) -> pd.DataFrame:
        return pd.DataFrame([{col: encoded_row.get(col, 0.0) for col in self.feature_columns}])

    def _predict_tabular(self, encoded_row: dict[str, float]) -> tuple[float, float]:
        df = self._to_dataframe(encoded_row)
        proba = float(self.static_model.predict_proba(df)[0, 1])
        return proba, self.static_threshold

    def _predict_second_branch(self, encoded_row: dict[str, float]) -> tuple[float, float]:
        """Run the second branch model (LightGBM or legacy BiLSTM)."""
        if self.second_branch_name == "lightgbm":
            # LightGBM: plain tabular predict_proba, no synthetic sequences.
            df = self._to_dataframe(encoded_row)
            proba = float(self.second_branch_model.predict_proba(df)[0, 1])
            return proba, self.second_branch_threshold

        # Legacy BiLSTM artifact path – not supported after the LightGBM
        # migration.  Raise a clear error if an old artifact is loaded.
        raise RuntimeError(
            "Legacy BiLSTM branch is no longer supported.  "
            "Please retrain the model with "
            "scripts/retrain_lightgbm_branch.py to generate a new artifact."
        )

    def _predict_bilstm(self, encoded_row: dict[str, float]) -> tuple[float, float]:
        """Alias kept for backward compatibility with internal callers."""
        return self._predict_second_branch(encoded_row)

    def _predict_fusion(self, encoded_row: dict[str, float]) -> tuple[float, float, float, float, float]:
        tabular_proba, tabular_thr = self._predict_tabular(encoded_row)
        second_proba, second_thr = self._predict_second_branch(encoded_row)

        fusion_input = np.array([[tabular_proba, second_proba]], dtype=np.float32)
        fusion_proba = float(self.meta_learner.predict_proba(fusion_input)[0, 1])
        return (
            tabular_proba,
            second_proba,
            fusion_proba,
            tabular_thr,
            second_thr,
        )

    @staticmethod
    def _classify(probability: float, threshold: float) -> tuple[int, str, float]:
        prediction = int(probability >= threshold)
        confidence = probability if prediction == 1 else 1.0 - probability
        label = "High risk" if prediction == 1 else "Lower risk"
        return prediction, label, float(confidence)

    def predict(self, patient, branch: str) -> PredictionBundle:
        encoded_row = self.encode_patient(patient)
        derived = self._derive_categories(patient)

        tabular_proba, tabular_thr = self._predict_tabular(encoded_row)
        bilstm_proba, bilstm_thr = self._predict_bilstm(encoded_row)
        fusion_proba, fusion_thr = float("nan"), self.fusion_threshold

        if branch == "xgboost":
            # Use continuous probability instead of hard threshold
            risk_score = float(tabular_proba)
            prediction = int(risk_score >= tabular_thr)
            return PredictionBundle(
                tabular_probability=tabular_proba,
                bilstm_probability=bilstm_proba,
                fusion_probability=float("nan"),
                tabular_prediction=prediction,
                bilstm_prediction=int(bilstm_proba >= bilstm_thr),
                fusion_prediction=prediction,
                tabular_threshold=tabular_thr,
                bilstm_threshold=bilstm_thr,
                fusion_threshold=self.fusion_threshold,
                encoded_row=encoded_row,
                derived_features=derived,
            )

        if branch == "bilstm":
            risk_score = float(bilstm_proba)
            prediction = int(risk_score >= bilstm_thr)
            return PredictionBundle(
                tabular_probability=tabular_proba,
                bilstm_probability=bilstm_proba,
                fusion_probability=float("nan"),
                tabular_prediction=int(tabular_proba >= tabular_thr),
                bilstm_prediction=prediction,
                fusion_prediction=prediction,
                tabular_threshold=tabular_thr,
                bilstm_threshold=bilstm_thr,
                fusion_threshold=self.fusion_threshold,
                encoded_row=encoded_row,
                derived_features=derived,
            )

        fusion_input = np.array([[tabular_proba, bilstm_proba]], dtype=np.float32)
        # Quick fix: Use average of xgboost and lightgbm probabilities instead of incompatible meta-learner
        fusion_proba = float((tabular_proba + bilstm_proba) / 2)
        fusion_pred = int(fusion_proba >= fusion_thr)

        return PredictionBundle(
            tabular_probability=tabular_proba,
            bilstm_probability=bilstm_proba,
            fusion_probability=fusion_proba,
            tabular_prediction=int(tabular_proba >= tabular_thr),
            bilstm_prediction=int(bilstm_proba >= bilstm_thr),
            fusion_prediction=fusion_pred,
            tabular_threshold=tabular_thr,
            bilstm_threshold=bilstm_thr,
            fusion_threshold=self.fusion_threshold,
            encoded_row=encoded_row,
            derived_features=derived,
        )

    def explain_global(self, branch: str) -> dict[str, Any]:
        if branch == "xgboost":
            if hasattr(self.static_model, "feature_importances_"):
                importances = self.static_model.feature_importances_
            else:
                importances = np.zeros(len(self.feature_columns))

            top = sorted(
                [
                    {"feature": f, "importance": float(v)}
                    for f, v in zip(self.feature_columns, importances)
                ],
                key=lambda x: x["importance"],
                reverse=True,
            )[:15]
            return {"top_features": top}

        if branch == "fusion":
            coefs = self.meta_learner.coef_.ravel().tolist()
            summary = [
                {
                    "feature": f"{self.static_branch_name}_probability",
                    "coefficient": float(coefs[0]),
                    "odds_ratio": float(np.exp(coefs[0])),
                },
                {
                    "feature": f"{self.second_branch_name}_probability",
                    "coefficient": float(coefs[1]),
                    "odds_ratio": float(np.exp(coefs[1])),
                },
            ]
            return {"coefficients": summary}

        if branch == "bilstm":
            # LightGBM feature importances (gain-based by default).
            if hasattr(self.second_branch_model, "feature_importances_"):
                importances = self.second_branch_model.feature_importances_
            else:
                importances = np.zeros(len(self.feature_columns))

            top = sorted(
                [
                    {"feature": f, "importance": float(v)}
                    for f, v in zip(self.feature_columns, importances)
                ],
                key=lambda x: x["importance"],
                reverse=True,
            )[:15]
            return {"top_features": top}

        return {"message": "Unsupported branch"}

    def explain_local(self, patient, branch: str) -> dict[str, Any]:
        encoded_row = self.encode_patient(patient)
        df = self._to_dataframe(encoded_row)

        if branch == "xgboost":
            if shap is None:
                top = self.explain_global("xgboost")["top_features"]
                return {"method": "feature_importance_fallback", "top_features": top}

            if not DATA_PATH.exists():
                top = self.explain_global("xgboost")["top_features"]
                return {
                    "method": "feature_importance_fallback",
                    "reason": "encoded dataset not available locally",
                    "top_features": top,
                }

            if not self._background_loaded:
                dataset = pd.read_csv(DATA_PATH, usecols=self.feature_columns)
                data = dataset.sample(
                    n=min(500, len(dataset)),
                    random_state=self.random_state,
                )
                self._background = data
                self._shap_explainer = shap.TreeExplainer(self.static_model)
                self._background_loaded = True

            shap_values = self._shap_explainer.shap_values(df)
            if isinstance(shap_values, list):
                shap_values = shap_values[1]

            values = shap_values[0]
            contributions = sorted(
                [
                    {"feature": f, "shap_value": float(v), "abs_shap": float(abs(v))}
                    for f, v in zip(self.feature_columns, values)
                ],
                key=lambda x: x["abs_shap"],
                reverse=True,
            )[:15]

            return {"method": "shap", "top_contributions": contributions}

        if branch == "bilstm":
            if shap is None:
                top = self.explain_global("bilstm")["top_features"]
                return {"method": "feature_importance_fallback", "top_features": top}

            if not DATA_PATH.exists():
                top = self.explain_global("bilstm")["top_features"]
                return {
                    "method": "feature_importance_fallback",
                    "reason": "encoded dataset not available locally",
                    "top_features": top,
                }

            # Use a dedicated TreeExplainer for the second branch (LightGBM).
            if not self._background_loaded:
                dataset = pd.read_csv(DATA_PATH, usecols=self.feature_columns)
                data = dataset.sample(
                    n=min(500, len(dataset)),
                    random_state=self.random_state,
                )
                self._background = data
                self._background_loaded = True

            explainer = shap.TreeExplainer(self.second_branch_model)
            shap_values = explainer.shap_values(df)
            if isinstance(shap_values, list):
                shap_values = shap_values[1]

            values = shap_values[0]
            contributions = sorted(
                [
                    {"feature": f, "shap_value": float(v), "abs_shap": float(abs(v))}
                    for f, v in zip(self.feature_columns, values)
                ],
                key=lambda x: x["abs_shap"],
                reverse=True,
            )[:15]

            return {"method": "shap", "top_contributions": contributions}

        if branch == "fusion":
            base = self.predict(patient, "fusion")
            return {
                "method": "meta_learner_coefficients",
                "static_probability": base.tabular_probability,
                "temporal_probability": base.bilstm_probability,
                "fusion_probability": base.fusion_probability,
                "threshold": base.fusion_threshold,
            }

        return {"message": "Unsupported branch"}

    def admin_overview(self) -> dict[str, Any]:
        payload = {
            "model_info": self.model_info(),
            "fairness_by_sex": self.fairness_by_sex.to_dict(orient="records")
            if self.fairness_by_sex is not None
            else [],
            "fairness_by_source": self.fairness_by_source.to_dict(orient="records")
            if self.fairness_by_source is not None
            else [],
        }
        return payload


service = DigitalTwinService()
