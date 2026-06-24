import { Platform } from 'react-native';

export const firebaseEnv = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

export const googleOAuthEnv = {
  clientId: process.env.EXPO_PUBLIC_FIREBASE_CLIENT_ID ?? '',
  iosClientId: process.env.EXPO_PUBLIC_FIREBASE_IOS_CLIENT_ID ?? '',
  androidClientId: process.env.EXPO_PUBLIC_FIREBASE_ANDROID_CLIENT_ID ?? '',
  webClientId: process.env.EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID ?? '',
};

export function isFirebaseEnvConfigured() {
  return Boolean(
    firebaseEnv.apiKey &&
      firebaseEnv.authDomain &&
      firebaseEnv.projectId &&
      firebaseEnv.storageBucket &&
      firebaseEnv.messagingSenderId &&
      firebaseEnv.appId
  );
}

export function isGoogleSignInConfigured() {
  if (Platform.OS === 'web') {
    return isFirebaseEnvConfigured();
  }

  if (Platform.OS === 'ios') {
    return Boolean(googleOAuthEnv.iosClientId || googleOAuthEnv.webClientId);
  }

  // Android needs both: Android client for the auth session + Web client for the ID token.
  return Boolean(googleOAuthEnv.androidClientId && googleOAuthEnv.webClientId);
}
