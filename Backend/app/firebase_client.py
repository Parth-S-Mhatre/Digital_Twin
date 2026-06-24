"""Firebase Admin SDK client for reading prediction history.

The **frontend** writes prediction records to Firestore
(`users/{uid}/predictions/{docId}`) after each `/predict/fusion` call.
This module provides a read-only interface for the backend to retrieve
that history for trend visualization.

Firebase Admin uses a service account key (not the web SDK config).
If the credential file is not available, reads return empty gracefully
so the rest of the API remains functional.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

from .schemas import RiskCategory, RiskHistoryPoint, RiskHistoryResponse

logger = logging.getLogger("digital_twin")

# ---------------------------------------------------------------------------
# Lazy-initialised singleton
# ---------------------------------------------------------------------------

_db = None
_firestore = None
_firebase_available = False


def _get_db() -> Any:
    """Return the Firestore client, or None if Firebase is not configured."""
    global _db, _firestore, _firebase_available

    if _db is not None or not _firebase_available:
        return _db

    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        # Look for the service account key in several locations
        cred_paths = [
            Path(os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")),
            Path(__file__).resolve().parents[2] / "serviceAccountKey.json",
            Path(__file__).resolve().parents[2] / "Backend" / "serviceAccountKey.json",
        ]

        cred_file = None
        for p in cred_paths:
            if p.exists() and p.is_file():
                cred_file = str(p)
                break

        if cred_file:
            cred = credentials.Certificate(cred_file)
        else:
            # Fall back to Application Default Credentials
            cred = credentials.ApplicationDefault()

        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)

        _db = firestore.client()
        logger.info("Firebase Admin SDK initialized (Firestore reads enabled)")
        return _db

    except Exception:
        logger.warning(
            "Firebase Admin SDK not available — risk history endpoint will "
            "return empty results. Set GOOGLE_APPLICATION_CREDENTIALS or "
            "place serviceAccountKey.json in the project root.",
            exc_info=True,
        )
        _firebase_available = True  # Don't retry
        return None


def get_prediction_history(
    user_id: str,
    limit: int = 50,
) -> RiskHistoryResponse:
    """Fetch prediction history from Firestore for a given user.

    Expected Firestore structure (written by the frontend):
        users/{user_id}/predictions/{docId}
        → {
            "risk_probability": float,
            "risk_category": str,
            "branch_scores": {xgboost: float, bilstm: float, fusion: float},
            "timestamp": ISO string,
            "derived_features": {...}
          }

    Returns an empty list if Firebase is unavailable or no records exist.
    """
    db = _get_db()
    if db is None:
        return RiskHistoryResponse(
            user_id=user_id,
            predictions=[],
            trend="stable",
        )

    try:
        collection_ref = (
            db.collection("users")
            .document(user_id)
            .collection("predictions")
            .order_by("timestamp", direction="DESCENDING")
            .limit(limit)
        )
        docs = collection_ref.stream()

        points: list[RiskHistoryPoint] = []
        for doc in docs:
            data = doc.to_dict()
            risk_prob = float(data.get("risk_probability", 0.0))
            risk_cat_str = data.get("risk_category", "low")
            timestamp = data.get("timestamp", "")

            # Validate risk category
            try:
                risk_cat = RiskCategory(risk_cat_str)
            except ValueError:
                risk_cat = RiskCategory.low

            points.append(RiskHistoryPoint(
                date=timestamp,
                risk_probability=round(risk_prob, 4),
                risk_category=risk_cat,
                branch_scores={
                    k: round(float(v), 4)
                    for k, v in data.get("branch_scores", {}).items()
                },
            ))

        # Determine trend
        trend = _compute_trend([p.risk_probability for p in points])

        earliest = points[-1].date if points else None
        latest = points[0].date if points else None

        return RiskHistoryResponse(
            user_id=user_id,
            predictions=points,
            trend=trend,
            earliest_date=earliest,
            latest_date=latest,
        )

    except Exception:
        logger.warning(
            "Failed to read prediction history from Firestore for user %s",
            user_id,
            exc_info=True,
        )
        return RiskHistoryResponse(
            user_id=user_id,
            predictions=[],
            trend="stable",
        )


def _compute_trend(probabilities: list[float]) -> str:
    """Classify the risk trend from a chronological list (newest first)."""
    if len(probabilities) < 2:
        return "stable"

    # Compare recent (first third) to older (last third)
    n = len(probabilities)
    recent = probabilities[: max(1, n // 3)]
    older = probabilities[-max(1, n // 3):]

    recent_avg = sum(recent) / len(recent)
    older_avg = sum(older) / len(older)

    diff = recent_avg - older_avg
    if diff > 0.05:
        return "declining"  # risk is increasing
    if diff < -0.05:
        return "improving"  # risk is decreasing
    return "stable"
