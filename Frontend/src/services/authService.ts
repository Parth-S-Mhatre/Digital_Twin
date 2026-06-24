import type { User } from 'firebase/auth';
import { Platform } from 'react-native';

import {
  firebaseLogin,
  firebaseLoginWithGoogle,
  firebaseLoginWithGooglePopup,
  firebaseLogout,
  firebaseRegister,
  isFirebaseReady,
  watchFirebaseAuthState,
} from '@/services/firebase';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  provider: 'firebase' | 'local';
  photoURL?: string;
};

type LoginPayload = {
  email: string;
  password: string;
};

type RegisterPayload = {
  name: string;
  email: string;
  password: string;
};

type StoredUser = AuthUser & {
  password: string;
};

const seededUsers: StoredUser[] = [
  {
    id: 'demo-user',
    name: 'Demo User',
    email: 'demo@digitaltwin.ai',
    password: 'demo1234',
    provider: 'local',
  },
];

const state = {
  users: [...seededUsers],
  currentUser: null as AuthUser | null,
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toPublicUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    provider: user.provider,
  };
}

function mapFirebaseUser(user: User): AuthUser {
  return {
    id: user.uid,
    name: user.displayName || user.email?.split('@')[0] || 'User',
    email: user.email || '',
    provider: 'firebase',
    photoURL: user.photoURL || undefined,
  };
}

export function isFirebaseAuthEnabled() {
  return isFirebaseReady();
}

export function subscribeAuthState(onChange: (user: AuthUser | null) => void) {
  if (isFirebaseReady()) {
    return watchFirebaseAuthState((user) => {
      onChange(user ? mapFirebaseUser(user) : null);
    });
  }

  const timer = setTimeout(() => {
    onChange(state.currentUser);
  }, 150);

  return () => clearTimeout(timer);
}

export async function login({ email, password }: LoginPayload) {
  if (isFirebaseReady()) {
    const credential = await firebaseLogin(email, password);
    return mapFirebaseUser(credential.user);
  }

  await wait(400);
  const normalizedEmail = email.trim().toLowerCase();
  const user = state.users.find(
    (item) => item.email.toLowerCase() === normalizedEmail && item.password === password
  );

  if (!user) {
    throw new Error('Invalid email or password.');
  }

  state.currentUser = toPublicUser(user);
  return state.currentUser;
}

export async function register({ name, email, password }: RegisterPayload) {
  if (isFirebaseReady()) {
    const credential = await firebaseRegister(name, email, password);
    return mapFirebaseUser(credential.user);
  }

  await wait(450);
  const normalizedEmail = email.trim().toLowerCase();

  if (state.users.some((item) => item.email.toLowerCase() === normalizedEmail)) {
    throw new Error('An account with this email already exists.');
  }

  const newUser: StoredUser = {
    id: `user-${Date.now()}`,
    name: name.trim(),
    email: normalizedEmail,
    password,
    provider: 'local',
  };

  state.users.push(newUser);
  state.currentUser = toPublicUser(newUser);
  return state.currentUser;
}

export async function loginWithGoogle(idToken?: string) {
  if (!isFirebaseReady()) {
    throw new Error('Firebase is not configured yet.');
  }

  if (Platform.OS === 'web') {
    const credential = await firebaseLoginWithGooglePopup();
    return mapFirebaseUser(credential.user);
  }

  if (!idToken) {
    throw new Error('No Google ID token provided.');
  }

  const credential = await firebaseLoginWithGoogle(idToken);
  return mapFirebaseUser(credential.user);
}

export async function logout() {
  if (isFirebaseReady()) {
    await firebaseLogout();
    return;
  }

  await wait(100);
  state.currentUser = null;
}
