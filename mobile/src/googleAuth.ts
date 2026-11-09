import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { exchangeGoogleToken, mergeGuestWithGoogle } from './api';

WebBrowser.maybeCompleteAuthSession();

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

const currentClientId =
  Platform.OS === 'android' ? androidClientId : Platform.OS === 'ios' ? iosClientId : webClientId;

export const googleSignInConfigured = Boolean(currentClientId || webClientId);

// Safe fallbacks to prevent Google.useIdTokenAuthRequest from throwing invariantClientId error during render
const safeWebClientId = webClientId || 'google-auth-placeholder.apps.googleusercontent.com';
const safeAndroidClientId = androidClientId || webClientId || safeWebClientId;
const safeIosClientId = iosClientId || webClientId || safeWebClientId;

export function useGoogleSignIn(
  onMergeStart: () => boolean,
  onSuccess: () => void,
  onFailure: (errorMessage?: string) => void,
  mode: 'merge' | 'signIn' = 'merge',
) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
    {
      clientId: safeWebClientId,
      webClientId: safeWebClientId,
      androidClientId: safeAndroidClientId,
      iosClientId: safeIosClientId,
    },
    {
      scheme: 'solace',
    },
  );

  const processingRef = useRef(false);

  useEffect(() => {
    if (!response) return;

    if (response.type === 'success') {
      const idToken = response.params?.id_token || response.authentication?.idToken;

      if (idToken) {
        if (!processingRef.current && onMergeStart()) {
          processingRef.current = true;
          const authAction = mode === 'signIn' ? exchangeGoogleToken(idToken) : mergeGuestWithGoogle(idToken);
          authAction
            .then(() => {
              processingRef.current = false;
              onSuccess();
            })
            .catch((err: unknown) => {
              processingRef.current = false;
              const msg = err instanceof Error ? err.message : 'Google sign-in failed';
              onFailure(msg);
            });
        }
      } else if (!response.params?.code) {
        onFailure('No ID token received from Google');
      }
    } else if (response.type === 'error') {
      onFailure(response.error?.message || 'Google sign-in was interrupted');
    } else if (response.type === 'dismiss' || response.type === 'cancel') {
      // User closed browser sheet without signing in — reset cleanly
      onFailure(undefined);
    }
  }, [mode, onFailure, onMergeStart, onSuccess, response]);

  return {
    ready: !!request && googleSignInConfigured,
    signIn: async () => {
      if (!googleSignInConfigured) {
        throw new Error('Google Sign-In is not configured in this environment.');
      }
      processingRef.current = false;
      return promptAsync();
    },
  };
}
