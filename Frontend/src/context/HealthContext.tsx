import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { DigitalTwinData, OrganHealth } from '@/constants/health';
import { useAuth } from '@/context/AuthContext';
import { fetchHealthMetrics } from '@/services/healthService';
import { profileToPatientInput } from '@/lib/patientMapping';

function isCancelledError(err: unknown) {
  return err instanceof Error && /cancelled|canceled/i.test(err.message);
}

type HealthContextValue = {
  data: DigitalTwinData | null;
  loading: boolean;
  error: string | null;
  refreshHealth: () => Promise<void>;
  setHealthData: (data: DigitalTwinData) => void;
  updateOrganStatus: (
    organName: string,
    status: OrganHealth
  ) => Promise<void>;
};

const HealthContext = createContext<HealthContextValue | undefined>(undefined);

export function HealthProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const userId = user?.id;
  const [data, setData] = useState<DigitalTwinData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshHealth = useCallback(async () => {
    if (!userId || !profile) {
      setData(null);
      setError('Complete the model inputs to generate a prediction.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const healthData = await fetchHealthMetrics(userId, profile);
      setData(healthData);
    } catch (err) {
      if (isCancelledError(err)) {
        return;
      }
      setData(null);
      setError(err instanceof Error ? err.message : 'Failed to fetch health data');
      console.error('Health fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, profile]);

  const setHealthData = useCallback((next: DigitalTwinData) => {
    setData(next);
    setError(null);
  }, []);

  const updateOrganStatus = useCallback(
    async (organName: string, status: OrganHealth) => {
      if (!userId || !data) return;

      try {
        const updated: DigitalTwinData = {
          ...data,
          metrics: {
            ...data.metrics,
            organs: {
              ...data.metrics.organs,
              [organName]: status,
            },
          },
        };
        setData(updated);
        // Persist to backend if needed
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update organ status');
      }
    },
    [userId, data]
  );

  useEffect(() => {
    if (!userId) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    if (!profile || !profileToPatientInput(profile)) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    void refreshHealth();
  }, [userId, profile, refreshHealth]);

  const value = useMemo<HealthContextValue>(
    () => ({
      data,
      loading,
      error,
      refreshHealth,
      setHealthData,
      updateOrganStatus,
    }),
    [data, loading, error, refreshHealth, setHealthData, updateOrganStatus]
  );

  return <HealthContext.Provider value={value}>{children}</HealthContext.Provider>;
}

export function useHealth() {
  const context = useContext(HealthContext);
  if (!context) {
    throw new Error('useHealth must be used within HealthProvider');
  }
  return context;
}
