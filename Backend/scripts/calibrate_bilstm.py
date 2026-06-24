#!/usr/bin/env python3
"""Post-hoc isotonic calibration for the BiLSTM branch.

Problem
-------
After the label-inversion fix the BiLSTM direction is correct, but the model
is saturated: it outputs ~0.0001 for low-risk patients and ~0.99 for anything
with multiple risk factors, with almost no middle ground.  This makes the
fusion score jump abruptly and gives unrealistic risk estimates for
young/moderate patients.

Fix
---
Fit a sklearn ``IsotonicRegression`` calibrator on BiLSTM validation
probabilities.  The monotonic calibrator preserves the ranking (so genuinely
higher-risk patients still score higher) but compresses the saturated
extremes into a graded, calibrated range.

Pipeline
--------
1. Load encoded data and rebuild the same train/val/test splits used in
   training.
2. Build synthetic sequences (no StandardScaler, matching the retrained
   artifact).
3. Run the BiLSTM over the validation split to get raw probabilities.
4. Fit IsotonicRegression(raw_val_proba -> y_val).
5. Apply calibration on test probabilities and compute new metrics.
6. Re-tune the BiLSTM threshold via best-F1 on calibrated validation probs.
7. Retrain the fusion meta-learner on (xgboost_val, calibrated_bilstm_val).
8. Persist the calibrator + updated thresholds into the joblib artifact.

Usage
-----
    python Backend/scripts/calibrate_bilstm.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    balanced_accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT / "Backend"))

MODEL_PATH = PROJECT_ROOT / "Modellling" / "outputs" / "hybrid_digital_twin_model.joblib"
DATA_PATH = PROJECT_ROOT / "Data_preprocessing" / "output" / "healthcare_dataset_encoded.csv"
RANDOM_STATE = 42

np.random.seed(RANDOM_STATE)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def evaluate_predictions(y_true, y_proba, threshold: float = 0.5) -> dict:
    y_pred = (y_proba >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    specificity = tn / (tn + fp) if (tn + fp) else 0.0
    return {
        "accuracy": accuracy_score(y_true, y_pred),
        "balanced_accuracy": balanced_accuracy_score(y_true, y_pred),
        "precision": precision_score(y_true, y_pred, zero_division=0),
        "recall": recall_score(y_true, y_pred, zero_division=0),
        "specificity": specificity,
        "f1": f1_score(y_true, y_pred, zero_division=0),
        "roc_auc": roc_auc_score(y_true, y_proba),
        "pr_auc": average_precision_score(y_true, y_proba),
    }


def best_f1_threshold(y_true, y_proba):
    thresholds = np.linspace(0.05, 0.95, 91)
    scores = [f1_score(y_true, (y_proba >= t).astype(int), zero_division=0) for t in thresholds]
    best_idx = int(np.argmax(scores))
    return float(thresholds[best_idx]), float(scores[best_idx])


def build_synthetic_sequences(df_features, df_target, features, cont_cols, timesteps=12, seed=42):
    """Replicate the sequence builder from training (no StandardScaler)."""
    rng = np.random.default_rng(seed)
    X_np = df_features[features].to_numpy(dtype=np.float32)
    y_np = np.asarray(df_target, dtype=np.float32)

    n_samples, n_features = X_np.shape
    sequences = np.repeat(X_np[:, None, :], timesteps, axis=1).astype(np.float32)

    time = np.linspace(0.0, 1.0, timesteps, dtype=np.float32).reshape(1, timesteps)
    risk_factor = (1.0 + 0.35 * y_np).reshape(n_samples, 1)

    drift_map = {
        "bmi": 0.08, "blood_pressure_systolic": 0.10, "blood_pressure_diastolic": 0.06,
        "cholesterol": 0.08, "glucose": 0.08, "pulse_pressure": 0.05,
        "comorbidity_count": 0.06, "physical_activity": -0.04,
        "diet_quality": -0.04, "alcohol_consumption": 0.03,
    }

    for col, delta in drift_map.items():
        if col in features:
            col_idx = features.index(col)
            trend = (risk_factor * time)[:, :, None]
            sequences[:, :, col_idx] += delta * trend[:, :, 0]

    cont_idx = [features.index(c) for c in cont_cols if c in features]
    if cont_idx:
        noise = rng.normal(0, 0.01, size=(n_samples, timesteps, len(cont_idx))).astype(np.float32)
        sequences[:, :, cont_idx] += noise

    return sequences.astype(np.float32), y_np.astype(int)


# ---------------------------------------------------------------------------
# 1. Load artifact, data, rebuild splits
# ---------------------------------------------------------------------------
print("Loading model artifact …")
artifact = joblib.load(MODEL_PATH)
bilstm_model = artifact["bilstm_model"]
static_model = artifact["static_model"]
static_threshold = float(artifact["static_threshold"])
feature_cols = list(artifact["feature_columns"])
continuous_cols = list(artifact["continuous_columns"])

print("Loading encoded dataset …")
encoded_df = pd.read_csv(DATA_PATH)
target_col = "target_disease"
drop_cols = ["patient_id", "data_source", "collection_date", target_col]
feature_cols_chk = [c for c in encoded_df.columns if c not in drop_cols]
assert feature_cols_chk == feature_cols, "Feature column mismatch between data and artifact"

y_full = encoded_df[target_col].astype(int).copy()
idx = np.arange(len(encoded_df))
train_idx, temp_idx = train_test_split(idx, test_size=0.40, stratify=y_full, random_state=RANDOM_STATE)
val_idx, test_idx = train_test_split(temp_idx, test_size=0.50, stratify=y_full.iloc[temp_idx], random_state=RANDOM_STATE)

X_val = encoded_df[feature_cols].iloc[val_idx]
y_val = y_full.iloc[val_idx]
X_test = encoded_df[feature_cols].iloc[test_idx]
y_test = y_full.iloc[test_idx]

# ---------------------------------------------------------------------------
# 2. Raw BiLSTM probabilities on val & test
# ---------------------------------------------------------------------------
print("Building synthetic sequences for val & test splits …")
X_seq_val, y_seq_val = build_synthetic_sequences(X_val, y_val, feature_cols, continuous_cols, 12, RANDOM_STATE + 1)
X_seq_test, y_seq_test = build_synthetic_sequences(X_test, y_test, feature_cols, continuous_cols, 12, RANDOM_STATE + 2)

print("Running BiLSTM on val & test (this may take a minute) …")
raw_bilstm_val = bilstm_model.predict(X_seq_val, verbose=0).ravel()
raw_bilstm_test = bilstm_model.predict(X_seq_test, verbose=0).ravel()

print(f"\nRaw BiLSTM val prob range: [{raw_bilstm_val.min():.4f}, {raw_bilstm_val.max():.4f}]  mean={raw_bilstm_val.mean():.4f}")
print(f"Raw BiLSTM val: P(>0.9)={np.mean(raw_bilstm_val > 0.9):.3f}  P(<0.01)={np.mean(raw_bilstm_val < 0.01):.3f}")

# ---------------------------------------------------------------------------
# 3. Fit isotonic calibrator
# ---------------------------------------------------------------------------
print("\nFitting isotonic calibrator on validation set …")
calibrator = IsotonicRegression(out_of_bounds="clip")
calibrator.fit(raw_bilstm_val, y_seq_val)

cal_bilstm_val = calibrator.transform(raw_bilstm_val)
cal_bilstm_test = calibrator.transform(raw_bilstm_test)

print(f"Calibrated BiLSTM val range: [{cal_bilstm_val.min():.4f}, {cal_bilstm_val.max():.4f}]  mean={cal_bilstm_val.mean():.4f}")
print(f"Calibrated BiLSTM val: P(>0.9)={np.mean(cal_bilstm_val > 0.9):.3f}  P(<0.01)={np.mean(cal_bilstm_val < 0.01):.3f}")

# Show that calibration preserved ranking (Spearman should be ~1.0)
from scipy.stats import spearmanr
rho, _ = spearmanr(raw_bilstm_val, cal_bilstm_val)
print(f"Ranking preserved (Spearman): {rho:.4f}  (1.0 = perfect monotonic)")

# ---------------------------------------------------------------------------
# 4. Re-tune BiLSTM threshold on calibrated probs
# ---------------------------------------------------------------------------
cal_bilstm_thr, cal_bilstm_f1 = best_f1_threshold(y_seq_val, cal_bilstm_val)
print(f"\nCalibrated BiLSTM threshold: {cal_bilstm_thr:.4f}  val F1: {cal_bilstm_f1:.4f}")

raw_thr = float(artifact["bilstm_threshold"])
print("\nBiLSTM metrics BEFORE calibration (test):")
print(" ", evaluate_predictions(y_seq_test, raw_bilstm_test, raw_thr))
print("BiLSTM metrics AFTER calibration (test):")
print(" ", evaluate_predictions(y_seq_test, cal_bilstm_test, cal_bilstm_thr))

# ---------------------------------------------------------------------------
# 5. Retrain fusion meta-learner using calibrated BiLSTM
# ---------------------------------------------------------------------------
print("\nRetraining fusion meta-learner with calibrated BiLSTM …")
static_val_proba = static_model.predict_proba(X_val)[:, 1]
static_test_proba = static_model.predict_proba(X_test)[:, 1]

fusion_val_X = np.column_stack([static_val_proba, cal_bilstm_val])
fusion_test_X = np.column_stack([static_test_proba, cal_bilstm_test])

meta_learner = LogisticRegression(
    max_iter=2000, class_weight="balanced", solver="liblinear", random_state=RANDOM_STATE,
)
meta_learner.fit(fusion_val_X, y_val)

fusion_val_proba = meta_learner.predict_proba(fusion_val_X)[:, 1]
fusion_test_proba = meta_learner.predict_proba(fusion_test_X)[:, 1]
fusion_thr, fusion_f1 = best_f1_threshold(y_val, fusion_val_proba)

print(f"Fusion threshold: {fusion_thr:.4f}  val F1: {fusion_f1:.4f}")
print("Fusion test metrics:", evaluate_predictions(y_test, fusion_test_proba, fusion_thr))

# ---------------------------------------------------------------------------
# 6. Persist updated artifact
# ---------------------------------------------------------------------------
print("\nSaving calibrated artifact …")
artifact["bilstm_calibrator"] = calibrator
artifact["bilstm_threshold"] = cal_bilstm_thr
artifact["meta_learner"] = meta_learner
artifact["fusion_threshold"] = fusion_thr
joblib.dump(artifact, MODEL_PATH)
print(f"Saved: {MODEL_PATH}")

# ---------------------------------------------------------------------------
# 7. Sanity check
# ---------------------------------------------------------------------------
print("\n=== Sanity check with calibrated BiLSTM ===")
from app.schemas import PatientInput, Sex, SmokingStatus
svc = __import__("app.services", fromlist=["DigitalTwinService"]).DigitalTwinService()

cases = [
    ("Healthy 25yo",            PatientInput(age=25, sex=Sex.male, bmi=22, physical_activity=1, diet_quality=5, smoking_status=SmokingStatus.never, alcohol_consumption=0, medical_history_diabetes=0, medical_history_hypertension=0, medical_history_heart_disease=0, blood_pressure_systolic=110, blood_pressure_diastolic=70, cholesterol_level=0, glucose_level=0)),
    ("25yo smoker+HTN (your test case)", PatientInput(age=25, sex=Sex.male, bmi=28.4, physical_activity=1, diet_quality=3, smoking_status=SmokingStatus.current, alcohol_consumption=1, medical_history_diabetes=0, medical_history_hypertension=1, medical_history_heart_disease=0, blood_pressure_systolic=142, blood_pressure_diastolic=92, cholesterol_level=2, glucose_level=1)),
    ("45yo smoker+HTN",         PatientInput(age=45, sex=Sex.male, bmi=28.4, physical_activity=0, diet_quality=3, smoking_status=SmokingStatus.current, alcohol_consumption=1, medical_history_diabetes=0, medical_history_hypertension=1, medical_history_heart_disease=0, blood_pressure_systolic=142, blood_pressure_diastolic=92, cholesterol_level=2, glucose_level=1)),
    ("68yo 3 comorbidities",    PatientInput(age=68, sex=Sex.male, bmi=34.7, physical_activity=0, diet_quality=1, smoking_status=SmokingStatus.current, alcohol_consumption=1, medical_history_diabetes=1, medical_history_hypertension=1, medical_history_heart_disease=1, blood_pressure_systolic=170, blood_pressure_diastolic=100, cholesterol_level=3, glucose_level=3)),
]

print(f"\n{'Case':40s} {'XGB':>7s} {'BiLSTM':>7s} {'Fusion':>7s}")
print("-" * 68)
for name, patient in cases:
    r = svc.predict(patient, "fusion")
    print(f"{name:40s} {r.tabular_probability:7.4f} {r.bilstm_probability:7.4f} {r.fusion_probability:7.4f}")
