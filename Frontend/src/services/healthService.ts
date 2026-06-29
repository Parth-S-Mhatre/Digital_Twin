import { predictFusion, predictAllDiseases, generateNotifications, NetworkError, TimeoutError } from '@/services/api';
import { savePrediction } from '@/services/firestore';
import type { DigitalTwinData, HealthMetrics } from '@/constants/health';
import type { PatientProfile } from '@/constants/profile';
import { predictionToDigitalTwinData, profileToPatientInput } from '@/lib/patientMapping';

/**
 * Build dashboard-ready health data from the saved profile by calling the real
 * backend prediction endpoint. This keeps the dashboard tied to the trained
 * model instead of a local demo fixture.
 *
 * Also persists the prediction to Firestore so the `/visuals/risk-history`
 * backend endpoint can read it for trend charts.
 */
export async function fetchHealthMetrics(userId: string, profile: PatientProfile): Promise<DigitalTwinData> {
  const input = profileToPatientInput(profile);
  if (!input) {
    throw new Error('Complete the clinical model inputs to generate a prediction.');
  }

  try {
    // Wait for predictions first, then generate notifications with the results
    const [prediction, diseasePredictions] = await Promise.all([
      predictFusion(input),
      predictAllDiseases(input),
    ]);
    
    // Generate notifications after we have the disease predictions
    const aiNotifications = await generateNotifications({
      patient_data: input,
      diabetes_risk: diseasePredictions?.diabetes?.risk_probability,
    }).catch(() => null);

    // Persist prediction history for trend charts (fire-and-forget, non-blocking).
    // savePrediction is a silent no-op if Firestore isn't configured.
    void savePrediction(userId, prediction).catch(() => {
      // Swallow — history persistence must not break the primary flow.
    });

    return predictionToDigitalTwinData(prediction, profile, userId, diseasePredictions, aiNotifications);
  } catch (error) {
    // Surface typed API failures with their messages; callers decide how to render them.
    if (error instanceof TimeoutError || error instanceof NetworkError || error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch health data');
  }
}

export function summarizeHealthMetrics(metrics: HealthMetrics) {
  return {
    overallScore: metrics.overallScore,
    riskCategory: metrics.riskCategory,
    organCount: Object.keys(metrics.organs).length,
  };
}
