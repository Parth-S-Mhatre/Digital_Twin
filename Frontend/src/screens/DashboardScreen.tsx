import { useRouter } from 'expo-router';
import { useEffect, useMemo, useReducer, useState } from 'react';
import {
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import {
  GlassCard,
  SectionHeader,
} from '@/components/glass';
import { DashboardSkeleton } from '@/components/digital-twin/DashboardSkeleton';
import { useAuth } from '@/context/AuthContext';
import { useHealth } from '@/context/HealthContext';
import { useAlert } from '@/context/AlertContext';
import { useEntranceAnimation } from '@/hooks/useEntranceAnimation';
import { theme } from '@/constants/theme';

const ORGAN_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  brain: 'fitness',
  heart: 'heart',
  lungs: 'medical',
  liver: 'flask',
  kidneys: 'water',
  digestive: 'nutrition',
};

const ORGAN_COLORS: Record<string, string> = {
  brain: '#8B5CF6',
  heart: '#EF4444',
  lungs: '#3B82F6',
  liver: '#F97316',
  kidneys: '#06B6D4',
  digestive: '#10B981',
};

const MEDICATION_NOTES = [
  {
    id: 1,
    title: "Stay Hydrated",
    description: "Drink at least 2 liters of water daily to maintain kidney health",
    priority: "high"
  },
  {
    id: 2,
    title: "Monitor BP",
    description: "Check your blood pressure twice daily and log the results",
    priority: "medium"
  },
  {
    id: 3,
    title: "Healthy Diet",
    description: "Reduce sodium intake and increase fruits and vegetables",
    priority: "high"
  },
  {
    id: 4,
    title: "Regular Exercise",
    description: "30 minutes of moderate exercise 5 times a week",
    priority: "medium"
  }
];

const ORGAN_EXPLANATIONS: Record<string, string> = {
  heart: "Your heart health is determined by your blood pressure, cholesterol levels, and physical activity. Regular exercise helps maintain a healthy heart rate and circulation.",
  lungs: "Lung health depends on your smoking status and respiratory history. Breathing exercises can improve lung capacity over time.",
  liver: "Liver function is influenced by alcohol consumption and diet. A balanced diet with limited processed foods supports liver health.",
  kidneys: "Kidney health is tied to hydration and blood pressure. Stay hydrated and limit sodium intake.",
  brain: "Cognitive health is supported by mental activity, sleep, and a diet rich in omega-3 fatty acids.",
  digestive: "Digestive health relies on a balanced diet with fiber and regular physical activity."
};

