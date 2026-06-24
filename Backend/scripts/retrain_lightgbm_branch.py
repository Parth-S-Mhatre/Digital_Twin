#!/usr/bin/env python3
"""Replace the BiLSTM branch with a leakage-free LightGBM branch.

Background
----------
The previous "temporal branch" was a BiLSTM trained on *synthetic* sequences
generated from cross-sectional data.  The sequence generator used the true
disease label to shape the drift (``risk_factor = 1 + 0.35 * y``), which is
target leakage: the model memorized the label instead of learning clinical
patterns.  Symptoms: AUC 0.9993 (impossibly perfect), saturated outputs
(~0 or ~1 with no middle ground), and a fusion score that snapped abruptly.

The data is cross-sectional tabular — there are no real longitudinal
sequences.  The principled fix is to drop the recurrent model and use a
second gradient-boosting model (LightGBM) that differs from XGBoost in
algorithm family (leaf-wise growth, GOSS/EFB histograms).  This gives the
fusion layer two genuinely diverse, well-calibrated tabular views.

What this script produces
-------------------------
- ``lightgbm_model``     : trained LightGBM classifier
- ``lightgbm_threshold`` : best-F1 threshold on validation
- ``meta_learner``       : LogisticRegression trained on
                           [xgb_proba, lgbm_proba]
- ``fusion_threshold``   : best-F1 threshold on validation
- The full artifact is saved to
  ``Modellling/outputs/hybrid_digital_twin_model.joblib``

Usage
-----
    python Backend/scripts/retrain_lightgbm_branch.py
"""

from __future__ import annotations

import random
import sys
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    ConfusionMatrixDisplay,
    PrecisionRecallDisplay,
    RocCurveDisplay,
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
from sklearn.preprocessing import StandardScaler
from sklearn.utils.class_weight import compute_class_weight
from xgboost import XGBClassifier

warnings.filterwarnings("ignore")

# LightGBM is the new second branch
import lightgbm as lgb  # noqa: E402

# matplotlib kept non-interactive so the script runs headless
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "Data_preprocessing" / "output"
DATA_DIR_RAW = PROJECT_ROOT / "Data"
OUTPUT_DIR = PROJECT_ROOT / "Modellling" / "outputs"
PLOT_DIR = OUTPUT_DIR / "plots_lightgbm"
PLOT_DIR.mkdir(parents=True, exist_ok=True)
RANDOM_STATE = 42

np.random.seed(RANDOM_STATE)
random.seed(RANDOM_STATE)


# ---------------------------------------------------------------------------
# Helpers (match the notebook)
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


def save_eval_plots(y_true, y_proba, threshold, name, pred):
    fig, axes = plt.subplots(1, 3, figsize=(22, 6))
    ConfusionMatrixDisplay.from_predictions(y_true, pred, ax=axes[0], cmap="Blues", colorbar=False)
    axes[0].set_title(f"{name} - Confusion Matrix")
    RocCurveDisplay.from_predictions(y_true, y_proba, ax=axes[1], name=name)
    axes[1].plot([0, 1], [0, 1], "--", color="gray", linewidth=1)
    axes[1].set_title("ROC Curve")
    PrecisionRecallDisplay.from_predictions(y_true, y_proba, ax=axes[2], name=name)
    axes[2].set_title("Precision-Recall Curve")
    plt.tight_layout()
    fig.savefig(PLOT_DIR / f"{name.lower().replace(' ', '_')}.png", dpi=100)
    plt.close(fig)


# ---------------------------------------------------------------------------
# 1. Load data & split (identical to notebook for reproducibility)
# ---------------------------------------------------------------------------
print("=" * 70)
print("REPLACE BiLSTM WITH LightGBM — leakage-free second branch")
print("=" * 70)

print("\n[1/6] Loading encoded dataset …")
encoded_df = pd.read_csv(DATA_DIR / "healthcare_dataset_encoded.csv")

target_col = "target_disease"
drop_cols = ["patient_id", "data_source", "collection_date", target_col]
feature_cols = [c for c in encoded_df.columns if c not in drop_cols]

X_full = encoded_df[feature_cols].copy()
y_full = encoded_df[target_col].astype(int).copy()

