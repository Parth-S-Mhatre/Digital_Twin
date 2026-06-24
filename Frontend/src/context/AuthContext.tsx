import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  loginWithGoogle as loginWithGoogleRequest,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  subscribeAuthState,
  type AuthUser,
} from '@/services/authService';
import {
  clearUserProfile,
  isFirestoreReady,
  loadUserProfile,
  saveUserProfile,
  upsertUserRecord,
} from '@/services/firestore';
import {
  DEFAULT_PATIENT_PROFILE,
  mergeProfile,
  type PatientProfile,
} from '@/constants/profile';

type AuthContextValue = {
  user: AuthUser | null;
  initializing: boolean;
  profile: PatientProfile | null;
  profileInitializing: boolean;
  profileComplete: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken?: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  registerWithGoogle: (idToken?: string) => Promise<void>;
  saveProfile: (profile: PatientProfile) => Promise<void>;
  clearProfile: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const profileStoragePrefix = 'digital-twin-profile';

function getProfileStorageKey(user: AuthUser | null) {
  return `${profileStoragePrefix}:${user?.id ?? 'guest'}`;
}

function serializeProfile(profile: PatientProfile) {
  return JSON.stringify(profile);
}

function deserializeProfile(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as PatientProfile;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [profileInitializing, setProfileInitializing] = useState(true);

  useEffect(() => {
    let active = true;

    const loadProfile = async (currentUser: AuthUser | null) => {
      setProfileInitializing(true);

      if (!currentUser) {
        if (active) {
          setProfile(null);
          setProfileInitializing(false);
        }
        return;
      }

      if (isFirestoreReady() && currentUser.provider === 'firebase') {
        let firestoreProfile: PatientProfile | null = null;
        try {
          await upsertUserRecord(currentUser);
          firestoreProfile = await loadUserProfile(currentUser.id);
        } catch (error) {
          console.warn('Firestore profile load failed, falling back to cache.', error);
        }

        const cachedProfile = deserializeProfile(
          await AsyncStorage.getItem(getProfileStorageKey(currentUser))
        );
        const nextProfile = mergeProfile(DEFAULT_PATIENT_PROFILE, firestoreProfile ?? cachedProfile);

        if (active) {
          setProfile(nextProfile);
          setProfileInitializing(false);
        }
        return;
      }

      const stored = await AsyncStorage.getItem(getProfileStorageKey(currentUser));
      const nextProfile = mergeProfile(DEFAULT_PATIENT_PROFILE, deserializeProfile(stored));

      if (active) {
        setProfile(nextProfile);
        setProfileInitializing(false);
      }
    };

    const unsubscribe = subscribeAuthState((currentUser) => {
      setUser(currentUser);
      setInitializing(false);
      void loadProfile(currentUser);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      profile,
      profileInitializing,
      profileComplete: Boolean(profile && Object.values(profile).every((item) => item.trim().length > 0)),
      login: async (email: string, password: string) => {
        const currentUser = await loginRequest({ email, password });
        setUser(currentUser);
      },
      loginWithGoogle: async (idToken?: string) => {
        const currentUser = await loginWithGoogleRequest(idToken);
        if (currentUser) {
          setUser(currentUser);
        }
      },
      register: async (name: string, email: string, password: string) => {
        const currentUser = await registerRequest({
          name,
          email,
          password,
        });
        setUser(currentUser);
        try {
          await upsertUserRecord(currentUser);
        } catch (error) {
          console.warn('Firestore user record write failed after register.', error);
        }
      },
      registerWithGoogle: async (idToken?: string) => {
        const currentUser = await loginWithGoogleRequest(idToken);
        if (currentUser) {
          setUser(currentUser);
          try {
            await upsertUserRecord(currentUser);
          } catch (error) {
            console.warn('Firestore user record write failed after Google sign-in.', error);
          }
        }
      },
      saveProfile: async (nextProfile: PatientProfile) => {
        if (!user) {
          throw new Error('You must be signed in to save your profile.');
        }

        const mergedProfile = mergeProfile(DEFAULT_PATIENT_PROFILE, nextProfile);
        setProfile(mergedProfile);

        if (isFirestoreReady() && user.provider === 'firebase') {
          try {
            await upsertUserRecord(user);
            await saveUserProfile(user.id, mergedProfile);
          } catch (error) {
            console.warn('Firestore profile save failed, falling back to AsyncStorage.', error);
          }
        }

        await AsyncStorage.setItem(getProfileStorageKey(user), serializeProfile(mergedProfile));
      },
      clearProfile: async () => {
        if (user && isFirestoreReady() && user.provider === 'firebase') {
          try {
            await clearUserProfile(user.id);
          } catch (error) {
            console.warn('Firestore profile clear failed.', error);
          }
        }

        if (user) {
          await AsyncStorage.removeItem(getProfileStorageKey(user));
        }
        setProfile(null);
      },
      logout: async () => {
        await logoutRequest();
        setUser(null);
        setProfile(null);
      },
    }),
    [user, initializing, profile, profileInitializing]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
