import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { getStoredSession, login as authLogin, logout as authLogout, register as authRegister } from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    (async () => {
      const stored = await getStoredSession();
      setSession(stored);
      setInitializing(false);
    })();
  }, []);

  const value = useMemo(
    () => ({
      initializing,
      session,
      user: session?.user ?? null,
      login: async (credentials) => {
        const nextSession = await authLogin(credentials);
        setSession(nextSession);
        return nextSession;
      },
      register: async (payload) => {
        const nextSession = await authRegister(payload);
        setSession(nextSession);
        return nextSession;
      },
      logout: async () => {
        await authLogout();
        setSession(null);
      },
    }),
    [initializing, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}

