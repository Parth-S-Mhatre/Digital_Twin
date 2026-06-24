#!/usr/bin/env python3
"""Retrain the BiLSTM branch WITHOUT StandardScaler to fix label inversion.

Root cause
----------
Two scaling mismatches caused inverted BiLSTM predictions:

1. **Preprocessing mismatch**: The training data (healthcare_dataset_encoded.csv)
   was z-score standardized (StandardScaler) for features like age, bmi,
   blood pressure, cholesterol, glucose, and pulse_pressure.  But the
   service's ``encode_patient()`` was applying min-max normalization instead.

2. **BiLSTM-specific StandardScaler**: A second StandardScaler was applied to
   continuous features in the synthetic temporal sequences during BiLSTM
   training, but was never saved in the joblib artifact.

Both models (XGBoost and BiLSTM) were trained on z-score features.  XGBoost
being tree-based is somewhat robust to monotonic scaling, but BiLSTM is
extremely sensitive — the wrong value distribution caused it to output
~99.9 % risk for healthy patients and ~0 % for genuinely high-risk ones.

Fix
---
- Retrain the BiLSTM on the same data splits but *skip* the second
  StandardScaler.
- Replicate the preprocessing StandardScaler from the raw data and save its
  mean / scale arrays in the joblib artifact so the service can apply z-score
  standardisation at inference time.

Usage
-----
    cd Backend
    python scripts/retrain_bilstm_no_scaler.py

The script overwrites Modellling/outputs/hybrid_digital_twin_model.joblib
with the corrected artifact.
"""

from __future__ import annotations

import random
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
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
from sklearn.utils.class_weight import compute_class_weight
from tensorflow.keras import callbacks, layers, models
from xgboost import XGBClassifier

warnings.filterwarnings("ignore")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "Data_preprocessing" / "output"
OUTPUT_DIR = PROJECT_ROOT / "Modellling" / "outputs"
RANDOM_STATE = 42

np.random.seed(RANDOM_STATE)
random.seed(RANDOM_STATE)
tf.keras.utils.set_random_seed(RANDOM_STATE)


# ---------------------------------------------------------------------------
# Helpers (copied from notebook)
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


# ---------------------------------------------------------------------------
# 1. Load data & split (identical to notebook)
# ---------------------------------------------------------------------------
print("Loading encoded dataset …")
encoded_df = pd.read_csv(DATA_DIR / "healthcare_dataset_encoded.csv")

target_col = "target_disease"
drop_cols = ["patient_id", "data_source", "collection_date", target_col]
feature_cols = [c for c in encoded_df.columns if c not in drop_cols]

X_full = encoded_df[feature_cols].copy()
y_full = encoded_df[target_col].astype(int).copy()

idx = np.arange(len(encoded_df))
train_idx, temp_idx = train_test_split(idx, test_size=0.40, stratify=y_full, random_state=RANDOM_STATE)
val_idx, test_idx = train_test_split(temp_idx, test_size=0.50, stratify=y_full.iloc[temp_idx], random_state=RANDOM_STATE)

X_train, y_train = X_full.iloc[train_idx], y_full.iloc[train_idx]
X_val, y_val = X_full.iloc[val_idx], y_full.iloc[val_idx]
X_test, y_test = X_full.iloc[test_idx], y_full.iloc[test_idx]

print(f"Train: {X_train.shape}  Val: {X_val.shape}  Test: {X_test.shape}")

# ---------------------------------------------------------------------------
# 2. Train tabular branch (identical to notebook)
# ---------------------------------------------------------------------------
print("\nTraining tabular (XGBoost + ensemble) …")

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
static_threshold = tabular_results.loc[0, "threshold"]
static_model = xgb_model if best_static_name == "XGBoost" else tabular_ensemble
static_val_proba = xgb_val_proba if best_static_name == "XGBoost" else ens_val_proba
static_test_proba = static_model.predict_proba(X_test)[:, 1]

print(f"Best static branch: {best_static_name}  (threshold={static_threshold:.4f})")

# ---------------------------------------------------------------------------
# 3. Build synthetic temporal sequences – NO StandardScaler
# ---------------------------------------------------------------------------
print("\nBuilding synthetic temporal sequences (no StandardScaler) …")

continuous_cols = [
    "age", "bmi", "physical_activity", "diet_quality", "alcohol_consumption",
    "medical_history_diabetes", "medical_history_hypertension",
    "medical_history_heart_disease", "blood_pressure_systolic",
    "blood_pressure_diastolic", "cholesterol", "glucose", "pulse_pressure",
    "comorbidity_count",
]
continuous_cols = [c for c in continuous_cols if c in feature_cols]

