import { useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { exchangeGoogleToken } from './api';

WebBrowser.maybeCompleteAuthSession();
export function useGoogleSignIn(onSuccess: () => void) {
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  });
  useEffect(() => {
    if (response?.type === 'success' && response.authentication?.idToken)
      void exchangeGoogleToken(response.authentication.idToken)
        .then(onSuccess)
        .catch(() => undefined);
  }, [onSuccess, response]);
  return { ready: !!request, signIn: () => promptAsync() };
}
