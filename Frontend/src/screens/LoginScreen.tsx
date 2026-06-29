import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { InputField } from '@/components/InputField';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { MedicalBackdrop } from '@/components/MedicalBackdrop';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuth } from '@/context/AuthContext';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { colors, radius, spacing } from '@/theme';
import { useEntranceAnimation } from '@/hooks/useEntranceAnimation';

export function LoginScreen() {
  const router = useRouter();
  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('demo@digitaltwin.ai');
  const [password, setPassword] = useState('demo1234');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const cardStyle = useEntranceAnimation(120);
  const { configured: googleClientIdsConfigured, getIdToken } = useGoogleAuth();

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (Platform.OS === 'web') {
        await loginWithGoogle();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/form');
        return;
      }

      const idToken = await getIdToken();
      await loginWithGoogle(idToken);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/form');
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof Error ? err.message : 'Google login failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await login(email, password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/form');
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <MedicalBackdrop />
      <Animated.View style={[styles.card, cardStyle]}>
        <View style={styles.headerPill}>
          <View style={styles.headerDot} />
          <Text style={styles.headerText}>Secure patient access</Text>
        </View>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to continue your digital twin dashboard.</Text>

        <GoogleSignInButton
          title="Continue with Google"
          onPress={handleGoogleLogin}
          loading={googleLoading}
          disabled={!googleClientIdsConfigured}
        />
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or use email</Text>
          <View style={styles.dividerLine} />
        </View>

        <InputField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <InputField label="Password" value={password} onChangeText={setPassword} secureTextEntry />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <PrimaryButton title="Login" onPress={handleLogin} loading={loading} />
        <Text style={styles.link} onPress={() => router.push('/register')}>
          New here? Create an account
        </Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    boxShadow: '0px 10px 18px rgba(14, 70, 210, 0.12)',
    elevation: 3,
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  headerText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  link: {
    color: colors.primary,
    fontSize: 14,
    marginTop: spacing.xs,
    fontWeight: '600',
  },
});
