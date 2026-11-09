import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { mergeGuestWithGoogle } from './api';

WebBrowser.maybeCompleteAuthSession();
const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
export const googleSignInConfigured = Boolean(Platform.OS === 'ios' ? iosClientId : googleClientId);

export function useGoogleSignIn(
  onMergeStart: () => boolean,
  onSuccess: () => void,
  onFailure: () => void,
) {
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: googleClientId,
    androidClientId: googleClientId,
    iosClientId,
  });
  useEffect(() => {
    if (response?.type === 'success' && response.authentication?.idToken) {
      if (onMergeStart())
        void mergeGuestWithGoogle(response.authentication.idToken).then(onSuccess).catch(onFailure);
    } else if (response?.type === 'error' || response?.type === 'success') {
      onFailure();
    }
  }, [onFailure, onMergeStart, onSuccess, response]);
  return { ready: !!request, signIn: () => promptAsync() };
}
