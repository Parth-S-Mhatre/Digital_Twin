import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { getProfileCompletion } from '@/constants/profile';
import { theme } from '@/constants/theme';

type SettingsRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
};

function SettingsRow({ icon, iconColor, label, value, onPress, destructive }: SettingsRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}
    >
      <View style={[styles.settingsIcon, { backgroundColor: `${iconColor ?? theme.colors.primary}18` }]}>
        <Ionicons name={icon} size={18} color={iconColor ?? theme.colors.primary} />
      </View>
      <Text style={[styles.settingsLabel, destructive && { color: theme.colors.danger }]}>{label}</Text>
      <View style={{ flex: 1 }} />
      {value && <Text style={styles.settingsValue}>{value}</Text>}
      {onPress && (
        <Ionicons
          name="chevron-forward"
          size={16}
          color={destructive ? theme.colors.danger : theme.colors.textLight}
        />
      )}
    </Pressable>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.settingsSection}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>
        {children}
      </View>
    </View>
  );
}

export function ProfileScreen() {
  const { user, profile, profileInitializing, logout, clearProfile } = useAuth();
  const router = useRouter();

  if (profileInitializing) return null;

  const bmi = (() => {
    if (!profile?.height || !profile?.weight) return '—';
    const h = parseFloat(profile.height);
    const w = parseFloat(profile.weight);
    if (!h || !w) return '—';
    return (w / ((h / 100) ** 2)).toFixed(1);
  })();

  const completion = getProfileCompletion(profile);
  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  return (
    <LinearGradient
      colors={[theme.colors.backgroundStart, theme.colors.backgroundEnd]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Profile Header ── */}
          <View style={styles.profileHeader}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Text style={styles.userName}>{user?.name ?? 'Your profile'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{bmi}</Text>
                <Text style={styles.statLabel}>BMI</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{profile?.bloodGroup || '—'}</Text>
                <Text style={styles.statLabel}>Blood Group</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{completion}%</Text>
                <Text style={styles.statLabel}>Complete</Text>
              </View>
            </View>
          </View>

          {/* ── Settings ── */}
          <SettingsSection title="Health Data">
            <SettingsRow
              icon="person-outline"
              label="Edit Profile"
              onPress={() => router.push('/form?mode=profile')}
            />
            <SettingsRow
              icon="analytics-outline"
              label="Health Metrics"
              value="View All"
              onPress={() => router.push('/digital-twin')}
            />
            <SettingsRow
              icon="options-outline"
              label="What-If Scenarios"
              onPress={() => router.push('/scenario')}
            />
          </SettingsSection>

          <SettingsSection title="Account">
            <SettingsRow
              icon="notifications-outline"
              iconColor={theme.colors.warning}
              label="Notifications"
            />
            <SettingsRow
              icon="moon-outline"
              iconColor="#8B5CF6"
              label="Appearance"
              value="Light"
            />
            <SettingsRow
              icon="shield-checkmark-outline"
              iconColor={theme.colors.success}
              label="Privacy & Security"
            />
          </SettingsSection>

          <SettingsSection title="About">
            <SettingsRow
              icon="information-circle-outline"
              iconColor={theme.colors.skyBlue}
              label="App Version"
              value="1.0.0"
            />
            <SettingsRow
              icon="document-text-outline"
              iconColor={theme.colors.textSecondary}
              label="Terms of Service"
              onPress={() => {}}
            />
          </SettingsSection>

          <SettingsSection title="Danger Zone">
            <SettingsRow
              icon="trash-outline"
              iconColor={theme.colors.warning}
              label="Clear Profile Data"
              onPress={clearProfile}
              destructive
            />
            <SettingsRow
              icon="log-out-outline"
              iconColor={theme.colors.danger}
              label="Sign Out"
              onPress={logout}
              destructive
            />
          </SettingsSection>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.lg,
  },
  profileHeader: {
    alignItems: 'center',
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  avatarCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(0,122,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0,122,255,0.2)',
    ...theme.shadows.soft,
  },
  avatarText: { fontSize: 30, fontWeight: '800', color: theme.colors.primary },
  userName: { fontSize: 22, fontWeight: '800', color: theme.colors.textPrimary },
  userEmail: { fontSize: 13, color: theme.colors.textSecondary },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    marginTop: theme.spacing.sm,
    ...theme.shadows.card,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    gap: 3,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: theme.colors.textPrimary },
  statLabel: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '500' },
  statDivider: { width: 1, height: 40, backgroundColor: theme.colors.border },
  settingsSection: { gap: theme.spacing.sm },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingLeft: theme.spacing.sm,
  },
  sectionCard: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  settingsIcon: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  settingsValue: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginRight: 4,
  },
  pressed: { backgroundColor: theme.colors.fill },
});
