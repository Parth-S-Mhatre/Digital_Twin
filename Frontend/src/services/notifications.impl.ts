import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { DigitalTwinData } from '@/constants/health';

type NotificationsModule = typeof import('expo-notifications');

let notificationsModule: NotificationsModule | null = null;
let handlerConfigured = false;
let channelConfigured = false;

function isNotificationsAvailable() {
  // Remote notifications were removed from Expo Go in SDK 53+.
  return Constants.appOwnership !== 'expo';
}

async function getNotifications() {
  if (!isNotificationsAvailable()) {
    return null;
  }

  if (!notificationsModule) {
    notificationsModule = await import('expo-notifications');
  }

  if (!handlerConfigured) {
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    handlerConfigured = true;
  }

  return notificationsModule;
}

export async function configureNotificationChannel() {
  const Notifications = await getNotifications();
  if (!Notifications || Platform.OS !== 'android' || channelConfigured) {
    return;
  }

  await Notifications.setNotificationChannelAsync('health-alerts', {
    name: 'Health Alerts',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#EF4444',
  });

  channelConfigured = true;
}

export async function ensureNotificationPermission() {
  const Notifications = await getNotifications();
  if (!Notifications) {
    return false;
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }

  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

export type DemoNotification = {
  title: string;
  body: string;
  level: 'info' | 'warning' | 'critical';
};

export function buildDemoNotification(data: DigitalTwinData): DemoNotification {
  const { metrics } = data;

  if (metrics.vitals.oxygenLevel < 95) {
    return {
      level: 'critical',
      title: 'Low oxygen alert',
      body: `SpO2 is ${metrics.vitals.oxygenLevel}%. Please review the patient immediately.`,
    };
  }

  if (metrics.vitals.heartRate < 60 || metrics.vitals.heartRate > 100) {
    return {
      level: 'warning',
      title: 'Heart rate alert',
      body: `Heart rate is ${metrics.vitals.heartRate} bpm. This is a demo system notification.`,
    };
  }

  const abnormalOrgan = Object.values(metrics.organs).find((organ) => organ.status !== 'healthy');
  if (abnormalOrgan) {
    return {
      level: abnormalOrgan.status === 'critical' ? 'critical' : 'warning',
      title: `${abnormalOrgan.name} needs attention`,
      body: `${abnormalOrgan.percentage}% health detected. This popup stands in for the future chatbot alert.`,
    };
  }

  return {
    level: 'info',
    title: 'Digital twin update',
    body: `Overall score is ${metrics.overallScore}. Everything is within the demo range.`,
  };
}

export async function sendDemoHealthNotification(data: DigitalTwinData) {
  const Notifications = await getNotifications();
  if (!Notifications) {
    return false;
  }

  const permissionGranted = await ensureNotificationPermission();
  if (!permissionGranted) {
    return false;
  }

  await configureNotificationChannel();

  const notification = buildDemoNotification(data);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: notification.title,
      body: notification.body,
      data: { level: notification.level, source: 'digital-twin-demo' },
      sound: false,
    },
    trigger: Platform.OS === 'android' ? { channelId: 'health-alerts' } : null,
  });

  return true;
}
