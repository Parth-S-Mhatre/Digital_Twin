import { API_BASE_URL, API_TIMEOUT_MS } from '@/config/api';
import type {
  HealthResponse,
  ModelInfoResponse,
  PatientInput,
  PredictionResponse,
  RecommendationResponse,
  RiskDashboardResponse,
  RiskHistoryResponse,
  DiseasePredictionResponse,
  AllDiseasePredictionsResponse,
  MedicalChatRequest,
  MedicalChatResponse,
  MedicalRecommendationsRequest,
  LLMProviderInfo,
} from '@/types/api';

/**
 * Typed errors so the UI can render the right alert:
 *   - TimeoutError    → "Request timed out"
 *   - NetworkError    → "Can't reach the server"
 *   - ApiError        → backend detail (validation 422 / 4xx / 5xx)
 */
export class TimeoutError extends Error {
  constructor(message = 'Request timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class NetworkError extends Error {
  constructor(message = 'Unable to reach the server') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;
  constructor(status: number, detail: unknown, message?: string) {
    super(message ?? (typeof detail === 'string' ? detail : `Request failed (${status})`));
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

type FetchOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
};

/**
 * Core fetch wrapper with AbortController timeout. Normalizes failures into
 * the three typed errors above.
 */
async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { method = 'GET', body, timeoutMs = API_TIMEOUT_MS, signal: externalSignal } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Honour an externally supplied signal too (e.g. component unmount).
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      let parsed: unknown = undefined;
      try {
        parsed = await response.json();
      } catch {
        // Non-JSON body (e.g. reverse-proxy HTML); fall through with undefined.
      }
      // FastAPI errors come as { detail: string | array }; surface a readable message.
      const message = extractDetailMessage(parsed) ?? `Request failed (${response.status})`;
      throw new ApiError(response.status, parsed, message);
    }

    return (await response.json()) as T;
  } catch (err) {
    // Re-throw our own errors untouched.
    if (err instanceof ApiError) throw err;

    // Distinguish abort-from-timeout vs a network failure.
    if (err instanceof DOMException && err.name === 'AbortError') {
      // If the external signal triggered the abort, it's not a timeout.
      if (externalSignal?.aborted) {
        throw new NetworkError('Request cancelled');
      }
      throw new TimeoutError();
    }
    if (err instanceof TypeError) {
      // fetch() throws TypeError on network/DNS failure.
      throw new NetworkError();
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractDetailMessage(parsed: unknown): string | undefined {
  if (!parsed || typeof parsed !== 'object') return undefined;
  const detail = (parsed as { detail?: unknown }).detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    // Pydantic 422 validation error → "age: ensure this value is greater than 0"
    const first = detail[0] as { loc?: unknown[]; msg?: string } | undefined;
    const field = Array.isArray(first?.loc) ? first.loc[first.loc.length - 1] : undefined;
    return field ? `${field}: ${first?.msg ?? 'invalid value'}` : first?.msg;
  }
  return undefined;
}

/* --------------------------------- Endpoints -------------------------------- */

export function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/health');
}

export function getModelInfo(): Promise<ModelInfoResponse> {
  return apiFetch<ModelInfoResponse>('/model-info');
}

/**
 * Primary prediction endpoint. Flat `PatientInput` body → `PredictionResponse`.
 * (Mirrors `POST /predict/fusion` — the recommended entry point per main.py.)
 */
export function predictFusion(input: PatientInput): Promise<PredictionResponse> {
  return apiFetch<PredictionResponse>('/predict/fusion', { method: 'POST', body: input });
}

/* ----------------------- Visualization & Recommendations ---------------------- */

/**
 * Chart-ready dashboard payload: branch comparison bars, top SHAP feature
 * contributions (waterfall), 0-100 risk score, and risk category.
 */
export function getRiskDashboard(input: PatientInput): Promise<RiskDashboardResponse> {
  return apiFetch<RiskDashboardResponse>('/visuals/risk-dashboard', {
    method: 'POST',
    body: input,
  });
}

/**
 * SHAP-prioritized, actionable health recommendations with rationale, steps,
 * and expected impact. Replaces the client-side heuristic strings.
 */
export function getRecommendations(input: PatientInput): Promise<RecommendationResponse> {
  return apiFetch<RecommendationResponse>('/recommendations', {
    method: 'POST',
    body: input,
  });
}

/**
 * Time-series of past predictions for trend charts. Reads from Firestore
 * (users/{uid}/predictions), which `savePrediction()` writes after each call.
 */
export function getRiskHistory(userId: string, limit = 50): Promise<RiskHistoryResponse> {
  return apiFetch<RiskHistoryResponse>(`/visuals/risk-history/${userId}?limit=${limit}`);
}

/* ----------------------- Disease Prediction Endpoints ---------------------- */

export function predictCardiovascular(input: PatientInput): Promise<DiseasePredictionResponse> {
  return apiFetch<DiseasePredictionResponse>('/predict/cardiovascular', { method: 'POST', body: input });
}

export function predictDiabetes(input: PatientInput): Promise<DiseasePredictionResponse> {
  return apiFetch<DiseasePredictionResponse>('/predict/diabetes', { method: 'POST', body: input });
}

export function predictHeartDisease(input: PatientInput): Promise<DiseasePredictionResponse> {
  return apiFetch<DiseasePredictionResponse>('/predict/heart-disease', { method: 'POST', body: input });
}

export function predictAllDiseases(input: PatientInput): Promise<AllDiseasePredictionsResponse> {
  return apiFetch<AllDiseasePredictionsResponse>('/predict/all-diseases', { method: 'POST', body: input });
}

/* ----------------------- Medical AI Chatbot Endpoints ---------------------- */

export function medicalChat(input: MedicalChatRequest): Promise<MedicalChatResponse> {
  return apiFetch<MedicalChatResponse>('/medical-chat', { method: 'POST', body: input });
}

export function getMedicalRecommendations(
  input: MedicalRecommendationsRequest
): Promise<MedicalChatResponse> {
  return apiFetch<MedicalChatResponse>('/medical-recommendations', { method: 'POST', body: input });
}

export function getLLMProviders(): Promise<LLMProviderInfo[]> {
  return apiFetch<LLMProviderInfo[]>('/medical-ai/providers');
}