# Same stratified splits as the notebook
idx = np.arange(len(encoded_df))
train_idx, temp_idx = train_test_split(idx, test_size=0.40, stratify=y_full, random_state=RANDOM_STATE)
val_idx, test_idx = train_test_split(temp_idx, test_size=0.50, stratify=y_full.iloc[temp_idx], random_state=RANDOM_STATE)

X_train, y_train = X_full.iloc[train_idx], y_full.iloc[train_idx]
X_val, y_val = X_full.iloc[val_idx], y_full.iloc[val_idx]
X_test, y_test = X_full.iloc[test_idx], y_full.iloc[test_idx]

continuous_cols = [
    "age", "bmi", "physical_activity", "diet_quality", "alcohol_consumption",
    "medical_history_diabetes", "medical_history_hypertension",
    "medical_history_heart_disease", "blood_pressure_systolic",
    "blood_pressure_diastolic", "cholesterol", "glucose", "pulse_pressure",
    "comorbidity_count",
]
continuous_cols = [c for c in continuous_cols if c in feature_cols]

print(f"  Train: {X_train.shape}  Val: {X_val.shape}  Test: {X_test.shape}")
print(f"  Target base rate: {y_full.mean():.4f}  (n_features = {len(feature_cols)})")


# ---------------------------------------------------------------------------
# 2. Branch 1: XGBoost + tabular ensemble (identical to notebook)
# ---------------------------------------------------------------------------
print("\n[2/6] Training Branch 1 (XGBoost + ensemble) …")

neg, pos = np.bincount(y_train)
scale_pos_weight = neg / max(pos, 1)

xgb_model = XGBClassifier(
    n_estimators=500, learning_rate=0.03, max_depth=5,
    subsample=0.85, colsample_bytree=0.85, reg_lambda=1.0,
    min_child_weight=1, scale_pos_weight=scale_pos_weight,
    eval_metric="logloss", tree_method="hist",
    random_state=RANDOM_STATE, n_jobs=-1,
)
rf_model = RandomForestClassifier(
    n_estimators=300, min_samples_split=4, min_samples_leaf=2,
    class_weight="balanced_subsample", random_state=RANDOM_STATE, n_jobs=-1,
)
lr_model = LogisticRegression(
    max_iter=3000, class_weight="balanced", solver="liblinear", random_state=RANDOM_STATE,
)

tabular_ensemble = VotingClassifier(
    estimators=[("xgb", xgb_model), ("rf", rf_model), ("lr", lr_model)],
    voting="soft", weights=[3, 2, 1], n_jobs=-1,
)

xgb_model.fit(X_train, y_train)
tabular_ensemble.fit(X_train, y_train)

xgb_val_proba = xgb_model.predict_proba(X_val)[:, 1]
ens_val_proba = tabular_ensemble.predict_proba(X_val)[:, 1]

xgb_thr, _ = best_f1_threshold(y_val, xgb_val_proba)
ens_thr, _ = best_f1_threshold(y_val, ens_val_proba)

tabular_results = pd.DataFrame([
    {"model": "XGBoost", "threshold": xgb_thr, **evaluate_predictions(y_val, xgb_val_proba, xgb_thr)},
    {"model": "Tabular Ensemble", "threshold": ens_thr, **evaluate_predictions(y_val, ens_val_proba, ens_thr)},
]).sort_values("roc_auc", ascending=False).reset_index(drop=True)

best_static_name = tabular_results.loc[0, "model"]
static_threshold = float(tabular_results.loc[0, "threshold"])
static_model = xgb_model if best_static_name == "XGBoost" else tabular_ensemble
static_val_proba = xgb_val_proba if best_static_name == "XGBoost" else ens_val_proba
static_test_proba = static_model.predict_proba(X_test)[:, 1]

print(f"  Best static branch: {best_static_name}  (threshold={static_threshold:.4f})")
print(tabular_results[["model", "roc_auc", "pr_auc", "f1", "threshold"]].to_string(index=False))


# ---------------------------------------------------------------------------
# 3. Branch 2 (NEW): LightGBM
# ---------------------------------------------------------------------------
print("\n[3/6] Training Branch 2 (LightGBM) — replaces BiLSTM …")