export function DashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { data, loading, error, refreshHealth } = useHealth();
  const { showAlert } = useAlert();
  const [slowLoadingTick, bumpSlowLoadingTick] = useReducer((count: number) => count + 1, 0);
  const scrollY = useMemo(() => new Animated.Value(0), []);
  const [selectedOrgan, setSelectedOrgan] = useState<string | null>(null);
  const [organModalVisible, setOrganModalVisible] = useState(false);

  useEffect(() => {
    if (error) {
      showAlert({
        level: 'warning',
        title: 'Could not load health data',
        message: error,
      });
    }
  }, [error, showAlert]);

  useEffect(() => {
    if (!loading || data) return;
    const timer = setTimeout(() => bumpSlowLoadingTick(), 1200);
    return () => clearTimeout(timer);
  }, [data, loading]);

  const showSkeleton = Boolean(error) || (loading && slowLoadingTick > 0);

  const heroStyle = useEntranceAnimation(80);
  const leftStyle = useEntranceAnimation(180);
  const rightStyle = useEntranceAnimation(260);

  // Interpolate scroll animations
  const headerScale = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.9],
    extrapolate: 'clamp',
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.8],
    extrapolate: 'clamp',
  });

  const riskScore = data?.metrics.overallScore ?? 0;
  const riskCategory = data?.metrics.riskCategory ?? 'low';

  const riskColor = useMemo(() => {
    switch (riskCategory) {
      case 'high':
      case 'critical':
        return theme.colors.danger;
      case 'medium':
        return theme.colors.warning;
      default:
        return theme.colors.success;
    }
  }, [riskCategory]);

  const riskLabel = useMemo(() => {
    switch (riskCategory) {
      case 'critical': return 'Critical';
      case 'high': return 'High Risk';
      case 'medium': return 'Moderate';
      case 'low': return 'Good';
      default: return 'Great!';
    }
  }, [riskCategory]);

  const handleSignOut = async () => {
    await logout();
    router.replace('/');
  };

  const handleShareHealthReport = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const html = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
              h1 { color: #007AFF; text-align: center; }
              .section { margin-top: 20px; padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; }
              .risk-score { font-size: 36px; font-weight: bold; text-align: center; margin: 10px 0; }
            </style>
          </head>
          <body>
            <h1>MyHealthTwin - Health Report</h1>
            <p>Date: ${new Date().toLocaleDateString()}</p>
            <div class="section">
              <h2>Health Score</h2>
              <div class="risk-score">${riskScore} / 100</div>
              <p>Risk Category: ${riskLabel}</p>
            </div>
            <div class="section">
              <h2>Medication Notes</h2>
              ${MEDICATION_NOTES.map(note => `
                <div style="margin: 10px 0; padding: 10px; border-left: 3px solid ${note.priority === 'high' ? '#EF4444' : '#EAB308'}">
                  <strong>${note.title}</strong>
                  <p>${note.description}</p>
                </div>
              `).join('')}
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share your Health Report',
      });
    } catch (error) {
      console.error('Error sharing report:', error);
      showAlert({
        level: 'warning',
        title: 'Share failed',
        message: 'Could not share the health report'
      });
    }
  };

  const organs = data?.metrics.organs ?? {};
  const organEntries = Object.entries(organs).slice(0, 6);

  if (!data) {
    return (
      <DashboardSkeleton
        state={error ? 'offline' : loading && showSkeleton ? 'slow' : 'loading'}
        message={
          error
            ? `We could not reach the backend. ${error}`
            : loading && showSkeleton
              ? 'Loading your digital twin...'
              : loading
                ? 'Connecting to your health model...'
                : 'No digital twin data available yet.'
        }
        onRetry={refreshHealth}
      />
    );
  }

  return (
    <LinearGradient
      colors={[theme.colors.backgroundStart, theme.colors.backgroundEnd]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshHealth} />}
          contentContainerStyle={styles.scrollContent}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
        >
          {/* ── Header ── */}
          <Animated.View style={[styles.header, heroStyle, { transform: [{ scale: headerScale }], opacity: headerOpacity }]}>
            <View style={styles.headerLeft}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user?.name?.charAt(0).toUpperCase() ?? 'U'}
                </Text>
              </View>
              <View>
                <Text style={styles.greeting}>
                  Hello, {user?.name?.split(' ')[0] ?? 'there'}! 👋
                </Text>
                <Text style={styles.greetingSub}>{"Here's your health overview"}</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <Pressable style={styles.iconBtn} onPress={refreshHealth}>
                <Ionicons name="notifications-outline" size={22} color={theme.colors.textSecondary} />
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={handleSignOut}>
                <Ionicons name="log-out-outline" size={22} color={theme.colors.textSecondary} />
              </Pressable>
            </View>
          </Animated.View>

          {/* ── Health Score ── */}
          <Animated.View style={[styles.section, leftStyle]}>
            <GlassCard style={styles.scoreCard}>
              <View style={styles.scoreRow}>
                <View style={styles.scoreCircleWrap}>
                  <View style={[styles.scoreCircle, { borderColor: riskColor }]}>
                    <Text style={[styles.scoreNum, { color: riskColor }]}>{riskScore}</Text>
                    <Text style={styles.scoreOf}>/100</Text>
                  </View>
                </View>
                <View style={styles.scoreInfo}>
                  <Text style={styles.scoreTitle}>Health Score</Text>
                  <View style={[styles.riskBadge, { backgroundColor: `${riskColor}18` }]}>
                    <View style={[styles.riskDot, { backgroundColor: riskColor }]} />
                    <Text style={[styles.riskLabel, { color: riskColor }]}>{riskLabel}</Text>
                  </View>
                  <Text style={styles.scoreHint}>
                    {riskScore >= 80
                      ? 'Great shape! Keep it up!'
                      : riskScore >= 60
                        ? 'Keep monitoring your health.'
                        : 'Consider consulting a doctor.'}
                  </Text>
                </View>
              </View>
            </GlassCard>
          </Animated.View>

          {/* ── Body Components ── */}
          <Animated.View style={[styles.section, leftStyle]}>
            <SectionHeader
              title="Body Components"
              subtitle="Your organ health overview"
              rightText="View All"
              onRightPress={() => router.push('/digital-twin')}
            />
            <GlassCard style={styles.bodyCard}>
              <View style={styles.bodyGrid}>
                {/* Digital twin avatar area */}
                <View style={styles.bodyAvatarArea}>
                  <View style={styles.bodyAvatarCircle}>
                    <Ionicons name="body" size={80} color={theme.colors.primary} />
                  </View>
                </View>

                {/* Organ cards - left column */}
                <View style={styles.organLeft}>
                  {organEntries.slice(0, 3).map(([key, organ]) => (
                    <OrganChip
                      key={key}
                      name={organ.name}
                      status={organ.status}
                      iconKey={key}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedOrgan(key);
                        setOrganModalVisible(true);
                      }}
                    />
                  ))}
                </View>

                {/* Organ cards - right column */}
                <View style={styles.organRight}>
                  {organEntries.slice(3, 6).map(([key, organ]) => (
                    <OrganChip
                      key={key}
                      name={organ.name}
                      status={organ.status}
                      iconKey={key}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedOrgan(key);
                        setOrganModalVisible(true);
                      }}
                    />
                  ))}
                </View>
              </View>
            </GlassCard>
          </Animated.View>

          {/* ── Disease Risk ── */}
          {data.diseasePredictions && (
            <Animated.View style={[styles.section, rightStyle]}>
              <SectionHeader title="Disease Risk" subtitle="Predictions for key conditions" />
              <View style={styles.diseaseGrid}>
                <RiskCard
                  label="Cardiovascular"
                  icon="heart"
                  prediction={data.diseasePredictions.cardiovascular}
                />
                <RiskCard
                  label="Diabetes"
                  icon="medical"
                  prediction={data.diseasePredictions.diabetes}
                />
                <RiskCard
                  label="Heart Disease"
                  icon="pulse"
                  prediction={data.diseasePredictions.heart_disease}
                />
              </View>
            </Animated.View>
          )}

          {/* ── Health Insights ── */}
          <Animated.View style={[styles.section, rightStyle]}>
            <SectionHeader title="Health Insights" subtitle="Your current health metrics" rightText="View All" />
            <View style={styles.insightsGrid}>
              <InsightCard
                icon="heart"
                color={theme.colors.danger}
                title="Heart Health"
                status={organs.heart?.status ?? 'healthy'}
                message="Keep monitoring your BP"
              />
              <InsightCard
                icon="nutrition"
                color={theme.colors.warning}
                title="Metabolic"
                status={organs.digestive?.status ?? 'moderate'}
                message="Improve diet & activity"
              />
              <InsightCard
                icon="leaf"
                color={theme.colors.success}
                title="Lifestyle"
                status="healthy"
                message="You're making healthy choices"
              />
            </View>
          </Animated.View>

          {/* ── What-if Scenario ── */}
          <Animated.View style={[styles.section, rightStyle]}>
            <Pressable onPress={() => router.push('/scenario')}>
              <GlassCard style={styles.scenarioCard}>
                <View style={styles.scenarioRow}>
                  <View style={styles.scenarioIcon}>
                    <Ionicons name="options" size={26} color={theme.colors.primary} />
                  </View>
                  <View style={styles.scenarioText}>
                    <Text style={styles.scenarioTitle}>What-if Scenario</Text>
                    <Text style={styles.scenarioSub}>
                      Adjust parameters and see how your health changes
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} />
                </View>
              </GlassCard>
            </Pressable>
          </Animated.View>

          {/* ── Medication Notes Grid ── */}
          <Animated.View style={[styles.section, rightStyle]}>
            <SectionHeader title="Medication & Health Notes" subtitle="Your personalized health guidance" />
            <View style={styles.notesGrid}>
              {MEDICATION_NOTES.map((note) => (
                <GlassCard key={note.id} style={styles.noteCard}>
                  <View style={[
                    styles.notePriorityDot,
                    { backgroundColor: note.priority === 'high' ? theme.colors.danger : theme.colors.warning }
                  ]} />
                  <Text style={styles.noteTitle}>{note.title}</Text>
                  <Text style={styles.noteDescription}>{note.description}</Text>
                </GlassCard>
              ))}
            </View>
          </Animated.View>

          {/* ── Share Report ── */}
          <Animated.View style={[styles.section, rightStyle]}>
            <Pressable onPress={handleShareHealthReport}>
              <GlassCard style={styles.shareCard}>
                <View style={styles.shareRow}>
                  <View style={styles.shareIcon}>
                    <Ionicons name="share-outline" size={24} color={theme.colors.primary} />
                  </View>
                  <View style={styles.shareText}>
                    <Text style={styles.shareTitle}>Share Health Report</Text>
                    <Text style={styles.shareSub}>
                      Export your health report as a PDF
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} />
                </View>
              </GlassCard>
            </Pressable>
          </Animated.View>
        </Animated.ScrollView>

        {/* ── Organ Explainability Modal ── */}
        <Modal
          visible={organModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => {
            setOrganModalVisible(false);
            setSelectedOrgan(null);
          }}
        >
          <View style={modalStyles.overlay}>
            <View style={modalStyles.container}>
              <View style={modalStyles.header}>
                <Text style={modalStyles.headerTitle}>
                  {organs[selectedOrgan!]?.name ?? 'Organ Health'}
                </Text>
                <Pressable
                  style={modalStyles.closeBtn}
                  onPress={() => {
                    setOrganModalVisible(false);
                    setSelectedOrgan(null);
                  }}
                >
                  <Ionicons name="close" size={24} color={theme.colors.textLight} />
                </Pressable>
              </View>
              <ScrollView style={modalStyles.content}>
                <Text style={modalStyles.explanation}>
                  {ORGAN_EXPLANATIONS[selectedOrgan!] ?? 'Learn more about your organ health.'}
                </Text>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

