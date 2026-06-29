import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AlertHost } from '@/components/AlertHost';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AlertProvider } from '@/context/AlertContext';
import { AuthProvider } from '@/context/AuthContext';
import { HealthProvider } from '@/context/HealthContext';
import { ScenarioProvider } from '@/context/ScenarioContext';
import { configureNotificationChannel } from '../services/notifications';

export default function RootLayout() {
  useEffect(() => {
    void configureNotificationChannel();
  }, []);

  return (
    <ErrorBoundary>
      {/* GestureHandlerRootView enables the Slider (gesture-based) and is the
          recommended root wrapper for react-native-gesture-handler. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <AlertProvider>
            <HealthProvider>
              <ScenarioProvider>
                <Stack screenOptions={{ 
                  headerShown: false,
                  animation: 'slide_from_right',
                  animationDuration: 300,
                }}>
                  {/* Explicit scenario screen registration so typed routes
                      pick it up cleanly (file-based routes auto-register too). */}
                  <Stack.Screen name="scenario" options={{ animation: 'fade' }}/>
                </Stack>
              </ScenarioProvider>
            </HealthProvider>
          {/* AlertHost renders stacked toasts above everything. */}
          <AlertHost />
          </AlertProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
