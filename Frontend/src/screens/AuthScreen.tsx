import { useRouter } from 'expo-router';
import { Animated, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MedicalBackdrop } from '@/components/MedicalBackdrop';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useSpringEntrance } from '@/hooks/useSpringEntrance';
import { colors, iosShadows, radius, spacing, typography } from '@/theme';

export function AuthScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < 390;
  const heroStyle = useSpringEntrance({ delay: 80, distance: 24, preset: 'bouncy' });
  const cardStyle = useSpringEntrance({ delay: 220, distance: 20 });
  const loginBtnStyle = useSpringEntrance({ delay: 360, distance: 12 });
  const registerBtnStyle = useSpringEntrance({ delay: 440, distance: 12 });

  return (
    <SafeAreaView style={styles.safeArea}>
      <MedicalBackdrop />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.contentShell}>
          <Animated.View style={[styles.hero, isCompact && styles.heroCompact, heroStyle]}>
            <View style={styles.kickerPill}>
              <View style={styles.kickerDot} />
              <Text style={styles.kicker}>Digital Twin</Text>
            </View>
            <Text style={[styles.title, isCompact && styles.titleCompact]}>Health Twin Access</Text>
            <Text style={styles.subtitle}>
              Secure authentication for your personal health dashboard.
            </Text>
          </Animated.View>

          <Animated.View style={[styles.card, cardStyle]}>
            <Text style={styles.cardTitle}>Get started</Text>
            <Text style={styles.cardText}>
              Login or create an account to access your Digital Twin.
            </Text>

            <Animated.View style={loginBtnStyle}>
              <PrimaryButton title="Login" onPress={() => router.push('/login')} />
            </Animated.View>
            <View style={{ height: spacing.sm }} />
            <Animated.View style={registerBtnStyle}>
              <PrimaryButton
                title="Create account"
                onPress={() => router.push('/register')}
                variant="secondary"
              />
            </Animated.View>
          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  contentShell: {
    flex: 1,
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
    justifyContent: 'space-between',
  },
  hero: {
    paddingTop: 160,
    gap: spacing.md,
  },
  heroCompact: {
    paddingTop: 136,
  },
  kickerPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...(iosShadows.sm as object),
  },
  kickerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  kicker: {
    color: colors.primary,
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    ...typography.largeTitle,
  },
  titleCompact: {
    fontSize: 30,
    lineHeight: 37,
  },
  subtitle: {
    color: colors.muted,
    ...typography.body,
    maxWidth: 330,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    marginTop: spacing.xl,
    ...(iosShadows.lg as object),
  },
  cardTitle: {
    color: colors.text,
    ...typography.title3,
  },
  cardText: {
    color: colors.muted,
    ...typography.subheadline,
    lineHeight: 20,
  },
});
