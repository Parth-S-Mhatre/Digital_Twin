"""
causal_dml_pipeline.py
----------------------
Prepare a 500k-record clinical DataFrame for econml.dml.LinearDML.

Causal variable isolation ( Rubin / Pearl notation ):
    Y : cardiovascular_risk_score                 -> clinical outcome vector
    T : missed_medication_days,
        daily_sodium_mg,
        daily_exercise_minutes                    -> mutable treatment / sliders
    X : age, biological_sex, race, genetics_score -> confounders + effect modifiers

Design notes
------------
* float32 throughout  -> halves RSS vs float64 (~4 MB / 100k-row col).
* Median/mode imputation + inf sanitization before any modelling.
* Tree-method "hist" XGBoost nuisance models (invariant to scaling, but the
  final-stage Lasso is not -> continuous cols are StandardScaled).
* LinearDML performs its OWN internal K-fold cross-fitting; the outer 80/20
  split is reserved for held-out CATE / policy validation only.
"""

from __future__ import annotations

import warnings
from typing import Any, Dict, Tuple

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBRegressor

from econml.dml import LinearDML

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

# --------------------------------------------------------------------------- #
# Schema                                                                       #
# --------------------------------------------------------------------------- #
CONFOUNDERS_X: list[str] = ["age", "biological_sex", "race", "genetics_score"]
TREATMENTS_T: list[str] = [
    "missed_medication_days",
    "daily_sodium_mg",
    "daily_exercise_minutes",
]
OUTCOME_Y: str = "cardiovascular_risk_score"

# Split confounders by dtype for targeted preprocessing
CATEGORICAL_COLS: list[str] = ["biological_sex", "race"]
CONTINUOUS_COLS: list[str] = ["age", "genetics_score"]

RANDOM_STATE: int = 42
TEST_SIZE: float = 0.20
N_FOLDS_CROSSFIT: int = 5


# --------------------------------------------------------------------------- #
# 1. Memory-safe sanitization                                                  #
# --------------------------------------------------------------------------- #
def sanitize_numeric(df: pd.DataFrame) -> pd.DataFrame:
    """Replace +/- inf with NaN and downcast all numerics to float32 (in place on a copy)."""
    df = df.copy()
    df = df.replace([np.inf, -np.inf], np.nan)
    numeric = df.select_dtypes(include=[np.number]).columns
    df[numeric] = df[numeric].astype(np.float32)
    return df


# --------------------------------------------------------------------------- #
# 2. Preprocessors for X, T, Y                                                  #
# --------------------------------------------------------------------------- #
def build_confounder_preprocessor() -> ColumnTransformer:
    """Median-impute + scale for numeric; mode-impute + OHE for categorical."""
    num_pipe = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )
    cat_pipe = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("ohe", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ]
    )
    return ColumnTransformer(
        transformers=[
            ("num", num_pipe, CONTINUOUS_COLS),
            ("cat", cat_pipe, CATEGORICAL_COLS),
        ],
        remainder="drop",
        sparse_threshold=0.0,  # final-stage Lasso prefers dense
    )


def build_treatment_preprocessor() -> Pipeline:
    """Continuous sliders -> median impute + StandardScaler."""
    return Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )


# --------------------------------------------------------------------------- #
# 3. Core array assembly                                                        #
# --------------------------------------------------------------------------- #
def prepare_arrays(
    df: pd.DataFrame,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray,
           ColumnTransformer, Pipeline]:
    """
    Returns
    -------
    X : (n, k)  float32  -- confounders / effect modifiers
    T : (n, 3)  float32  -- treatments
    Y : (n,)    float32  -- outcome
    pre_X, pre_T        -- fitted preprocessors (for inference-time encoding)
    """
    df = sanitize_numeric(df)

    # --- Y ------------------------------------------------------------------
    Y = (
        SimpleImputer(strategy="median")
        .fit_transform(df[[OUTCOME_Y]].to_numpy(dtype=np.float32))
        .ravel()
    )

    # --- X (confounders) ----------------------------------------------------
    pre_X = build_confounder_preprocessor()
    X = np.asarray(pre_X.fit_transform(df[CONFOUNDERS_X]), dtype=np.float32)

    # --- T (treatments) -----------------------------------------------------
    pre_T = build_treatment_preprocessor()
    T = np.asarray(
        pre_T.fit_transform(df[TREATMENTS_T].to_numpy(dtype=np.float32)),
        dtype=np.float32,
    )

    _assert_no_nan_inf(X, "X")
    _assert_no_nan_inf(T, "T")
    _assert_no_nan_inf(Y.reshape(-1, 1), "Y")

    return X, T, Y, pre_X, pre_T


