"""Visualization & recommendation service.

Builds chart-ready JSON payloads and SHAP-driven actionable recommendations
from prediction results.  No LLM dependency — all outputs are deterministic,
rule-based, and prioritized by actual model feature attribution (SHAP values).
"""

from __future__ import annotations

from typing import Any

import numpy as np

from .schemas import (
    BranchBarData,
    Recommendation,
    RecommendationCategory,
    RecommendationPriority,
    RecommendationResponse,
    RiskCategory,
    RiskDashboardResponse,
    ShapContribution,
)


# ---------------------------------------------------------------------------
# Risk category mapping
# ---------------------------------------------------------------------------

def _risk_category(probability: float) -> RiskCategory:
    if probability >= 0.8:
        return RiskCategory.critical
    if probability >= 0.6:
        return RiskCategory.high
    if probability >= 0.4:
        return RiskCategory.medium
    if probability >= 0.2:
        return RiskCategory.low
    return RiskCategory.very_low


# ---------------------------------------------------------------------------
# Branch color palette (frontend-safe hex values)
# ---------------------------------------------------------------------------

_BRANCH_COLORS: dict[str, str] = {
    "xgboost": "#3B82F6",       # blue
    "bilstm": "#10B981",        # emerald (LightGBM uses this legacy name)
    "lightgbm": "#10B981",
    "fusion": "#8B5CF6",        # purple
}


# ---------------------------------------------------------------------------
# Feature display metadata
# ---------------------------------------------------------------------------

_FEATURE_UNITS: dict[str, str] = {
    "age": "years",
    "bmi": "kg/m²",
    "blood_pressure_systolic": "mmHg",
    "blood_pressure_diastolic": "mmHg",
    "pulse_pressure": "mmHg",
    "cholesterol": "level (0-3)",
    "glucose": "level (0-3)",
    "physical_activity": "binary (0=sedentary, 1=active)",
    "diet_quality": "score (0-5)",
    "alcohol_consumption": "binary (0=no, 1=yes)",
}

# Features that are one-hot encoded — their raw value is 0 or 1
_ONEHOT_PREFIXES = (
    "sex_", "smoking_status_", "bmi_category_", "bp_status_", "age_group_",
)


def _is_onehot(feature: str) -> bool:
    return any(feature.startswith(p) for p in _ONEHOT_PREFIXES)


# ---------------------------------------------------------------------------
# Recommendation knowledge base
# ---------------------------------------------------------------------------

