import { Redirect } from 'expo-router';

import { LaunchScreen } from '@/components/LaunchScreen';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { useAuth } from '@/context/AuthContext';

export default function DashboardRoute() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return <LaunchScreen />;
  }

  if (!user) {
    return <Redirect href="/" />;
  }

  return <DashboardScreen />;
}