/* ── Sub-components ── */

function OrganChip({
  name,
  status,
  iconKey,
  onPress
}: {
  name: string;
  status: string;
  iconKey: string;
  onPress: () => void;
}) {
  const color = status === 'critical' || status === 'warning'
    ? theme.colors.danger
    : status === 'moderate'
      ? theme.colors.warning
      : theme.colors.success;
  const icon = ORGAN_ICONS[iconKey] ?? 'ellipse';
  const bg = ORGAN_COLORS[iconKey] ?? theme.colors.primary;

  const statusLabel = status === 'critical' ? 'High Risk'
    : status === 'warning' ? 'Warning'
      : status === 'moderate' ? 'Moderate'
        : 'Good';

  return (
    <Pressable style={organStyles.chip} onPress={onPress}>
      <View style={[organStyles.iconCircle, { backgroundColor: `${bg}18` }]}>
        <Ionicons name={icon} size={16} color={bg} />
      </View>
      <View style={organStyles.info}>
        <Text style={organStyles.name} numberOfLines={1}>{name}</Text>
        <Text style={[organStyles.status, { color }]}>{statusLabel}</Text>
      </View>
    </Pressable>
  );
}

const organStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 6,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  name: { fontSize: 11, fontWeight: '600', color: theme.colors.textPrimary },
  status: { fontSize: 10, fontWeight: '500' },
});