# Use class weighting for imbalance; slightly different hyperparameters from
# the XGBoost branch to encourage diversity (leaf-wise growth, lower lr).
lgb_model = lgb.LGBMClassifier(
    n_estimators=500,
    learning_rate=0.03,
    num_leaves=31,
    max_depth=-1,
    min_child_samples=30,
    subsample=0.85,
    subsample_freq=1,
    colsample_bytree=0.70,
    reg_lambda=1.0,
    class_weight="balanced",
    objective="binary",
    random_state=RANDOM_STATE,
    n_jobs=-1,
    verbose=-1,
)

lgb_model.fit(
    X_train, y_train,
    eval_set=[(X_val, y_val)],
    callbacks=[
        lgb.early_stopping(stopping_rounds=30, verbose=False),
        lgb.log_evaluation(period=0),
    ],
)

lgb_val_proba = lgb_model.predict_proba(X_val)[:, 1]
lgb_test_proba = lgb_model.predict_proba(X_test)[:, 1]

lgb_thr, lgb_best_f1 = best_f1_threshold(y_val, lgb_val_proba)
lgb_test_pred = (lgb_test_proba >= lgb_thr).astype(int)

lgb_val_metrics = evaluate_predictions(y_val, lgb_val_proba, lgb_thr)
lgb_test_metrics = evaluate_predictions(y_test, lgb_test_proba, lgb_thr)

print(f"  LightGBM threshold: {lgb_thr:.4f}  best_val_f1: {lgb_best_f1:.4f}")
print("  LightGBM test metrics:")
for k, v in lgb_test_metrics.items():
    print(f"    {k:20s}: {v:.4f}")

save_eval_plots(np.asarray(y_test), lgb_test_proba, lgb_thr, "LightGBM", lgb_test_pred)

# Branch-level diversity check (we want genuine disagreement, not clones)
branch_corr = float(np.corrcoef(static_val_proba, lgb_val_proba)[0, 1])
print(f"\n  Branch correlation (XGB vs LightGBM) on val: {branch_corr:.4f}")
print("  (lower = more diverse = better fusion; 0.7-0.95 is typical for tabular)")

# Show that LightGBM produces GRADED probabilities (the key fix)
print("\n  LightGBM val probability distribution:")
print(f"    P(<0.1)={np.mean(lgb_val_proba<0.1):.3f}  "
      f"P(0.1-0.5)={np.mean((lgb_val_proba>=0.1)&(lgb_val_proba<0.5)):.3f}  "
      f"P(0.5-0.9)={np.mean((lgb_val_proba>=0.5)&(lgb_val_proba<0.9)):.3f}  "
      f"P(>=0.9)={np.mean(lgb_val_proba>=0.9):.3f}")


# ---------------------------------------------------------------------------
# 4. Fusion meta-learner on [xgb_proba, lgb_proba]
# ---------------------------------------------------------------------------
print("\n[4/6] Training fusion meta-learner …")

fusion_val_X = np.column_stack([static_val_proba, lgb_val_proba])
fusion_test_X = np.column_stack([static_test_proba, lgb_test_proba])

meta_learner = LogisticRegression(
    max_iter=2000, class_weight="balanced", solver="liblinear", random_state=RANDOM_STATE,
)
meta_learner.fit(fusion_val_X, y_val)

fusion_val_proba = meta_learner.predict_proba(fusion_val_X)[:, 1]
fusion_test_proba = meta_learner.predict_proba(fusion_test_X)[:, 1]

fusion_thr, fusion_best_f1 = best_f1_threshold(y_val, fusion_val_proba)
fusion_test_pred = (fusion_test_proba >= fusion_thr).astype(int)
fusion_test_metrics = evaluate_predictions(y_test, fusion_test_proba, fusion_thr)

print(f"  Fusion threshold: {fusion_thr:.4f}  best_val_f1: {fusion_best_f1:.4f}")
print("  Fusion test metrics:")
for k, v in fusion_test_metrics.items():
    print(f"    {k:20s}: {v:.4f}")

save_eval_plots(np.asarray(y_test), fusion_test_proba, fusion_thr, "Fusion", fusion_test_pred)

# Compare all three branches side by side
print("\n  Branch comparison (test set):")
compare = pd.DataFrame([
    {"branch": best_static_name, **evaluate_predictions(y_test, static_test_proba, static_threshold)},
    {"branch": "LightGBM", **lgb_test_metrics},
    {"branch": "Fusion", **fusion_test_metrics},
])[["branch", "roc_auc", "pr_auc", "f1", "recall", "specificity", "balanced_accuracy"]]
print(compare.to_string(index=False))


