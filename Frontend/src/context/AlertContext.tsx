import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type AlertLevel = 'info' | 'warning' | 'critical';

export type AppAlert = {
  id: string;
  level: AlertLevel;
  title: string;
  message?: string;
  /** When false (default), auto-dismiss after the level's timeout. */
  sticky?: boolean;
  /** Optional action button rendered on the alert. */
  action?: { label: string; onPress: () => void };
};

type ShowAlertInput = Omit<AppAlert, 'id'> & { id?: string };

type AlertContextValue = {
  alerts: AppAlert[];
  showAlert: (input: ShowAlertInput) => string;
  dismissAlert: (id: string) => void;
  clearAlerts: () => void;
};

const AlertContext = createContext<AlertContextValue | undefined>(undefined);

const AUTO_DISMISS_MS: Record<AlertLevel, number> = {
  info: 4_000,
  warning: 5_000,
  // Critical alerts stay until the user dismisses them (sticky by default).
  critical: Infinity,
};

let counter = 0;
function nextId(): string {
  counter += 1;
  return `alert-${Date.now()}-${counter}`;
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<AppAlert[]>([]);
  // Track timers so dismissal/clear cancels pending ones.
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissAlert = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setAlerts((current) => current.filter((a) => a.id !== id));
  }, []);

  const showAlert = useCallback(
    (input: ShowAlertInput) => {
      const id = input.id ?? nextId();
      const alert: AppAlert = {
        id,
        level: input.level,
        title: input.title,
        message: input.message,
        sticky: input.sticky ?? input.level === 'critical',
        action: input.action,
      };

      setAlerts((current) => {
        // Replace an existing alert with the same id instead of duplicating.
        const without = current.filter((a) => a.id !== id);
        return [...without, alert];
      });

      const ttl = AUTO_DISMISS_MS[alert.level];
      if (!alert.sticky && Number.isFinite(ttl)) {
        const timer = setTimeout(() => dismissAlert(id), ttl);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismissAlert]
  );

  const clearAlerts = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current.clear();
    setAlerts([]);
  }, []);

  const value = useMemo<AlertContextValue>(
    () => ({ alerts, showAlert, dismissAlert, clearAlerts }),
    [alerts, showAlert, dismissAlert, clearAlerts]
  );

  return <AlertContext.Provider value={value}>{children}</AlertContext.Provider>;
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within AlertProvider');
  }
  return context;
}
