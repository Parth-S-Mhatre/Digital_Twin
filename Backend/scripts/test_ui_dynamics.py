#!/usr/bin/env python3
"""Simulate user-style UI updates and inspect branch dynamics.

This script is meant to answer a practical question:
when a user changes a few form values in the frontend, do the tabular,
BiLSTM, and fusion branches move smoothly, or do they spike unpredictably?

Usage examples:

  python scripts/test_ui_dynamics.py
  python scripts/test_ui_dynamics.py --input-json '{"age":35,...}'
  python scripts/test_ui_dynamics.py --sequence-json sequence.json

The default profile matches a realistic dashboard-style "healthy baseline"
sample from the UI. The default sequence then makes a few user-like changes
so you can observe the model response across steps.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = PROJECT_ROOT / "Backend"

import sys

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.schemas import PatientInput, Sex, SmokingStatus  # noqa: E402
from app.services import DigitalTwinService  # noqa: E402


DEFAULT_PROFILE: dict[str, Any] = {
    "age": 35,
    "sex": "Male",
    "bmi": 23.0,
    "physical_activity": 1,
    "diet_quality": 4,
    "smoking_status": "Never",
    "alcohol_consumption": 0,
    "medical_history_diabetes": 0,
    "medical_history_hypertension": 0,
    "medical_history_heart_disease": 0,
    "blood_pressure_systolic": 120,
    "blood_pressure_diastolic": 73,
    "cholesterol_level": 0,
    "glucose_level": 0,
}

DEFAULT_SEQUENCE = [
    ("baseline", {}),
    (
        "better lifestyle",
        {
            "physical_activity": 1,
            "diet_quality": 5,
            "blood_pressure_systolic": 116,
            "blood_pressure_diastolic": 70,
        },
    ),
    (
        "higher cardiometabolic load",
        {
            "age": 45,
            "bmi": 27.8,
            "physical_activity": 0,
            "diet_quality": 2,
            "blood_pressure_systolic": 138,
            "blood_pressure_diastolic": 88,
            "cholesterol_level": 2,
            "glucose_level": 1,
        },
    ),
    (
        "high risk swing",
        {
            "age": 62,
            "bmi": 32.4,
            "physical_activity": 0,
            "diet_quality": 1,
            "smoking_status": "Current",
            "alcohol_consumption": 1,
            "medical_history_hypertension": 1,
            "blood_pressure_systolic": 162,
            "blood_pressure_diastolic": 96,
            "cholesterol_level": 3,
            "glucose_level": 3,
        },
    ),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input-json",
        help="A single PatientInput JSON blob to use as the starting profile.",
    )
    parser.add_argument(
        "--sequence-json",
        help="A JSON file with a list of {label, patch} objects to apply over time.",
    )
    return parser.parse_args()


def load_profile(args: argparse.Namespace) -> dict[str, Any]:
    if args.input_json:
        return json.loads(args.input_json)
    return dict(DEFAULT_PROFILE)


def load_sequence(args: argparse.Namespace):
    if args.sequence_json:
        payload = json.loads(Path(args.sequence_json).read_text())
        return [(item["label"], item.get("patch", {})) for item in payload]
    return list(DEFAULT_SEQUENCE)


def to_patient_input(payload: dict[str, Any]) -> PatientInput:
    return PatientInput(
        age=payload["age"],
        sex=Sex(payload["sex"]),
        bmi=payload["bmi"],
        physical_activity=payload["physical_activity"],
        diet_quality=payload["diet_quality"],
        smoking_status=SmokingStatus(payload["smoking_status"]),
        alcohol_consumption=payload["alcohol_consumption"],
        medical_history_diabetes=payload["medical_history_diabetes"],
        medical_history_hypertension=payload["medical_history_hypertension"],
        medical_history_heart_disease=payload["medical_history_heart_disease"],
        blood_pressure_systolic=payload["blood_pressure_systolic"],
        blood_pressure_diastolic=payload["blood_pressure_diastolic"],
        cholesterol_level=payload["cholesterol_level"],
        glucose_level=payload["glucose_level"],
    )


@dataclass
class StepResult:
    label: str
    xgboost_probability: float
    bilstm_probability: float
    fusion_probability: float
    xgboost_prediction: int
    bilstm_prediction: int
    fusion_prediction: int
    derived_features: dict[str, Any]


def run_step(service: DigitalTwinService, label: str, payload: dict[str, Any]) -> StepResult:
    patient = to_patient_input(payload)
    xgb = service.predict(patient, "xgboost")
    bilstm = service.predict(patient, "bilstm")
    fusion = service.predict(patient, "fusion")

    return StepResult(
        label=label,
        xgboost_probability=float(xgb.tabular_probability),
        bilstm_probability=float(bilstm.bilstm_probability),
        fusion_probability=float(fusion.fusion_probability),
        xgboost_prediction=int(xgb.tabular_prediction),
        bilstm_prediction=int(bilstm.bilstm_prediction),
        fusion_prediction=int(fusion.fusion_prediction),
        derived_features=fusion.derived_features,
    )


def print_step(payload: dict[str, Any], result: StepResult, prev: StepResult | None) -> None:
    print(f"\n=== {result.label} ===")
    print(json.dumps(payload, indent=2))
    print(
        json.dumps(
            {
                "xgboost_probability": round(result.xgboost_probability, 6),
                "bilstm_probability": round(result.bilstm_probability, 6),
                "fusion_probability": round(result.fusion_probability, 6),
                "xgboost_prediction": result.xgboost_prediction,
                "bilstm_prediction": result.bilstm_prediction,
                "fusion_prediction": result.fusion_prediction,
                "derived_features": result.derived_features,
            },
            indent=2,
            default=str,
        )
    )

    if prev is not None:
        print(
            json.dumps(
                {
                    "delta_xgboost": round(result.xgboost_probability - prev.xgboost_probability, 6),
                    "delta_bilstm": round(result.bilstm_probability - prev.bilstm_probability, 6),
                    "delta_fusion": round(result.fusion_probability - prev.fusion_probability, 6),
                    "gap_xgb_bilstm": round(abs(result.xgboost_probability - result.bilstm_probability), 6),
                },
                indent=2,
            )
        )


def main() -> None:
    args = parse_args()
    service = DigitalTwinService()

    current = load_profile(args)
    prev_result: StepResult | None = None

    # First, show the baseline input exactly as the UI would send it.
    sequence = load_sequence(args)
    for label, patch in sequence:
        step_payload = dict(current)
        step_payload.update(patch)
        result = run_step(service, label, step_payload)
        print_step(step_payload, result, prev_result)
        prev_result = result
        current = step_payload


if __name__ == "__main__":
    main()
