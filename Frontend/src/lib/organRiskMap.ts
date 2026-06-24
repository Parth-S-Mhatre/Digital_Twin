import {
  DEFAULT_ORGANS,
  HEALTH_STATUS_COLORS,
  type OrganHealth,
  type HealthStatus,
} from '@/constants/health';
import type { DerivedFeatures } from '@/types/api';

/**
 * Heuristic mapping of server-derived features onto the avatar's organs.
 *
 * The model emits a single disease-risk probability plus categorical
 * `derived_features` (bp_status, bmi_category, glucose, smoking, …). It does
 * NOT produce per-organ health. This module translates those signals into the
 * `OrganHealth` shape the avatar/dashboard already render, so the body visibly
 * responds as scenario inputs change.
 *
 * Each organ gets a `percentage` (0-100 health, higher = healthier) derived
 * from the most relevant feature(s), then a status band + color.
 */

type HealthLevel = 'healthy' | 'moderate' | 'warning' | 'critical';

const SEVERITY_ORDER: HealthLevel[] = ['healthy', 'moderate', 'warning', 'critical'];

function bandForPercentage(pct: number): HealthLevel {
  if (pct >= 80) return 'healthy';
  if (pct >= 60) return 'moderate';
  if (pct >= 40) return 'warning';
  return 'critical';
}

function worse(a: HealthLevel, b: HealthLevel): HealthLevel {
  return SEVERITY_ORDER.indexOf(a) >= SEVERITY_ORDER.indexOf(b) ? a : b;
}

function organ(name: string, percentage: number, override?: HealthLevel): OrganHealth {
  const status: HealthStatus = override ?? bandForPercentage(percentage);
  return {
    name,
    status,
    percentage: Math.round(percentage),
    color: HEALTH_STATUS_COLORS[status as keyof typeof HEALTH_STATUS_COLORS],
  };
}

/**
 * Map derived features → per-organ health. Falls back to DEFAULT_ORGANS for
 * anything we can't infer, so the avatar is never empty.
 */
export function derivedFeaturesToOrgans(derived: DerivedFeatures): Record<string, OrganHealth> {
  const organs: Record<string, OrganHealth> = {
    brain: { ...DEFAULT_ORGANS.brain },
    heart: { ...DEFAULT_ORGANS.heart },
    lungs: { ...DEFAULT_ORGANS.lungs },
    liver: { ...DEFAULT_ORGANS.liver },
    kidneys: { ...DEFAULT_ORGANS.kidneys },
    digestive: { ...DEFAULT_ORGANS.digestive },
  };

  // Blood pressure status → cardiovascular organs.
  // Normal / Elevated / Stage1_HTN / Stage2_HTN
  const bp = derived.bp_status as string;
  if (bp) {
    let heartPct = 90;
    let kidneyPct = 90;
    if (bp === 'Stage2_HTN') {
      heartPct = 48;
      kidneyPct = 52;
    } else if (bp === 'Stage1_HTN') {
      heartPct = 62;
      kidneyPct = 66;
    } else if (bp === 'Elevated') {
      heartPct = 76;
      kidneyPct = 80;
    }
    organs.heart = organ('Heart', heartPct);
    organs.kidneys = organ('Kidneys', kidneyPct);
  }

  // BMI category → metabolic-load organs.
  const bmi = derived.bmi_category as string;
  if (bmi) {
    let liverPct = 88;
    let digestivePct = 86;
    if (bmi === 'Obese') {
      liverPct = 52;
      digestivePct = 58;
    } else if (bmi === 'Overweight') {
      liverPct = 70;
      digestivePct = 74;
    } else if (bmi === 'Underweight') {
      liverPct = 78;
      digestivePct = 72;
    }
    organs.liver = organ('Liver', liverPct);
    organs.digestive = organ('Digestive', digestivePct);
  }

  // Glucose ordinal (0-3) → metabolic organs. The raw value rides alongside
  // derived_features; we read it defensively in case it's echoed back.
  const glucose = Number(derived.glucose_level);
  if (Number.isFinite(glucose)) {
    // 0 optimal → 3 worst. Penalty of ~12pts per ordinal step.
    const g = Math.max(0, Math.min(3, glucose));
    const digestivePct = 88 - g * 12;
    organs.digestive = organ('Digestive', Math.min(digestivePct, organs.digestive.percentage));
  }

  // Smoking → lungs + heart.
  const smoking = derived.smoking_status as string;
  if (smoking === 'Current') {
    organs.lungs = organ('Lungs', 58, worse('warning', bandForPercentage(58)));
    organs.heart = organ(
      'Heart',
      organs.heart.percentage - 8,
      worse(organs.heart.status as HealthLevel, 'moderate')
    );
  } else if (smoking === 'Former') {
    organs.lungs = organ('Lungs', 74);
  }

  // Comorbidities + age → brain/cognitive reserve.
  const comorbidities = Number(derived.comorbidity_count) || 0;
  const ageGroup = derived.age_group as string;
  let brainPct = 92;
  brainPct -= comorbidities * 8;
  if (ageGroup === '75+') brainPct -= 16;
  else if (ageGroup === '61-75') brainPct -= 8;
  organs.brain = organ('Brain', brainPct);

  return organs;
}
