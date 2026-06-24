import { Redirect } from 'expo-router';

import { LaunchScreen } from '@/components/LaunchScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { useAuth } from '@/context/AuthContext';

export default function ProfileRoute() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return <LaunchScreen />;
  }

  if (!user) {
    return <Redirect href="/" />;
  }

  return <ProfileScreen />;
}
