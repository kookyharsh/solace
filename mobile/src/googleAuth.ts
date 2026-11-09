import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { mergeGuestWithGoogle } from './api';

WebBrowser.maybeCompleteAuthSession();

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

const currentClientId =
  Platform.OS === 'android' ? androidClientId : Platform.OS === 'ios' ? iosClientId : webClientId;

export const googleSignInConfigured = Boolean(currentClientId || webClientId);

export function useGoogleSignIn(
  onMergeStart: () => boolean,
  onSuccess: () => void,
  onFailure: (errorMessage?: string) => void,
) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
    {
      clientId: webClientId,
      webClientId,
      androidClientId,
      iosClientId,
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
          mergeGuestWithGoogle(idToken)
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
      // User closed browser sheet without signing in — reset state cleanly without error alert
      onFailure(undefined);
    }
  }, [onFailure, onMergeStart, onSuccess, response]);

  return {
    ready: !!request,
    signIn: async () => {
      processingRef.current = false;
      return promptAsync();
    },
  };
}
