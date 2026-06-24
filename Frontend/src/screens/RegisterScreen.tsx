import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InputField } from '@/components/InputField';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { MedicalBackdrop } from '@/components/MedicalBackdrop';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuth } from '@/context/AuthContext';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { colors, radius, spacing } from '@/theme';
import { useEntranceAnimation } from '@/hooks/useEntranceAnimation';

export function RegisterScreen() {
  const router = useRouter();
  const { register, registerWithGoogle } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const cardStyle = useEntranceAnimation(120);
  const { configured: googleClientIdsConfigured, getIdToken } = useGoogleAuth();

  const handleRegister = async () => {
    setError('');

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await register(name, email, password);
      router.replace('/form');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      if (Platform.OS === 'web') {
        await registerWithGoogle();
        router.replace('/form');
        return;
      }

      const idToken = await getIdToken();
      await registerWithGoogle(idToken);
      router.replace('/form');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-up failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <MedicalBackdrop />
      <Animated.View style={[styles.card, cardStyle]}>
        <View style={styles.headerPill}>
          <View style={styles.headerDot} />
          <Text style={styles.headerText}>Digital Twin Onboarding</Text>
        </View>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Set up your profile to power a real-world Digital Twin experience.</Text>

        <GoogleSignInButton
          title="Continue with Google"
          onPress={handleGoogleRegister}
          loading={googleLoading}
          disabled={!googleClientIdsConfigured}
        />
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or use email</Text>
          <View style={styles.dividerLine} />
        </View>

        <InputField label="Full name" value={name} onChangeText={setName} />
        <InputField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <InputField label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <InputField label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <PrimaryButton title="Register" onPress={handleRegister} loading={loading} />
        <Text style={styles.link} onPress={() => router.push('/login')}>
          Already have an account? Login
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
    boxShadow: '0px 18px 36px rgba(14, 70, 210, 0.14)',
    elevation: 4,
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
    fontSize: 36,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    marginBottom: spacing.xs,
    lineHeight: 24,
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