function RiskCard({
  label,
  icon,
  prediction,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  prediction: { risk_probability: number; predicted_class: number; interpretation: string };
}) {
  const percentage = Math.round(prediction.risk_probability * 100);
  const isHigh = prediction.predicted_class === 1;
  const color = isHigh ? theme.colors.danger : theme.colors.success;

  return (
    <GlassCard style={riskStyles.card}>
      <View style={riskStyles.top}>
        <View style={[riskStyles.iconCircle, { backgroundColor: `${color}15` }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text style={riskStyles.label}>{label}</Text>
        <Text style={[riskStyles.pct, { color }]}>{percentage}%</Text>
      </View>
      <View style={riskStyles.track}>
        <View style={[riskStyles.fill, { width: `${percentage}%`, backgroundColor: color }]} />
      </View>
      <Text style={[riskStyles.interp, { color }]}>{prediction.interpretation}</Text>
    </GlassCard>
  );
}

const riskStyles = StyleSheet.create({
  card: { padding: theme.spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  iconCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  pct: { fontSize: 20, fontWeight: '900' },
  track: { height: 6, borderRadius: 999, backgroundColor: theme.colors.fill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  interp: { fontSize: 11, fontWeight: '600', marginTop: 6 },
});

function InsightCard({
  icon,
  color,
  title,
  status,
  message,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  status: string;
  message: string;
}) {
  const statusLabel = status === 'critical' || status === 'warning' ? 'High Risk'
    : status === 'moderate' ? 'Moderate'
      : 'Good';
  const statusColor = status === 'critical' || status === 'warning' ? theme.colors.danger
    : status === 'moderate' ? theme.colors.warning
      : theme.colors.success;

  return (
    <GlassCard style={insightStyles.card}>
      <View style={[insightStyles.iconCircle, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={insightStyles.title}>{title}</Text>
      <Text style={[insightStyles.status, { color: statusColor }]}>{statusLabel}</Text>
      <Text style={insightStyles.message}>{message}</Text>
    </GlassCard>
  );
}

const insightStyles = StyleSheet.create({
  card: { flex: 1, minWidth: '45%', gap: 4, padding: theme.spacing.md },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  status: { fontSize: 12, fontWeight: '600' },
  message: { fontSize: 11, color: theme.colors.textSecondary, lineHeight: 15 },
});

/* ── Main styles ── */
const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flex: 1 },
  headerRight: { flexDirection: 'row', gap: theme.spacing.sm },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,122,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: theme.colors.primary },
  greeting: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary },
  greetingSub: { fontSize: 13, color: theme.colors.textSecondary },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  section: { gap: theme.spacing.sm },
  scoreCard: { padding: theme.spacing.lg },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg },
  scoreCircleWrap: { alignItems: 'center', justifyContent: 'center' },
  scoreCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  scoreNum: { fontSize: 32, fontWeight: '900', lineHeight: 36 },
  scoreOf: { fontSize: 11, color: theme.colors.textLight, fontWeight: '500' },
  scoreInfo: { flex: 1, gap: theme.spacing.sm },
  scoreTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    alignSelf: 'flex-start',
  },
  riskDot: { width: 7, height: 7, borderRadius: 4 },
  riskLabel: { fontSize: 13, fontWeight: '700' },
  scoreHint: { fontSize: 12, color: theme.colors.textSecondary, lineHeight: 17 },
  bodyCard: { padding: theme.spacing.md },
  bodyGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  bodyAvatarArea: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  bodyAvatarCircle: {
    width: 100,
    height: 120,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: 'rgba(0,122,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  organLeft: { flex: 1 },
  organRight: { flex: 1 },
  diseaseGrid: { gap: theme.spacing.sm },
  insightsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  scenarioCard: { padding: theme.spacing.lg },
  scenarioRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  scenarioIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'rgba(0,122,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scenarioText: { flex: 1, gap: 3 },
  scenarioTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary },
  scenarioSub: { fontSize: 13, color: theme.colors.textSecondary },
  notesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  noteCard: { flex: 1, minWidth: '45%', padding: theme.spacing.md, position: 'relative' },
  notePriorityDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  noteTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 4 },
  noteDescription: { fontSize: 12, color: theme.colors.textSecondary, lineHeight: 16 },
  shareCard: { padding: theme.spacing.lg },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  shareIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'rgba(0,122,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareText: { flex: 1, gap: 3 },
  shareTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary },
  shareSub: { fontSize: 13, color: theme.colors.textSecondary },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.textPrimary },
  closeBtn: { padding: theme.spacing.sm },
  content: {
    padding: theme.spacing.lg,
  },
  explanation: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 24,
  },
});
