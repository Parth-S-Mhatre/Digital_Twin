import type { DigitalTwinData } from '@/constants/health';

export type DemoNotification = {
  title: string;
  body: string;
  level: 'info' | 'warning' | 'critical';
};

export function configureNotificationChannel() {
  return Promise.resolve();
}

export function ensureNotificationPermission() {
  return Promise.resolve(false);
}

export function buildDemoNotification(data: DigitalTwinData): DemoNotification {
  return {
    level: 'info',
    title: 'Web demo notification',
    body: `System popups are enabled on mobile. On web, this stays as an in-app demo for ${data.metrics.overallScore} score.`,
  };
}

export async function sendDemoHealthNotification() {
  return false;
}
