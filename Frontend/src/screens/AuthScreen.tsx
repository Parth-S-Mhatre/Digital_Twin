import { useRouter } from 'expo-router';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GlassButton, FloatingHealthIcon } from '@/components/glass';
import { theme } from '@/constants/theme';
import { useSpringEntrance } from '@/hooks/useSpringEntrance';

export function AuthScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  const heroStyle = useSpringEntrance({ delay: 100, distance: 30 });
  const avatarStyle = useSpringEntrance({ delay: 200, distance: 20 });
  const buttonsStyle = useSpringEntrance({ delay: 350, distance: 20 });

  const floatingIcons = [
    { name: 'heart' as const, color: '#FF3B30', delay: 200, position: { top: height * 0.12, left: width * 0.04 } },
    { name: 'medical' as const, color: '#8E44AD', delay: 400, position: { top: height * 0.28, right: width * 0.04 } },
    { name: 'fitness' as const, color: '#34C759', delay: 600, position: { top: height * 0.52, left: width * 0.06 } },
    { name: 'pulse' as const, color: '#007AFF', delay: 800, position: { top: height * 0.65, right: width * 0.06 } },
    { name: 'water' as const, color: '#4DA6FF', delay: 1000, position: { top: height * 0.4, left: width * 0.12 } },
  ];

  return (
    <LinearGradient
      colors={[theme.colors.backgroundStart, theme.colors.backgroundEnd]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.content}>
            {/* Floating Icons */}
            <View style={styles.floatingContainer} pointerEvents="none">
              {floatingIcons.map((icon, index) => (
                <FloatingHealthIcon
                  key={index}
                  name={icon.name}
                  color={icon.color}
                  delay={icon.delay}
                  position={icon.position}
                />
              ))}
            </View>

            {/* Hero Section */}
            <Animated.View style={[styles.hero, heroStyle]}>
              {/* Logo */}
              <View style={styles.logoOuter}>
                <View style={styles.logoInner}>
                  <Ionicons name="heart" size={44} color={theme.colors.primary} />
                </View>
              </View>
              <Text style={styles.appName}>
                <Text style={{ color: theme.colors.primary }}>my</Text>
                <Text style={{ color: theme.colors.textPrimary }}>HealthTwin</Text>
              </Text>
              <Text style={styles.subtitle}>
                Your Digital Twin for Smarter Health Decisions
              </Text>
            </Animated.View>

            {/* Avatar Illustration */}
            <Animated.View style={[styles.avatarContainer, avatarStyle]}>
              <View style={styles.avatarGlow} />
              <View style={styles.avatarCircle}>
                <Ionicons name="body" size={130} color={theme.colors.primary} />
              </View>
              {/* Orbit ring */}
              <View style={styles.orbitRing} />
            </Animated.View>

            {/* Buttons */}
            <Animated.View style={[styles.buttonsContainer, buttonsStyle]}>
              <GlassButton
                title="Log In"
                onPress={() => router.push('/login')}
                variant="primary"
                style={styles.button}
              />
              <GlassButton
                title="Create Account"
                onPress={() => router.push('/register')}
                variant="outline"
                style={styles.button}
              />
            </Animated.View>

            {/* Footer */}
            <View style={styles.footer}>
              <Ionicons name="lock-closed" size={13} color={theme.colors.textLight} />
              <Text style={styles.footerText}>Your data is secure and private</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  floatingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  hero: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xl,
  },
  logoOuter: {
    width: 100,
    height: 100,
    borderRadius: theme.borderRadius.full,
    backgroundColor: 'rgba(0,122,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
    ...theme.shadows.soft,
  },
  logoInner: {
    width: 76,
    height: 76,
    borderRadius: theme.borderRadius.full,
    backgroundColor: 'rgba(0,122,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: theme.spacing.xl,
  },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: theme.spacing.md,
    position: 'relative',
  },
  avatarGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(0,122,255,0.08)',
  },
  avatarCircle: {
    width: 220,
    height: 220,
    borderRadius: theme.borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(0,122,255,0.2)',
    ...theme.shadows.soft,
  },
  orbitRing: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.12)',
    borderStyle: 'dashed',
  },
  buttonsContainer: {
    width: '100%',
    gap: theme.spacing.sm,
  },
  button: { width: '100%' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: theme.spacing.sm,
  },
  footerText: {
    fontSize: 12,
    color: theme.colors.textLight,
  },
});