# ---------------------------------------------------------------------------
# 5. Replicate preprocessing StandardScaler params (for inference)
# ---------------------------------------------------------------------------
print("\n[5/6] Computing preprocessing scaler params …")

heart_raw = pd.read_csv(DATA_DIR_RAW / "heart_disease_health_indicators_BRFSS2015.csv")
cardio_raw = pd.read_csv(DATA_DIR_RAW / "cardio_train.csv", sep=";")
diabetes_raw = pd.read_csv(DATA_DIR_RAW / "diabetes_012_health_indicators_BRFSS2015.csv")

heart_std = pd.DataFrame()
heart_std["age"] = (heart_raw["Age"] * 5).astype(int)
heart_std["bmi"] = heart_raw["BMI"].astype(float)
heart_std["blood_pressure_systolic"] = np.nan
heart_std["blood_pressure_diastolic"] = np.nan
heart_std["cholesterol"] = np.nan
heart_std["glucose"] = np.nan
heart_std["data_source"] = "Heart_Indicators"

cardio_std = pd.DataFrame()
cardio_std["age"] = (cardio_raw["age"] / 365).astype(int)
cardio_std["bmi"] = np.nan
cardio_std["blood_pressure_systolic"] = cardio_raw["ap_hi"].astype(float)
cardio_std["blood_pressure_diastolic"] = cardio_raw["ap_lo"].astype(float)
cardio_std["cholesterol"] = cardio_raw["cholesterol"].astype(float)
cardio_std["glucose"] = cardio_raw["gluc"].astype(float)
cardio_std["data_source"] = "Cardiovascular"

diabetes_std = pd.DataFrame()
diabetes_std["age"] = (diabetes_raw["Age"] * 5).astype(int)
diabetes_std["bmi"] = diabetes_raw["BMI"].astype(float)
diabetes_std["blood_pressure_systolic"] = np.nan
diabetes_std["blood_pressure_diastolic"] = np.nan
diabetes_std["cholesterol"] = np.nan
diabetes_std["glucose"] = np.nan
diabetes_std["data_source"] = "Diabetes_Indicators"

combined = pd.concat([heart_std, cardio_std, diabetes_std], ignore_index=True)
combined["pulse_pressure"] = combined["blood_pressure_systolic"] - combined["blood_pressure_diastolic"]

numeric_features = ["age", "bmi", "blood_pressure_systolic", "blood_pressure_diastolic",
                    "cholesterol", "glucose", "pulse_pressure"]

for source in combined["data_source"].dropna().unique():
    mask = combined["data_source"].eq(source)
    for col in numeric_features:
        vals = combined.loc[mask, col]
        if vals.notna().any():
            q1, q99 = vals.quantile(0.01), vals.quantile(0.99)
            if pd.notna(q1) and pd.notna(q99) and q1 != q99:
                combined.loc[mask, col] = vals.clip(q1, q99)

for col in numeric_features:
    combined[col] = combined[col].fillna(combined[col].mean())

prep_scaler = StandardScaler()
prep_scaler.fit(combined[numeric_features])

scaler_params = {}
for i, col in enumerate(numeric_features):
    scaler_params[col] = {"mean": float(prep_scaler.mean_[i]), "std": float(prep_scaler.scale_[i])}
    print(f"  {col:35s}  mean={scaler_params[col]['mean']:.4f}  std={scaler_params[col]['std']:.4f}")


# ---------------------------------------------------------------------------
# 6. Save artifact
# ---------------------------------------------------------------------------
print("\n[6/6] Saving artifact …")

artifact_path = OUTPUT_DIR / "hybrid_digital_twin_model.joblib"
joblib.dump(
    {
        "static_branch_name": best_static_name,
        "static_model": static_model,
        "static_threshold": static_threshold,
        # NEW second branch — replaces bilstm_model
        "lightgbm_model": lgb_model,
        "lightgbm_threshold": lgb_thr,
        "meta_learner": meta_learner,
        "fusion_threshold": fusion_thr,
        "feature_columns": feature_cols,
        "continuous_columns": continuous_cols,
        "random_state": RANDOM_STATE,
        "preprocessing_scaler_params": scaler_params,
    },
    artifact_path,
)
print(f"  Saved: {artifact_path}")

