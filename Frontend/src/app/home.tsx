import { Redirect } from 'expo-router';

import { useAuth } from '@/context/AuthContext';

export default function HomeRoute() {
  const { user, initializing, profileComplete } = useAuth();

  if (initializing) {
    return null;
  }

  if (!user) {
    return <Redirect href="/" />;
  }

  return <Redirect href={profileComplete ? '/dashboard' : '/form'} />;
}