_RECOMMENDATIONS: dict[tuple[RecommendationCategory, RecommendationPriority], dict] = {
    # --- Blood pressure ---
    ("blood_pressure", "critical"): {
        "title": "Urgent blood pressure management",
        "rationale": "Your blood pressure reading is in the hypertensive crisis range and is the dominant driver of your risk score.",
        "actionable_steps": [
            "Consult a healthcare provider within 24–48 hours",
            "Reduce sodium intake to < 1,500 mg/day",
            "Monitor blood pressure morning and evening and log readings",
            "Avoid NSAIDs and decongestants that raise blood pressure",
        ],
        "expected_impact": "Lowering systolic BP by 10 mmHg can reduce cardiovascular risk by ~20%",
    },
    ("blood_pressure", "high"): {
        "title": "Blood pressure management recommended",
        "rationale": "Your blood pressure is elevated and contributes significantly to your risk profile.",
        "actionable_steps": [
            "Reduce sodium intake to < 2,300 mg/day",
            "Increase potassium-rich foods (bananas, sweet potatoes, spinach)",
            "Engage in 150 min/week of moderate aerobic activity",
            "Monitor blood pressure weekly",
        ],
        "expected_impact": "Consistent lifestyle changes can lower systolic BP by 5–10 mmHg",
    },
    ("blood_pressure", "medium"): {
        "title": "Monitor your blood pressure",
        "rationale": "Your blood pressure is slightly elevated and modestly increases your risk.",
        "actionable_steps": [
            "Check blood pressure at least once a month",
            "Maintain a healthy weight and stay physically active",
            "Limit alcohol to ≤ 1 drink/day",
        ],
        "expected_impact": "Early intervention can prevent progression to hypertension",
    },

    # --- Weight / BMI ---
    ("weight", "critical"): {
        "title": "Weight management — high priority",
        "rationale": "Your BMI is in the obese range and is a major contributor to your overall risk.",
        "actionable_steps": [
            "Aim for a gradual weight loss of 0.5–1 kg/week",
            "Consult a dietitian for a personalized meal plan",
            "Accumulate 200–300 min/week of moderate-intensity exercise",
            "Track caloric intake using a food diary",
        ],
        "expected_impact": "Losing 5–10% of body weight can reduce disease risk by 20–30%",
    },
    ("weight", "high"): {
        "title": "Gradual weight loss recommended",
        "rationale": "Your BMI is in the overweight range and contributes to your risk score.",
        "actionable_steps": [
            "Target 150 min/week of moderate aerobic activity",
            "Replace processed foods with whole grains, fruits, and vegetables",
            "Limit sugary beverages and refined carbohydrates",
        ],
        "expected_impact": "Even a 3–5% weight reduction improves metabolic markers",
    },
    ("weight", "medium"): {
        "title": "Maintain a healthy weight",
        "rationale": "Your BMI slightly influences your risk profile.",
        "actionable_steps": [
            "Stay active with regular exercise",
            "Eat balanced meals with portion control",
        ],
        "expected_impact": "Weight maintenance prevents metabolic drift over time",
    },

    # --- Smoking ---
    ("smoking", "critical"): {
        "title": "Smoking cessation — top priority",
        "rationale": "Current smoking is a leading risk factor and strongly elevates your disease risk.",
        "actionable_steps": [
            "Enroll in a smoking cessation program or call a quitline",
            "Consider nicotine replacement therapy (patch, gum, or lozenge)",
            "Avoid triggers and environments that encourage smoking",
            "Set a quit date within the next 2 weeks",
        ],
        "expected_impact": "Within 1 year of quitting, cardiovascular risk drops by 50%",
    },
    ("smoking", "high"): {
        "title": "Consider quitting smoking",
        "rationale": "Smoking is a significant contributor to your risk profile.",
        "actionable_steps": [
            "Talk to your doctor about cessation options",
            "Gradually reduce daily cigarette count",
            "Use support apps or join a cessation group",
        ],
        "expected_impact": "Quitting at any age provides immediate health benefits",
    },

    # --- Lifestyle (diet, activity, alcohol) ---
    ("lifestyle", "high"): {
        "title": "Improve lifestyle habits",
        "rationale": "Your diet quality and physical activity levels are below optimal and affect your risk.",
        "actionable_steps": [
            "Increase physical activity to at least 150 min/week",
            "Improve diet quality: more vegetables, fruits, lean protein, whole grains",
            "Reduce alcohol consumption",
            "Ensure 7–9 hours of sleep per night",
        ],
        "expected_impact": "Lifestyle changes can reduce overall disease risk by 30–50%",
    },
    ("lifestyle", "medium"): {
        "title": "Maintain healthy lifestyle habits",
        "rationale": "Your lifestyle factors have a modest influence on your risk score.",
        "actionable_steps": [
            "Stay consistently active",
            "Keep a balanced diet",
            "Stay hydrated and prioritize sleep quality",
        ],
        "expected_impact": "Sustained healthy habits provide compounding long-term benefits",
    },

    # --- Comorbidity ---
    ("comorbidity", "critical"): {
        "title": "Multi-condition management — comprehensive care needed",
        "rationale": "You have multiple existing conditions that significantly compound your risk.",
        "actionable_steps": [
            "Schedule a comprehensive review with your primary care provider",
            "Ensure all medications are up-to-date and interactions are reviewed",
            "Follow treatment plans for each diagnosed condition",
            "Attend all scheduled follow-up appointments",
        ],
        "expected_impact": "Proactive management of comorbidities can reduce complications by 25–40%",
    },
    ("comorbidity", "high"): {
        "title": "Manage existing conditions actively",
        "rationale": "A pre-existing condition contributes to your overall risk score.",
        "actionable_steps": [
            "Follow prescribed treatment plans consistently",
            "Schedule regular check-ups and screenings",
            "Monitor relevant biomarkers as directed by your provider",
        ],
        "expected_impact": "Well-managed chronic conditions reduce acute event risk significantly",
    },

    # --- Metabolic (cholesterol, glucose) ---
    ("metabolic", "critical"): {
        "title": "Metabolic markers require urgent attention",
        "rationale": "Your cholesterol and/or glucose levels are in a high-risk range.",
        "actionable_steps": [
            "Get a comprehensive lipid panel and HbA1c test",
            "Reduce refined sugars and saturated fats in your diet",
            "Discuss medication options with your healthcare provider",
            "Monitor fasting glucose regularly",
        ],
        "expected_impact": "Controlling metabolic markers can halve the risk of cardiovascular events",
    },
    ("metabolic", "high"): {
        "title": "Monitor metabolic health",
        "rationale": "Your cholesterol or glucose levels are elevated and contribute to risk.",
        "actionable_steps": [
            "Limit processed foods, sugary drinks, and trans fats",
            "Increase fiber intake (whole grains, legumes, vegetables)",
            "Get routine blood work every 3–6 months",
        ],
        "expected_impact": "Dietary improvements can lower LDL cholesterol by 10–15%",
    },

    # --- General (always included as lowest priority) ---
    ("general", "low"): {
        "title": "Maintain overall wellness",
        "rationale": "Continue your current health habits to sustain your low-risk profile.",
        "actionable_steps": [
            "Maintain consistent sleep (7–9 hours)",
            "Stay hydrated and eat balanced meals",
            "Keep up with routine health screenings",
        ],
        "expected_impact": "Preventive care maintains long-term health and catches issues early",
    },
}


