import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  initializeAuth,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  signInWithCredential,
  type User,
} from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { firebaseEnv, isFirebaseEnvConfigured } from '@/config/authEnv';

WebBrowser.maybeCompleteAuthSession();

const firebaseConfig = firebaseEnv;
const hasRequiredConfig = isFirebaseEnvConfigured();

let authInstance: ReturnType<typeof getAuth> | null = null;
let firebaseApp: FirebaseApp | null = null;

type AsyncStorageLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

function createReactNativePersistence(storage: AsyncStorageLike) {
  return class {
    type = 'LOCAL' as const;

    async _isAvailable() {
      try {
        if (!storage) {
          return false;
        }

        await storage.setItem('__firebase_auth__', '1');
        await storage.removeItem('__firebase_auth__');
        return true;
      } catch {
        return false;
      }
    }

    _set(key: string, value: unknown) {
      return storage.setItem(key, JSON.stringify(value));
    }

    async _get(key: string) {
      const json = await storage.getItem(key);
      return json ? JSON.parse(json) : null;
    }

    _remove(key: string) {
      return storage.removeItem(key);
    }

    _addListener() {
      return;
    }

    _removeListener() {
      return;
    }
  };
}

export function isFirebaseReady() {
  return hasRequiredConfig;
}

export function getFirebaseApp() {
  if (!hasRequiredConfig) {
    return null;
  }

  if (firebaseApp) {
    return firebaseApp;
  }

  firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return firebaseApp;
}

export function getFirebaseAuth() {
  if (!hasRequiredConfig) {
    return null;
  }

  if (authInstance) {
    return authInstance;
  }

  const app = getFirebaseApp();
  if (!app) {
    return null;
  }

  if (Platform.OS === 'web') {
    authInstance = getAuth(app);
    return authInstance;
  }

  try {
    // Keep auth sessions stable on React Native with AsyncStorage persistence.
    authInstance = initializeAuth(app, {
      persistence: createReactNativePersistence(ReactNativeAsyncStorage) as never,
    });
  } catch {
    authInstance = getAuth(app);
  }

  return authInstance;
}

export function watchFirebaseAuthState(handler: (user: User | null) => void) {
  const auth = getFirebaseAuth();
  if (!auth) {
    return () => undefined;
  }

  return onAuthStateChanged(auth, handler);
}

export async function firebaseLogin(email: string, password: string) {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Firebase is not configured yet.');
  }
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function firebaseRegister(name: string, email: string, password: string) {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Firebase is not configured yet.');
  }

  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (name.trim()) {
    await updateProfile(credential.user, { displayName: name.trim() });
  }
  return credential;
}

export async function firebaseLoginWithGoogle(idToken: string) {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Firebase is not configured yet.');
  }

  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, credential);
}

export async function firebaseLoginWithGooglePopup() {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Firebase is not configured yet.');
  }

  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

export async function firebaseLogout() {
  const auth = getFirebaseAuth();
  if (!auth) {
    return;
  }
  await signOut(auth);
}
