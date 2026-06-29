import type { AllDiseasePredictionsResponse, NotificationResponse } from '@/types/api';

export type HealthStatus = 'healthy' | 'moderate' | 'warning' | 'critical';
export type HealthNotificationLevel = 'info' | 'warning' | 'critical';

export type HealthNotification = {
  id: string;
  level: HealthNotificationLevel;
  title: string;
  message: string;
  source?: string;
};

export type RiskCategory = 'very-low' | 'low' | 'medium' | 'high' | 'critical';

export type OrganHealth = {
  name: string;
  status: HealthStatus;
  percentage: number; // 0-100 health percentage
  color: string;
};

export type HealthMetrics = {
  overallScore: number; // 0-100
  riskCategory: RiskCategory;
  lastUpdated: string;
  organs: Record<string, OrganHealth>;
  vitals: {
    heartRate: number;
    bloodPressure: string;
    temperature: number;
    oxygenLevel: number;
  };
  trends: {
    metabolic: 'stable' | 'declining' | 'improving';
    cardiovascular: 'stable' | 'declining' | 'improving';
    respiratory: 'stable' | 'declining' | 'improving';
  };
};

export type DigitalTwinData = {
  userId: string;
  metrics: HealthMetrics;
  recommendations: string[];
  riskFactors: string[];
  diseasePredictions?: AllDiseasePredictionsResponse;
  aiNotifications?: NotificationResponse | null;
  notifications?: HealthNotification[];
};

export const HEALTH_STATUS_COLORS = {
  healthy: '#10B981',
  moderate: '#EAB308',
  warning: '#F97316',
  critical: '#EF4444',
} as const;

export const ORGAN_BASE_COLORS: Record<string, string> = {
  brain: '#22C55E',
  heart: '#EF4444',
  lungs: '#14B8A6',
  liver: '#92400E',
  kidneys: '#8B5CF6',
  digestive: '#F97316',
};

export const DEFAULT_ORGANS: Record<string, OrganHealth> = {
  brain: { name: 'Brain', status: 'healthy', percentage: 95, color: '#57B8FF' },
  heart: { name: 'Heart', status: 'healthy', percentage: 88, color: '#66E3B0' },
  lungs: { name: 'Lungs', status: 'healthy', percentage: 90, color: '#70D7FF' },
  liver: { name: 'Liver', status: 'moderate', percentage: 72, color: '#FF845C' },
  kidneys: { name: 'Kidneys', status: 'healthy', percentage: 85, color: '#93DAFF' },
  digestive: { name: 'Digestive', status: 'moderate', percentage: 75, color: '#FFE08A' },
};

export const RISK_CATEGORY_BANDS = [
  'Very low',
  'Low',
  'Medium',
  'High',
  'Critical',
] as const;
