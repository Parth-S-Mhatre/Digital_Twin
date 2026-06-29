import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as Haptics from 'expo-haptics';

import type { DigitalTwinData, OrganHealth } from '@/constants/health';
import { useAuth } from '@/context/AuthContext';
import { fetchHealthMetrics } from '@/services/healthService';
import { profileToPatientInput } from '@/lib/patientMapping';
import { schedulePeriodicHealthNotifications, cancelAllScheduledNotifications } from '@/services/notifications';

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
  const hasContext = Boolean(userId && profile);

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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    if (!hasContext || !profileToPatientInput(profile)) {
      return;
    }

    const timer = setTimeout(() => {
      void refreshHealth();
    }, 0);

    return () => clearTimeout(timer);
  }, [hasContext, profile, refreshHealth]);

  useEffect(() => {
    if (data) {
      void schedulePeriodicHealthNotifications(data);
    }

    return () => {
      void cancelAllScheduledNotifications();
    };
  }, [data]);

  const effectiveData = hasContext ? data : null;
  const effectiveLoading = hasContext ? loading : false;
  const effectiveError = hasContext ? error : null;

  const value = useMemo<HealthContextValue>(
    () => ({
      data: effectiveData,
      loading: effectiveLoading,
      error: effectiveError,
      refreshHealth,
      setHealthData,
      updateOrganStatus,
    }),
    [effectiveData, effectiveLoading, effectiveError, refreshHealth, setHealthData, updateOrganStatus]
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