# ---------------------------------------------------------------------------
# SHAP → recommendation mapping
# ---------------------------------------------------------------------------

# Maps model feature names to recommendation categories and display labels
_FEATURE_TO_CATEGORY: dict[str, tuple[RecommendationCategory, str]] = {
    "blood_pressure_systolic": (RecommendationCategory.blood_pressure, "Blood Pressure (systolic)"),
    "blood_pressure_diastolic": (RecommendationCategory.blood_pressure, "Blood Pressure (diastolic)"),
    "pulse_pressure": (RecommendationCategory.blood_pressure, "Pulse Pressure"),
    "bmi": (RecommendationCategory.weight, "BMI"),
    "bmi_category_Obese": (RecommendationCategory.weight, "BMI Category (Obese)"),
    "bmi_category_Overweight": (RecommendationCategory.weight, "BMI Category (Overweight)"),
    "smoking_status_Current": (RecommendationCategory.smoking, "Smoking Status"),
    "physical_activity": (RecommendationCategory.lifestyle, "Physical Activity"),
    "diet_quality": (RecommendationCategory.lifestyle, "Diet Quality"),
    "alcohol_consumption": (RecommendationCategory.lifestyle, "Alcohol Consumption"),
    "medical_history_diabetes": (RecommendationCategory.comorbidity, "Diabetes History"),
    "medical_history_hypertension": (RecommendationCategory.comorbidity, "Hypertension History"),
    "medical_history_heart_disease": (RecommendationCategory.comorbidity, "Heart Disease History"),
    "comorbidity_count": (RecommendationCategory.comorbidity, "Comorbidity Count"),
    "cholesterol": (RecommendationCategory.metabolic, "Cholesterol"),
    "glucose": (RecommendationCategory.metabolic, "Glucose"),
    "age": (RecommendationCategory.general, "Age"),
    "age_group_61-75": (RecommendationCategory.general, "Age Group (61-75)"),
    "age_group_75+": (RecommendationCategory.general, "Age Group (75+)"),
    "bp_status_Stage1_HTN": (RecommendationCategory.blood_pressure, "BP Status (Stage 1)"),
    "bp_status_Stage2_HTN": (RecommendationCategory.blood_pressure, "BP Status (Stage 2)"),
    "bp_status_Elevated": (RecommendationCategory.blood_pressure, "BP Status (Elevated)"),
}


