import { useEffect } from 'react';
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
export const googleSignInConfigured = Boolean(currentClientId);

export function useGoogleSignIn(
  onMergeStart: () => boolean,
  onSuccess: () => void,
  onFailure: () => void,
) {
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId,
    androidClientId,
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