def _assert_no_nan_inf(arr: np.ndarray, name: str) -> None:
    """Validation guard — fail fast in the container rather than mid-fit."""
    if not np.all(np.isfinite(arr)):
        raise ValueError(f"{name} still contains NaN/inf after preprocessing.")


# --------------------------------------------------------------------------- #
# 4. 80/20 split (outer, for validation; cross-fitting is internal to DML)     #
# --------------------------------------------------------------------------- #
def split_train_test(
    X: np.ndarray, T: np.ndarray, Y: np.ndarray
) -> Tuple[np.ndarray, np.ndarray, np.ndarray,
           np.ndarray, np.ndarray, np.ndarray]:
    idx = np.arange(Y.shape[0])
    idx_tr, idx_te = train_test_split(
        idx, test_size=TEST_SIZE, random_state=RANDOM_STATE, shuffle=True
    )
    return (
        X[idx_tr], X[idx_te],
        T[idx_tr], T[idx_te],
        Y[idx_tr], Y[idx_te],
    )


# --------------------------------------------------------------------------- #
# 5. LinearDML initialization                                                  #
# --------------------------------------------------------------------------- #
def build_linear_dml() -> LinearDML:
    """XGBoost nuisance models for both outcome and treatment branches."""
    xgb_kwargs: Dict[str, Any] = dict(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        reg_lambda=1.0,
        n_jobs=-1,
        tree_method="hist",     # GPU-friendly on Railway if added later
        random_state=RANDOM_STATE,
    )
    return LinearDML(
        model_y=XGBRegressor(**xgb_kwargs),
        model_t=XGBRegressor(**xgb_kwargs),
        discrete_treatment=False,        # T is continuous
        random_state=RANDOM_STATE,
        cv=N_FOLDS_CROSSFIT,             # internal K-fold cross-fitting
    )


# --------------------------------------------------------------------------- #
# 6. Entry point                                                               #
# --------------------------------------------------------------------------- #
def train(df: pd.DataFrame) -> LinearDML:
    """
    End-to-end: sanitize -> encode -> split -> fit LinearDML.
    Returns a fitted estimator ready for .effect(X, T0, T1) counterfactuals.
    """
    X, T, Y, pre_X, pre_T = prepare_arrays(df)
    X_tr, X_te, T_tr, T_te, Y_tr, Y_te = split_train_test(X, T, Y)

    est = build_linear_dml()
    # Confounders double as effect modifiers (X=). Pass W=None implicitly.
    est.fit(Y_tr, T_tr, X=X_tr)

    # Persist preprocessors on the estimator for inference-time reuse
    est._pre_X = pre_X   # type: ignore[attr-defined]
    est._pre_T = pre_T   # type: ignore[attr-defined]
    return est


if __name__ == "__main__":
    # Memory-efficient load for 500k rows (mmap, no full double-precision copy)
    df: pd.DataFrame = pd.read_parquet(
        "clinical_500k.parquet",
        engine="pyarrow",
    ).astype({c: "float32" for c in [
        "age", "genetics_score", "missed_medication_days",
        "daily_sodium_mg", "daily_exercise_minutes",
        "cardiovascular_risk_score",
    ]})

    est = train(df)

    # Counterfactual "What-If": baseline T0 vs intervention T1, per patient
    # effect_ = est.effect(X_te, T0=T_te, T1=T_te + delta)
    ...