timesteps = 12


def build_synthetic_sequences(df_features, df_target, features, cont_cols, timesteps=12, seed=42):
    """Create a synthetic temporal proxy WITHOUT StandardScaler."""
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

    # Add noise to continuous columns only
    cont_idx = [features.index(c) for c in cont_cols if c in features]
    if cont_idx:
        noise = rng.normal(0, 0.01, size=(n_samples, timesteps, len(cont_idx))).astype(np.float32)
        sequences[:, :, cont_idx] += noise

    return sequences.astype(np.float32), y_np.astype(int)


X_seq_train, y_seq_train = build_synthetic_sequences(X_train, y_train, feature_cols, continuous_cols, timesteps, RANDOM_STATE)
X_seq_val, y_seq_val = build_synthetic_sequences(X_val, y_val, feature_cols, continuous_cols, timesteps, RANDOM_STATE + 1)
X_seq_test, y_seq_test = build_synthetic_sequences(X_test, y_test, feature_cols, continuous_cols, timesteps, RANDOM_STATE + 2)

print(f"Sequences – Train: {X_seq_train.shape}  Val: {X_seq_val.shape}  Test: {X_seq_test.shape}")

# ---------------------------------------------------------------------------
# 4. Train BiLSTM (identical architecture, NO StandardScaler)
# ---------------------------------------------------------------------------
print("\nTraining BiLSTM (no StandardScaler) …")


def build_bilstm(input_shape):
    inputs = layers.Input(shape=input_shape)
    x = layers.Bidirectional(layers.LSTM(64, return_sequences=True))(inputs)
    x = layers.Dropout(0.30)(x)
    x = layers.Bidirectional(layers.LSTM(32))(x)
    x = layers.Dense(32, activation="relu")(x)
    x = layers.Dropout(0.20)(x)
    outputs = layers.Dense(1, activation="sigmoid")(x)

    model = models.Model(inputs, outputs, name="bilstm_disease_forecaster")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="binary_crossentropy",
        metrics=[
            tf.keras.metrics.AUC(name="roc_auc"),
            tf.keras.metrics.AUC(name="pr_auc", curve="PR"),
            "accuracy",
        ],
    )
    return model


bilstm_model = build_bilstm((X_seq_train.shape[1], X_seq_train.shape[2]))

seq_classes = np.array([0, 1])
seq_cw = compute_class_weight(class_weight="balanced", classes=seq_classes, y=y_seq_train)
seq_class_weight = dict(zip(seq_classes, seq_cw))

early_stop = callbacks.EarlyStopping(
    monitor="val_roc_auc", mode="max", patience=5, restore_best_weights=True, verbose=1,
)
reduce_lr = callbacks.ReduceLROnPlateau(
    monitor="val_loss", factor=0.5, patience=2, min_lr=1e-5, verbose=1,
)

history = bilstm_model.fit(
    X_seq_train, y_seq_train,
    validation_data=(X_seq_val, y_seq_val),
    epochs=20, batch_size=256,
    class_weight=seq_class_weight,
    callbacks=[early_stop, reduce_lr],
    verbose=1,
)

bilstm_val_proba = bilstm_model.predict(X_seq_val, verbose=0).ravel()
bilstm_test_proba = bilstm_model.predict(X_seq_test, verbose=0).ravel()

bilstm_thr, bilstm_best_f1 = best_f1_threshold(y_seq_val, bilstm_val_proba)
bilstm_val_metrics = evaluate_predictions(y_seq_val, bilstm_val_proba, bilstm_thr)
bilstm_test_metrics = evaluate_predictions(y_seq_test, bilstm_test_proba, bilstm_thr)

print(f"\nBiLSTM threshold: {bilstm_thr:.4f}  best_val_f1: {bilstm_best_f1:.4f}")
print("BiLSTM test metrics:", bilstm_test_metrics)

# ---------------------------------------------------------------------------
# 5. Fusion meta-learner
# ---------------------------------------------------------------------------
print("\nTraining fusion meta-learner …")

static_test_proba_for_fusion = static_model.predict_proba(X_test)[:, 1]
fusion_val_X = np.column_stack([static_val_proba, bilstm_val_proba])
fusion_test_X = np.column_stack([static_test_proba_for_fusion, bilstm_test_proba])

