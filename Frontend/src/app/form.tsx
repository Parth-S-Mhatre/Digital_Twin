import { Redirect, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { FormScreen } from '@/screens/FormScreen';

export default function FormRoute() {
  const { user, initializing } = useAuth();
  const params = useLocalSearchParams();

  if (initializing) return null;

  if (!user) {
    return <Redirect href="/" />;
  }

  const mode = params.mode === 'profile' ? 'profile' : 'onboarding';

  return <FormScreen mode={mode} />;
}
