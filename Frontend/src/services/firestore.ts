import { getFirestore, doc, getDoc, serverTimestamp, setDoc, deleteDoc, collection, addDoc } from 'firebase/firestore';

import type { AuthUser } from '@/services/authService';
import { getFirebaseApp, isFirebaseReady } from '@/services/firebase';
import { DEFAULT_PATIENT_PROFILE, type PatientProfile, mergeProfile } from '@/constants/profile';
import type { PredictionResponse } from '@/types/api';

type FirestoreUserRecord = {
  uid: string;
  name: string;
  email: string;
  provider: AuthUser['provider'];
  photoURL?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  lastLoginAt?: unknown;
};

const USERS_COLLECTION = 'users';
const PROFILE_SUBCOLLECTION = 'profile';
const CURRENT_PROFILE_DOC = 'current';

function getDb() {
  const app = getFirebaseApp();
  if (!app) {
    return null;
  }

  return getFirestore(app);
}

export function isFirestoreReady() {
  return isFirebaseReady() && Boolean(getDb());
}

export async function upsertUserRecord(user: AuthUser) {
  const db = getDb();
  if (!db) {
    return;
  }

  const userRef = doc(db, USERS_COLLECTION, user.id);
  const snapshot = await getDoc(userRef);
  const payload: FirestoreUserRecord = {
    uid: user.id,
    name: user.name,
    email: user.email,
    provider: user.provider,
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  };

  if (user.photoURL) {
    payload.photoURL = user.photoURL;
  }

  if (!snapshot.exists()) {
    payload.createdAt = serverTimestamp();
  }

  await setDoc(userRef, payload, { merge: true });
}

export async function saveUserProfile(userId: string, profile: PatientProfile) {
  const db = getDb();
  if (!db) {
    return;
  }

  const profileRef = doc(db, USERS_COLLECTION, userId, PROFILE_SUBCOLLECTION, CURRENT_PROFILE_DOC);
  const normalized = mergeProfile(DEFAULT_PATIENT_PROFILE, profile);

  await setDoc(
    profileRef,
    {
      profile: normalized,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function loadUserProfile(userId: string): Promise<PatientProfile | null> {
  const db = getDb();
  if (!db) {
    return null;
  }

  const profileRef = doc(db, USERS_COLLECTION, userId, PROFILE_SUBCOLLECTION, CURRENT_PROFILE_DOC);
  const snapshot = await getDoc(profileRef);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data() as { profile?: Partial<PatientProfile> } | undefined;
  if (!data?.profile) {
    return null;
  }

  return mergeProfile(DEFAULT_PATIENT_PROFILE, data.profile);
}

export async function clearUserProfile(userId: string) {
  const db = getDb();
  if (!db) {
    return;
  }

  const profileRef = doc(db, USERS_COLLECTION, userId, PROFILE_SUBCOLLECTION, CURRENT_PROFILE_DOC);
  await deleteDoc(profileRef);
}

/* --------------------------- Prediction History ---------------------------- */

const PREDICTIONS_SUBCOLLECTION = 'predictions';

/**
 * Persist a prediction result so the backend's `/visuals/risk-history`
 * endpoint can read it for trend charts.  Called after each successful
 * `/predict/fusion` call.  Silent no-op when Firestore is unavailable.
 */
export async function savePrediction(userId: string, prediction: PredictionResponse) {
  const db = getDb();
  if (!db) {
    return;
  }

  const collectionRef = collection(db, USERS_COLLECTION, userId, PREDICTIONS_SUBCOLLECTION);

  await addDoc(collectionRef, {
    risk_probability: prediction.risk_probability,
    risk_category: probabilityToCategory(prediction.risk_probability),
    branch_scores: {
      xgboost: prediction.model_outputs.xgboost_probability ?? null,
      bilstm: prediction.model_outputs.bilstm_probability ?? null,
      fusion: prediction.model_outputs.fusion_probability ?? null,
    },
    predicted_class: prediction.predicted_class,
    threshold: prediction.threshold,
    derived_features: prediction.derived_features,
    timestamp: new Date().toISOString(),
    createdAt: serverTimestamp(),
  });
}

/** Local mirror of the backend's risk-band thresholds. */
function probabilityToCategory(p: number): string {
  if (p >= 0.8) return 'critical';
  if (p >= 0.6) return 'high';
  if (p >= 0.4) return 'medium';
  if (p >= 0.2) return 'low';
  return 'very-low';
}
