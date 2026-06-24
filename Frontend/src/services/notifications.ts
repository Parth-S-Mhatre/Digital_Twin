import { Platform } from 'react-native';

import type { DigitalTwinData } from '@/constants/health';
import * as nativeNotifications from './notifications.impl';

export type DemoNotification = {
  title: string;
  body: string;
  level: 'info' | 'warning' | 'critical';
};

export async function configureNotificationChannel() {
  if (Platform.OS === 'web') {
    return;
  }

  await nativeNotifications.configureNotificationChannel();
}

export async function ensureNotificationPermission() {
  if (Platform.OS === 'web') {
    return false;
  }

  return nativeNotifications.ensureNotificationPermission();
}

export function buildDemoNotification(data: DigitalTwinData): DemoNotification {
  if (Platform.OS === 'web') {
    return {
      level: 'info',
      title: 'Web demo notification',
      body: `System popups are enabled on mobile. On web, this stays as an in-app demo for ${data.metrics.overallScore} score.`,
    };
  }

  return nativeNotifications.buildDemoNotification(data);
}

export async function sendDemoHealthNotification(data: DigitalTwinData) {
  if (Platform.OS === 'web') {
    return false;
  }

  return nativeNotifications.sendDemoHealthNotification(data);
}
