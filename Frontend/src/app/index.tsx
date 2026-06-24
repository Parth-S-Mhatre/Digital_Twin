import { Redirect } from 'expo-router';

import { LaunchScreen } from '@/components/LaunchScreen';
import { useAuth } from '@/context/AuthContext';
import { AuthScreen } from '@/screens/AuthScreen';

export default function IndexRoute() {
  const { user, initializing, profileComplete } = useAuth();

  if (initializing) {
    return <LaunchScreen />;
  }

  if (user) {
    // If profile isn't complete, send user to onboarding form once.
    if (!profileComplete) {
      return <Redirect href="/form" />;
    }
    return <Redirect href="/dashboard" />;
  }

  return <AuthScreen />;
}
