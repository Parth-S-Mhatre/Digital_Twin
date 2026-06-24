import { Redirect } from 'expo-router';

import { LaunchScreen } from '@/components/LaunchScreen';
import { RegisterScreen } from '@/screens/RegisterScreen';
import { useAuth } from '@/context/AuthContext';

export default function RegisterRoute() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return <LaunchScreen />;
  }

  if (user) {
    return <Redirect href="/form" />;
  }

  return <RegisterScreen />;
}