def _shap_priority(shap_val: float) -> RecommendationPriority:
    """Map positive SHAP magnitude to recommendation priority.

    Only positive SHAP values should be passed — they indicate the feature
    *increases* the predicted risk and therefore warrants a recommendation.
    """
    if shap_val >= 1.0:
        return RecommendationPriority.critical
    if shap_val >= 0.5:
        return RecommendationPriority.high
    if shap_val >= 0.2:
        return RecommendationPriority.medium
    return RecommendationPriority.low


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def build_recommendations(
    shap_contributions: list[dict[str, Any]],
    derived_features: dict[str, Any],
    risk_probability: float,
    encoded_row: dict[str, float] | None = None,
) -> RecommendationResponse:
    """Build structured, SHAP-prioritized recommendations.

    Parameters
    ----------
    shap_contributions : list of dicts with keys ``feature``, ``shap_value``,
        ``abs_shap`` (as returned by ``explain_local`` on the XGBoost branch).
    derived_features : dict from ``PredictionBundle.derived_features``.
    risk_probability : float in [0, 1].
    encoded_row : optional dict of the encoded feature row, used to cross-check
        one-hot features (a recommendation is only valid if the encoded value is 1).
    """
    recommendations: list[Recommendation] = []
    seen_categories: set[RecommendationCategory] = set()
    top_driver = "none"
    max_abs = 0.0

    for contrib in shap_contributions:
        feature = contrib["feature"]
        shap_val = float(contrib["shap_value"])

        # Skip features that *decrease* risk — no recommendation needed
        if shap_val <= 0:
            continue

        mapping = _FEATURE_TO_CATEGORY.get(feature)
        if mapping is None:
            continue

        category, label = mapping
        priority = _shap_priority(shap_val)  # positive-only

        # Skip one-hot features with negligible contribution
        if _is_onehot(feature) and shap_val < 0.1:
            continue

        # Skip one-hot features where the patient does NOT have the condition
        # (e.g., bp_status_Stage2_HTN = 0 means the patient is NOT in Stage 2).
        # This guards against LightGBM SHAP artefacts for absent one-hot features.
        if _is_onehot(feature) and encoded_row is not None:
            if encoded_row.get(feature, 0.0) < 0.5:
                continue

        # Keep only the highest-priority recommendation per category
        if category in seen_categories:
            continue
        seen_categories.add(category)

        # Look up the recommendation template
        key = (category, priority)
        if key not in _RECOMMENDATIONS:
            # Fall back to the next lower priority that exists
            for fallback_p in (RecommendationPriority.high, RecommendationPriority.medium, RecommendationPriority.low):
                fallback_key = (category, fallback_p)
                if fallback_key in _RECOMMENDATIONS:
                    key = fallback_key
                    break

        template = _RECOMMENDATIONS.get(key, _RECOMMENDATIONS[("general", "low")])

        # Track top risk driver (shap_val is already > 0 here)
        if shap_val > max_abs:
            max_abs = shap_val
            top_driver = label

        recommendations.append(Recommendation(
            category=category,
            priority=priority,
            title=template["title"],
            rationale=template["rationale"],
            actionable_steps=template["actionable_steps"],
            expected_impact=template["expected_impact"],
            shap_contribution=round(shap_val, 4),
            feature_name=feature,
        ))

    # Sort by priority: critical > high > medium > low
    _priority_order = {
        RecommendationPriority.critical: 0,
        RecommendationPriority.high: 1,
        RecommendationPriority.medium: 2,
        RecommendationPriority.low: 3,
    }
    recommendations.sort(key=lambda r: _priority_order.get(r.priority, 99))

    # Always include a general wellness recommendation if not present
    if RecommendationCategory.general not in seen_categories:
        general = _RECOMMENDATIONS[("general", "low")]
        recommendations.append(Recommendation(
            category=RecommendationCategory.general,
            priority=RecommendationPriority.low,
            title=general["title"],
            rationale=general["rationale"],
            actionable_steps=general["actionable_steps"],
            expected_impact=general["expected_impact"],
            shap_contribution=0.0,
            feature_name="general",
        ))

    # Count total risk factors from derived features
    risk_factor_count = 0
    d = derived_features
    if isinstance(d.get("bp_status"), str) and "HTN" in d["bp_status"]:
        risk_factor_count += 1
    if d.get("bmi_category") in ("Obese", "Overweight"):
        risk_factor_count += 1
    if d.get("smoking_status") == "Current":
        risk_factor_count += 1
    if isinstance(d.get("comorbidity_count"), (int, float)) and d["comorbidity_count"] >= 1:
        risk_factor_count += 1
    if d.get("age_group") in ("61-75", "75+"):
        risk_factor_count += 1

    return RecommendationResponse(
        recommendations=recommendations[:6],
        total_risk_factors=risk_factor_count,
        top_risk_driver=top_driver,
        risk_probability=round(risk_probability, 4),
    )


