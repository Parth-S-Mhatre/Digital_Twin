import { useCallback } from 'react';
import { Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

import { googleOAuthEnv, isGoogleSignInConfigured } from '@/config/authEnv';

WebBrowser.maybeCompleteAuthSession();

export function useGoogleAuth() {
  const configured = isGoogleSignInConfigured();

  const [, , promptAsync] = Google.useIdTokenAuthRequest({
    clientId: googleOAuthEnv.clientId,
    iosClientId: googleOAuthEnv.iosClientId,
    androidClientId: googleOAuthEnv.androidClientId,
    webClientId: googleOAuthEnv.webClientId,
  });

  const getIdToken = useCallback(async () => {
    if (!configured) {
      throw new Error(
        Platform.OS === 'android'
          ? 'Google sign-in needs EXPO_PUBLIC_FIREBASE_ANDROID_CLIENT_ID and EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID.'
          : 'Google sign-in is not configured yet.'
      );
    }

    const result = await promptAsync();

    if (result.type !== 'success') {
      throw new Error('Google sign-in was cancelled or failed.');
    }

    const idToken =
      result.params.id_token ??
      (result as { authentication?: { idToken?: string } }).authentication?.idToken;

    if (!idToken) {
      throw new Error('Google sign-in did not return an ID token.');
    }

    return idToken;
  }, [configured, promptAsync]);

  return {
    configured,
    getIdToken,
  };
}
