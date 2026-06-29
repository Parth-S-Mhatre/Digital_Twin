
import { DiseasePredictionResponse, DiseaseType } from './api';

export type BodyComponentId =
  | 'heart'
  | 'blood-vessels'
  | 'pancreas-liver'
  | 'kidneys'
  | 'lungs'
  | 'brain';

export type BodyComponent = {
  id: BodyComponentId;
  name: string;
  icon: string;
  description: string;
  associatedDiseases: DiseaseType[];
  defaultColor: string;
};

export const BODY_COMPONENTS: Record<BodyComponentId, BodyComponent> = {
  heart: {
    id: 'heart',
    name: 'Heart',
    icon: '❤️',
    description: 'Cardiovascular health and function',
    associatedDiseases: ['cardiovascular', 'heart_disease'],
    defaultColor: '#EF4444',
  },
  'blood-vessels': {
    id: 'blood-vessels',
    name: 'Blood Vessels',
    icon: '🩸',
    description: 'Circulatory system health',
    associatedDiseases: ['cardiovascular'],
    defaultColor: '#DC2626',
  },
  'pancreas-liver': {
    id: 'pancreas-liver',
    name: 'Pancreas & Liver',
    icon: '🫀',
    description: 'Metabolic and digestive health',
    associatedDiseases: ['diabetes'],
    defaultColor: '#84CC16',
  },
  kidneys: {
    id: 'kidneys',
    name: 'Kidneys',
    icon: '🫘',
    description: 'Filtration and fluid balance',
    associatedDiseases: ['cardiovascular'],
    defaultColor: '#3B82F6',
  },
  lungs: {
    id: 'lungs',
    name: 'Lungs',
    icon: '🫁',
    description: 'Respiratory function and health',
    associatedDiseases: [],
    defaultColor: '#60A5FA',
  },
  brain: {
    id: 'brain',
    name: 'Brain',
    icon: '🧠',
    description: 'Neurological health and cognitive function',
    associatedDiseases: ['cardiovascular'],
    defaultColor: '#8B5CF6',
  },
} as const;

export function getComponentRisk(
  component: BodyComponent,
  predictions: Record<DiseaseType, DiseasePredictionResponse>
): { risk: number; status: 'low' | 'medium' | 'high' | 'critical' } {
  const diseaseRisks = component.associatedDiseases.map(
    (disease) => predictions[disease]?.risk_probability ?? 0
  );

  const avgRisk = diseaseRisks.length > 0
    ? diseaseRisks.reduce((sum, r) => sum + r, 0) / diseaseRisks.length
    : 0;

  let status: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (avgRisk >= 0.8) status = 'critical';
  else if (avgRisk >= 0.6) status = 'high';
  else if (avgRisk >= 0.4) status = 'medium';

  return { risk: avgRisk * 100, status };
}

export function getStatusColor(status: string) {
  switch (status) {
    case 'critical':
      return '#DC2626';
    case 'high':
      return '#F97316';
    case 'medium':
      return '#EAB308';
    case 'low':
      return '#22C55E';
    default:
      return '#22C55E';
  }
}
