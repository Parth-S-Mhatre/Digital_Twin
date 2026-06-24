#!/usr/bin/env python3
"""Quick sanity test for the Digital Twin predictions.

Run from the project root:

    python Backend/scripts/test_patients.py

Or open this file in VS Code and press F5 / click "Run Python File".

It feeds several realistic patient profiles into all three branches
(XGBoost, BiLSTM, fusion) and prints a clear report so you can confirm
healthy patients get LOW risk and high-risk patients get HIGH risk.

To add your own patient, copy one of the PatientInput blocks below and
change the values.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

# Make the Backend package importable regardless of where you run from
PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT / "Backend"))

from app.schemas import PatientInput, Sex, SmokingStatus  # noqa: E402
from app.services import DigitalTwinService  # noqa: E402


@dataclass
class Case:
    name: str
    patient: PatientInput


def build_cases() -> list[Case]:
    """Realistic patient profiles spanning low → high risk."""
    return [
        Case(
            name="Healthy 25yo female",
            patient=PatientInput(
                age=25, sex=Sex.female, bmi=21.5, physical_activity=1, diet_quality=5,
                smoking_status=SmokingStatus.never, alcohol_consumption=0,
                medical_history_diabetes=0, medical_history_hypertension=0,
                medical_history_heart_disease=0,
                blood_pressure_systolic=110, blood_pressure_diastolic=70,
                cholesterol_level=0, glucose_level=0,
            ),
        ),
        Case(
            name="Healthy 35yo male",
            patient=PatientInput(
                age=35, sex=Sex.male, bmi=23.0, physical_activity=1, diet_quality=4,
                smoking_status=SmokingStatus.never, alcohol_consumption=0,
                medical_history_diabetes=0, medical_history_hypertension=0,
                medical_history_heart_disease=0,
                blood_pressure_systolic=120, blood_pressure_diastolic=73,
                cholesterol_level=0, glucose_level=0,
            ),
        ),
        Case(
            name="Middle-aged overweight smoker",
            patient=PatientInput(
                age=52, sex=Sex.male, bmi=28.4, physical_activity=0, diet_quality=3,
                smoking_status=SmokingStatus.current, alcohol_consumption=1,
                medical_history_diabetes=0, medical_history_hypertension=1,
                medical_history_heart_disease=0,
                blood_pressure_systolic=142, blood_pressure_diastolic=92,
                cholesterol_level=2, glucose_level=1,
            ),
        ),
        Case(
            name="High-risk 62yo (obese, HTN, smoker)",
            patient=PatientInput(
                age=62, sex=Sex.male, bmi=32.4, physical_activity=0, diet_quality=1,
                smoking_status=SmokingStatus.current, alcohol_consumption=1,
                medical_history_diabetes=0, medical_history_hypertension=1,
                medical_history_heart_disease=0,
                blood_pressure_systolic=162, blood_pressure_diastolic=96,
                cholesterol_level=3, glucose_level=3,
            ),
        ),
        Case(
            name="Very high-risk 68yo (3 comorbidities)",
            patient=PatientInput(
                age=68, sex=Sex.male, bmi=34.7, physical_activity=0, diet_quality=1,
                smoking_status=SmokingStatus.current, alcohol_consumption=1,
                medical_history_diabetes=1, medical_history_hypertension=1,
                medical_history_heart_disease=1,
                blood_pressure_systolic=170, blood_pressure_diastolic=100,
                cholesterol_level=3, glucose_level=3,
            ),
        ),
    ]


def print_case(service: DigitalTwinService, case: Case) -> None:
    result = service.predict(case.patient, "fusion")

    def label(pred: int) -> str:
        return "HIGH" if pred == 1 else "low"

    print(f"\n--- {case.name} ---")
    print(f"  age={case.patient.age}  sex={case.patient.sex.value}  "
          f"bmi={case.patient.bmi}  smoker={case.patient.smoking_status.value}")
    print(f"  bp={case.patient.blood_pressure_systolic}/"
          f"{case.patient.blood_pressure_diastolic}  chol={case.patient.cholesterol_level}  "
          f"gluc={case.patient.glucose_level}")
    print(f"  XGBoost : {result.tabular_probability:.4f}  "
          f"(thr {result.tabular_threshold:.2f}) -> {label(result.tabular_prediction)}")
    print(f"  BiLSTM  : {result.bilstm_probability:.4f}  "
          f"(thr {result.bilstm_threshold:.2f}) -> {label(result.bilstm_prediction)}")
    print(f"  FUSION  : {result.fusion_probability:.4f}  "
          f"(thr {result.fusion_threshold:.2f}) -> {label(result.fusion_prediction)}  <<< final")


def main() -> None:
    print("Loading Digital Twin model …")
    service = DigitalTwinService()
    print("Model loaded. Running test cases:\n")

    cases = build_cases()
    for case in cases:
        print_case(service, case)

    print("\n=== Expected pattern ===")
    print("Risk should INCREASE going down the list:")
    print("  Healthy patients   -> low probability (well under threshold)")
    print("  High-risk patients -> high probability (near or above threshold)")
    print("\nIf BiLSTM/fusion are ~0.99 on healthy rows, the inversion bug is back.")


if __name__ == "__main__":
    main()
