#!/usr/bin/env python3
"""Branch-level model capability checks for the hybrid digital twin.

This script is meant to be run after training. It loads the backend service,
feeds a few representative patient profiles into the tabular, BiLSTM, and
fusion branches, and prints a compact disagreement report.

Use this to spot overconfidence, calibration drift, or feature-mapping bugs
before wiring a new model artifact into the API.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable


PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = PROJECT_ROOT / "Backend"
if str(BACKEND_ROOT) not in __import__("sys").path:
    __import__("sys").path.insert(0, str(BACKEND_ROOT))

from app.schemas import PatientInput, Sex, SmokingStatus  # noqa: E402
from app.services import DigitalTwinService  # noqa: E402


@dataclass
class SampleCase:
    name: str
    patient: PatientInput


def build_sample_cases() -> list[SampleCase]:
    return [
        SampleCase(
            name="Healthy baseline",
            patient=PatientInput(
                age=35,
                sex=Sex.male,
                bmi=23.0,
                physical_activity=1,
                diet_quality=4,
                smoking_status=SmokingStatus.never,
                alcohol_consumption=0,
                medical_history_diabetes=0,
                medical_history_hypertension=0,
                medical_history_heart_disease=0,
                blood_pressure_systolic=120,
                blood_pressure_diastolic=73,
                cholesterol_level=0,
                glucose_level=0,
            ),
        ),
        SampleCase(
            name="Moderate risk",
            patient=PatientInput(
                age=52,
                sex=Sex.male,
                bmi=28.4,
                physical_activity=0,
                diet_quality=2,
                smoking_status=SmokingStatus.former,
                alcohol_consumption=1,
                medical_history_diabetes=0,
                medical_history_hypertension=1,
                medical_history_heart_disease=0,
                blood_pressure_systolic=138,
                blood_pressure_diastolic=88,
                cholesterol_level=2,
                glucose_level=1,
            ),
        ),
        SampleCase(
            name="High risk",
            patient=PatientInput(
                age=68,
                sex=Sex.male,
                bmi=34.7,
                physical_activity=0,
                diet_quality=1,
                smoking_status=SmokingStatus.current,
                alcohol_consumption=1,
                medical_history_diabetes=1,
                medical_history_hypertension=1,
                medical_history_heart_disease=1,
                blood_pressure_systolic=162,
                blood_pressure_diastolic=96,
                cholesterol_level=3,
                glucose_level=3,
            ),
        ),
    ]


def summarize_case(service: DigitalTwinService, case: SampleCase) -> dict[str, object]:
    xgb = service.predict(case.patient, "xgboost")
    bilstm = service.predict(case.patient, "bilstm")
    fusion = service.predict(case.patient, "fusion")

    return {
        "case": case.name,
        "derived_features": fusion.derived_features,
        "xgboost_probability": round(float(xgb.tabular_probability), 6),
        "xgboost_label": xgb.tabular_prediction,
        "bilstm_probability": round(float(bilstm.bilstm_probability), 6),
        "bilstm_label": bilstm.bilstm_prediction,
        "fusion_probability": round(float(fusion.fusion_probability), 6),
        "fusion_label": fusion.fusion_prediction,
        "branch_gap": round(abs(float(xgb.tabular_probability) - float(bilstm.bilstm_probability)), 6),
        "overconfidence_flag": bool(
            float(bilstm.bilstm_probability) > 0.9 and float(xgb.tabular_probability) < 0.5
        ),
    }


def print_report(rows: Iterable[dict[str, object]]) -> None:
    for row in rows:
        print(f"\n=== {row['case']} ===")
        print(json.dumps(row, indent=2, default=str))


def main() -> None:
    service = DigitalTwinService()
    rows = [summarize_case(service, case) for case in build_sample_cases()]
    print_report(rows)

    overconfident = [row for row in rows if row["overconfidence_flag"]]
    if overconfident:
        print(
            "\nWARNING: BiLSTM is overconfident on at least one low-risk sample. "
            "Retraining with stronger regularization and post-hoc calibration is recommended."
        )


if __name__ == "__main__":
    main()
