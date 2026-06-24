import { Redirect } from 'expo-router';

import { useAuth } from '@/context/AuthContext';

export default function ExploreRoute() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return null;
  }

  if (!user) {
    return <Redirect href="/" />;
  }

  return <Redirect href="/dashboard" />;
}
