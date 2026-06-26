# Healthcare Disease Prediction — ML Pipeline

End-to-end machine learning pipeline for cardiovascular disease, diabetes, and heart disease prediction.

## Datasets

| File | Task | Rows | Target |
|------|------|------|--------|
| `cardio_train.csv` | Cardiovascular disease | 70,000 | `cardio` |
| `diabetes_binary_health_indicators_BRFSS2015.csv` | Diabetes (imbalanced) | 253,680 | `Diabetes_binary` |
| `diabetes_binary_5050split_health_indicators_BRFSS2015.csv` | Diabetes (pre-balanced) | 70,692 | `Diabetes_binary` |
| `diabetes_012_health_indicators_BRFSS2015.csv` | Diabetes (3-class) | 253,680 | `Diabetes_012` |
| `heart_disease_health_indicators_BRFSS2015.csv` | Heart Disease | 253,680 | `HeartDiseaseorAttack` |

## Workflow

```
01_EDA.ipynb
    ↓
cleaned_cardiovascular.csv
cleaned_diabetes.csv
cleaned_heart_disease.csv

02_Data_Preprocessing.ipynb
    ↓
cardio_X_train.csv / X_test.csv / y_train.csv / y_test.csv
diabetes_X_train.csv / X_test.csv / y_train.csv / y_test.csv
heart_X_train.csv / X_test.csv / y_train.csv / y_test.csv
artifacts/cardio_preprocessor.joblib
artifacts/diabetes_preprocessor.joblib
artifacts/heart_preprocessor.joblib

03_Modeling.ipynb
    ↓
artifacts/best_model_cardiovascular.joblib
artifacts/best_model_diabetes.joblib
artifacts/best_model_heart_disease.joblib
artifacts/metrics.csv
plots/baseline_comparison.png
plots/roc_curves.png
plots/pr_curves.png
plots/confusion_matrices.png
plots/feature_importance.png
```

## Key Design Decisions

### Class Imbalance Strategy
| Dataset | Imbalance Ratio | Strategy |
|---------|----------------|----------|
| Cardiovascular | ~1:1 | None needed |
| Diabetes | ~6:1 | SMOTETomek |
| Heart Disease | ~10:1 | ADASYN |

Resampling is applied **only to training data** to prevent leakage.

### Model Selection Metric
Primary: **Recall** — missing a disease case is more costly than a false alarm.
Also reported: F1, ROC-AUC, PR-AUC, Balanced Accuracy, MCC.

### Models Evaluated
Logistic Regression, Decision Tree, Random Forest, Extra Trees, XGBoost, LightGBM, CatBoost, AdaBoost, Gradient Boosting

Tuning: `RandomizedSearchCV(n_iter=20, cv=5, scoring='recall')`

## Setup (Google Colab)

```python
!pip install xgboost lightgbm catboost imbalanced-learn -q
```

Upload all CSV files to the Colab session, then run notebooks in order.

## Requirements
```
scikit-learn>=1.3
xgboost>=2.0
lightgbm>=4.0
catboost>=1.2
imbalanced-learn>=0.11
pandas>=2.0
numpy>=1.24
matplotlib>=3.7
seaborn>=0.12
joblib>=1.3
```
