import { Redirect } from 'expo-router';

import { LaunchScreen } from '@/components/LaunchScreen';
import { LoginScreen } from '@/screens/LoginScreen';
import { useAuth } from '@/context/AuthContext';

export default function LoginRoute() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return <LaunchScreen />;
  }

  if (user) {
    return <Redirect href="/form" />;
  }

  return <LoginScreen />;
}