def build_risk_dashboard(
    tabular_proba: float,
    second_proba: float,
    fusion_proba: float,
    shap_contributions: list[dict[str, Any]],
    encoded_row: dict[str, float],
    derived_features: dict[str, Any],
) -> RiskDashboardResponse:
    """Build a chart-ready risk dashboard payload.

    Returns structured data for:
    - Branch comparison bar chart (3 bars)
    - SHAP waterfall chart (top 10 features)
    - Risk score circle (0–100)
    - Risk factor list
    """
    risk_prob = fusion_proba
    risk_cat = _risk_category(risk_prob)

    # Branch comparison bars
    branch_comparison = [
        BranchBarData(
            branch="XGBoost",
            probability=round(tabular_proba * 100, 1),
            color=_BRANCH_COLORS.get("xgboost", "#3B82F6"),
        ),
        BranchBarData(
            branch="LightGBM",
            probability=round(second_proba * 100, 1),
            color=_BRANCH_COLORS.get("lightgbm", "#10B981"),
        ),
        BranchBarData(
            branch="Fusion",
            probability=round(fusion_proba * 100, 1),
            color=_BRANCH_COLORS.get("fusion", "#8B5CF6"),
        ),
    ]

    # SHAP contributions — waterfall style (top 10 by absolute value)
    sorted_contribs = sorted(
        shap_contributions,
        key=lambda c: float(c["abs_shap"]),
        reverse=True,
    )[:10]

    feature_contributions = []
    for c in sorted_contribs:
        feature = c["feature"]
        shap_val = float(c["shap_value"])
        raw = float(encoded_row.get(feature, 0.0))
        unit = _FEATURE_UNITS.get(feature, "")

        # For one-hot features, display as "Present" / "Absent"
        if _is_onehot(feature):
            display_val = "Present" if raw > 0.5 else "Absent"
            unit = ""
        elif unit:
            display_val = round(raw, 1)
        else:
            display_val = round(raw, 2)

        feature_contributions.append(ShapContribution(
            feature=feature,
            shap_value=round(shap_val, 4),
            direction="increases_risk" if shap_val > 0 else "decreases_risk",
            raw_value=display_val,
            unit=unit,
        ))

    # Risk factors from derived features
    d = derived_features
    risk_factors: list[str] = []
    if isinstance(d.get("bp_status"), str) and ("HTN" in d["bp_status"] or "Elevated" in d["bp_status"]):
        risk_factors.append(f"Hypertension ({d['bp_status']})")
    if d.get("bmi_category") == "Obese":
        risk_factors.append("Obesity (high BMI)")
    elif d.get("bmi_category") == "Overweight":
        risk_factors.append("Overweight")
    if d.get("smoking_status") == "Current":
        risk_factors.append("Active smoking")
    count = d.get("comorbidity_count", 0)
    if isinstance(count, (int, float)) and count >= 1:
        label = "comorbidity" if count == 1 else "comorbidities"
        risk_factors.append(f"{int(count)} {label}")
    if d.get("age_group") in ("61-75", "75+"):
        risk_factors.append(f"Older age group ({d['age_group']})")
    if not risk_factors:
        risk_factors.append("No major risk factors detected")

    return RiskDashboardResponse(
        risk_score=max(0, min(100, round((1 - risk_prob) * 100))),
        risk_category=risk_cat,
        risk_probability=round(risk_prob, 4),
        branch_comparison=branch_comparison,
        feature_contributions=feature_contributions,
        risk_factors=risk_factors,
    )
