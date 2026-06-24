import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useAlert } from '@/context/AlertContext';
import { derivedFeaturesToOrgans } from '@/lib/organRiskMap';
import { predictFusion, TimeoutError, NetworkError, ApiError } from '@/services/api';
import type { PatientInput, PredictionResponse } from '@/types/api';
import type { DigitalTwinData, OrganHealth } from '@/constants/health';

type ScenarioContextValue = {
  /** The input that produced the baseline prediction (from form submit). */
  baselineInput: PatientInput | null;
  /** The baseline prediction result. */
  baselinePrediction: PredictionResponse | null;
  /** The dashboard-ready data derived from the baseline. */
  baselineData: DigitalTwinData | null;
  /** Current what-if input (starts as a clone of baseline). */
  scenarioInput: PatientInput | null;
  /** Current what-if prediction result. */
  scenarioPrediction: PredictionResponse | null;
  /** Organs derived from the scenario prediction for the avatar. */
  scenarioOrgans: Record<string, OrganHealth>;
  /** True while a scenario prediction is in-flight. */
  loading: boolean;
  /** Run a scenario prediction with the given input. */
  runScenario: (input: PatientInput) => Promise<void>;
  /** Debounced variant for slider-driven changes (fires after 400ms idle). */
  runScenarioDebounced: (input: PatientInput) => void;
  /** Store the baseline after the form submits its prediction. */
  setBaseline: (input: PatientInput, prediction: PredictionResponse, data: DigitalTwinData) => void;
  /** Reset scenario back to baseline. */
  resetScenario: () => void;
};

const ScenarioContext = createContext<ScenarioContextValue | undefined>(undefined);

export function ScenarioProvider({ children }: { children: ReactNode }) {
  const { showAlert } = useAlert();

  const [baselineInput, setBaselineInput] = useState<PatientInput | null>(null);
  const [baselinePrediction, setBaselinePrediction] = useState<PredictionResponse | null>(null);
  const [baselineData, setBaselineData] = useState<DigitalTwinData | null>(null);
  const [scenarioInput, setScenarioInput] = useState<PatientInput | null>(null);
  const [scenarioPrediction, setScenarioPrediction] = useState<PredictionResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Debounce timer ref for slider-driven re-predictions.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scenarioOrgans = useMemo(() => {
    if (!scenarioPrediction) return {};
    return derivedFeaturesToOrgans(scenarioPrediction.derived_features);
  }, [scenarioPrediction]);

  const runScenario = useCallback(
    async (input: PatientInput) => {
      // Clear any pending debounced call.
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }

      setScenarioInput(input);
      setLoading(true);

      try {
        const prediction = await predictFusion(input);
        setScenarioPrediction(prediction);
      } catch (err) {
        if (err instanceof TimeoutError) {
          showAlert({ level: 'warning', title: 'Scenario timed out', message: 'The server took too long. Try adjusting fewer parameters at once.' });
        } else if (err instanceof NetworkError) {
          showAlert({ level: 'critical', title: 'Server unreachable', message: 'Cannot reach the backend. Start the FastAPI server and try again.' });
        } else if (err instanceof ApiError) {
          showAlert({ level: 'warning', title: `Scenario error (${(err as ApiError).status})`, message: String(err.message) });
        } else {
          showAlert({ level: 'critical', title: 'Internal error', message: 'An unexpected error occurred.' });
        }
      } finally {
        setLoading(false);
      }
    },
    [showAlert]
  );

  /**
   * Debounced version for slider-driven changes. The caller passes the new
   * input; the actual API call fires after 400ms of inactivity.
   */
  const runScenarioDebounced = useCallback(
    (input: PatientInput) => {
      setScenarioInput(input);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void runScenario(input);
      }, 400);
    },
    [runScenario]
  );

  const setBaseline = useCallback(
    (input: PatientInput, prediction: PredictionResponse, data: DigitalTwinData) => {
      setBaselineInput(input);
      setBaselinePrediction(prediction);
      setBaselineData(data);
      setScenarioInput({ ...input });
      setScenarioPrediction(prediction);
    },
    []
  );

  const resetScenario = useCallback(() => {
    if (baselineInput && baselinePrediction) {
      setScenarioInput({ ...baselineInput });
      setScenarioPrediction(baselinePrediction);
    }
  }, [baselineInput, baselinePrediction]);

  const value = useMemo<ScenarioContextValue>(
    () => ({
      baselineInput,
      baselinePrediction,
      baselineData,
      scenarioInput,
      scenarioPrediction,
      scenarioOrgans,
      loading,
      runScenario,
      runScenarioDebounced,
      setBaseline,
      resetScenario,
    }),
    [
      baselineInput, baselinePrediction, baselineData,
      scenarioInput, scenarioPrediction, scenarioOrgans,
      loading, runScenario, runScenarioDebounced, setBaseline, resetScenario,
    ]
  );

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

export function useScenario() {
  const context = useContext(ScenarioContext);
  if (!context) {
    throw new Error('useScenario must be used within ScenarioProvider');
  }
  return context;
}