meta_learner = LogisticRegression(
    max_iter=2000, class_weight="balanced", solver="liblinear", random_state=RANDOM_STATE,
)
meta_learner.fit(fusion_val_X, y_val)

fusion_val_proba = meta_learner.predict_proba(fusion_val_X)[:, 1]
fusion_test_proba = meta_learner.predict_proba(fusion_test_X)[:, 1]

fusion_thr, fusion_best_f1 = best_f1_threshold(y_val, fusion_val_proba)
fusion_test_metrics = evaluate_predictions(y_test, fusion_test_proba, fusion_thr)

print(f"Fusion threshold: {fusion_thr:.4f}  best_val_f1: {fusion_best_f1:.4f}")
print("Fusion test metrics:", fusion_test_metrics)

# ---------------------------------------------------------------------------
# 6. Replicate preprocessing StandardScaler so the service can apply it
# ---------------------------------------------------------------------------
print("\nReplicating preprocessing StandardScaler …")

DATA_DIR_RAW = PROJECT_ROOT / "Data"

heart_raw = pd.read_csv(DATA_DIR_RAW / "heart_disease_health_indicators_BRFSS2015.csv")
cardio_raw = pd.read_csv(DATA_DIR_RAW / "cardio_train.csv", sep=";")
diabetes_raw = pd.read_csv(DATA_DIR_RAW / "diabetes_012_health_indicators_BRFSS2015.csv")

# Standardise schemas
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

# Outlier clipping per source (same as preprocessing notebook)
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

preprocessing_scaler = StandardScaler()
preprocessing_scaler.fit(combined[numeric_features])

print("Preprocessing StandardScaler parameters:")
scaler_params = {}
for i, col in enumerate(numeric_features):
    scaler_params[col] = {"mean": float(preprocessing_scaler.mean_[i]),
                          "std": float(preprocessing_scaler.scale_[i])}
    print(f"  {col:35s}  mean={preprocessing_scaler.mean_[i]:.4f}  std={preprocessing_scaler.scale_[i]:.4f}")

# ---------------------------------------------------------------------------
# 7. Save corrected artifact
# ---------------------------------------------------------------------------
print(f"\nSaving corrected artifact to {OUTPUT_DIR / 'hybrid_digital_twin_model.joblib'} …")

joblib.dump(
    {
        "static_branch_name": best_static_name,
        "static_model": static_model,
        "static_threshold": static_threshold,
        "bilstm_model": bilstm_model,
        "bilstm_threshold": bilstm_thr,
        "meta_learner": meta_learner,
        "fusion_threshold": fusion_thr,
        "feature_columns": feature_cols,
        "continuous_columns": continuous_cols,
        "random_state": RANDOM_STATE,
        "preprocessing_scaler_params": scaler_params,
    },
    OUTPUT_DIR / "hybrid_digital_twin_model.joblib",
)

print("Done. Artifact saved.")

# ---------------------------------------------------------------------------
# 7. Quick sanity check: probe healthy vs high-risk
# ---------------------------------------------------------------------------
print("\n=== Sanity check ===")

import sys
sys.path.insert(0, str(PROJECT_ROOT / "Backend"))
from app.schemas import PatientInput, Sex, SmokingStatus

svc = __import__("app.services", fromlist=["DigitalTwinService"]).DigitalTwinService()

healthy = PatientInput(
    age=35, sex=Sex.male, bmi=23.0, physical_activity=1, diet_quality=4,
    smoking_status=SmokingStatus.never, alcohol_consumption=0,
    medical_history_diabetes=0, medical_history_hypertension=0, medical_history_heart_disease=0,
    blood_pressure_systolic=120, blood_pressure_diastolic=73,
    cholesterol_level=0, glucose_level=0,
)

high_risk = PatientInput(
    age=62, sex=Sex.male, bmi=32.4, physical_activity=0, diet_quality=1,
    smoking_status=SmokingStatus.current, alcohol_consumption=1,
    medical_history_diabetes=0, medical_history_hypertension=1, medical_history_heart_disease=0,
    blood_pressure_systolic=162, blood_pressure_diastolic=96,
    cholesterol_level=3, glucose_level=3,
)

for label, patient in [("Healthy 35yo", healthy), ("High-risk 62yo", high_risk)]:
    r = svc.predict(patient, "fusion")
    print(f"{label:20s}  XGB={r.tabular_probability:.4f}  BiLSTM={r.bilstm_probability:.4f}  "
          f"Fusion={r.fusion_probability:.4f}  FusionPred={r.fusion_prediction}")