# Also save branch metrics for the record
pd.DataFrame([
    {"branch": best_static_name, **evaluate_predictions(y_test, static_test_proba, static_threshold)},
    {"branch": "LightGBM", **lgb_test_metrics},
    {"branch": "Fusion", **fusion_test_metrics},
]).to_csv(OUTPUT_DIR / "branch_test_metrics.csv", index=False)


# ---------------------------------------------------------------------------
# 7. Sanity check across a realistic patient spectrum
# ---------------------------------------------------------------------------
print("\n" + "=" * 70)
print("SANITY CHECK — risk should increase GRADUALLY down the list")
print("=" * 70)

sys.path.insert(0, str(PROJECT_ROOT / "Backend"))
# Reload service to pick up the new artifact
import importlib

import app.services  # noqa: E402
importlib.reload(app.services)
from app.services import DigitalTwinService  # noqa: E402
from app.schemas import PatientInput, Sex, SmokingStatus  # noqa: E402

svc = DigitalTwinService()

cases = [
    ("Healthy 25yo",            PatientInput(age=25, sex=Sex.male, bmi=22, physical_activity=1, diet_quality=5, smoking_status=SmokingStatus.never, alcohol_consumption=0, medical_history_diabetes=0, medical_history_hypertension=0, medical_history_heart_disease=0, blood_pressure_systolic=110, blood_pressure_diastolic=70, cholesterol_level=0, glucose_level=0)),
    ("25yo smoker only",        PatientInput(age=25, sex=Sex.male, bmi=22, physical_activity=1, diet_quality=5, smoking_status=SmokingStatus.current, alcohol_consumption=0, medical_history_diabetes=0, medical_history_hypertension=0, medical_history_heart_disease=0, blood_pressure_systolic=110, blood_pressure_diastolic=70, cholesterol_level=0, glucose_level=0)),
    ("25yo smoker+HTN (your case)", PatientInput(age=25, sex=Sex.male, bmi=28.4, physical_activity=1, diet_quality=3, smoking_status=SmokingStatus.current, alcohol_consumption=1, medical_history_diabetes=0, medical_history_hypertension=1, medical_history_heart_disease=0, blood_pressure_systolic=142, blood_pressure_diastolic=92, cholesterol_level=2, glucose_level=1)),
    ("45yo smoker+HTN",         PatientInput(age=45, sex=Sex.male, bmi=28.4, physical_activity=0, diet_quality=3, smoking_status=SmokingStatus.current, alcohol_consumption=1, medical_history_diabetes=0, medical_history_hypertension=1, medical_history_heart_disease=0, blood_pressure_systolic=142, blood_pressure_diastolic=92, cholesterol_level=2, glucose_level=1)),
    ("62yo obese HTN smoker",   PatientInput(age=62, sex=Sex.male, bmi=32.4, physical_activity=0, diet_quality=1, smoking_status=SmokingStatus.current, alcohol_consumption=1, medical_history_diabetes=0, medical_history_hypertension=1, medical_history_heart_disease=0, blood_pressure_systolic=162, blood_pressure_diastolic=96, cholesterol_level=3, glucose_level=3)),
    ("68yo 3 comorbidities",    PatientInput(age=68, sex=Sex.male, bmi=34.7, physical_activity=0, diet_quality=1, smoking_status=SmokingStatus.current, alcohol_consumption=1, medical_history_diabetes=1, medical_history_hypertension=1, medical_history_heart_disease=1, blood_pressure_systolic=170, blood_pressure_diastolic=100, cholesterol_level=3, glucose_level=3)),
]

print(f"\n{'Case':34s} {'XGB':>7s} {'LightGBM':>9s} {'Fusion':>7s}  FusionPred")
print("-" * 75)
for name, patient in cases:
    r = svc.predict(patient, "fusion")
    print(f"{name:34s} {r.tabular_probability:7.4f} {r.bilstm_probability:9.4f} {r.fusion_probability:7.4f}  {r.fusion_prediction}")

print("\nDone.")
print(f"Plots saved to: {PLOT_DIR}")
