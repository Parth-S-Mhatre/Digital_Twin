import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, iosShadows, springs, typography } from '@/theme';

/**
 * Branded launch / loading screen shown while auth state is resolving.
 *
 * Replaces the blank `null` flashes that used to appear on the auth-gated
 * routes. The logo mark scales in with a spring (the iOS "icon lands" feel),
 * a soft ambient pulse keeps the surface alive, and a thin activity indicator
 * sits at the bottom. No new dependencies — pure Animated + theme tokens.
 */
export function LaunchScreen() {
  const [scale] = useState(() => new Animated.Value(0.6));
  const [opacity] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));
  const useNative = Platform.OS !== 'web';

  useEffect(() => {
    // Logo lands with an overshooting spring on native; cubic ease on web.
    const land = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: useNative,
      }),
      useNative
        ? Animated.spring(scale, { toValue: 1, ...springs.bouncy, useNativeDriver: true })
        : Animated.timing(scale, {
            toValue: 1,
            duration: 560,
            easing: Easing.bezier(0.34, 1.56, 0.64, 1),
            useNativeDriver: false,
          }),
    ]);

    // Slow ambient breathing on the halo behind the mark.
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: useNative,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: useNative,
        }),
      ])
    );

    land.start();
    const timer = setTimeout(() => breathe.start(), 300);

    return () => {
      land.stop();
      breathe.stop();
      clearTimeout(timer);
    };
  }, [opacity, pulse, scale, useNative]);

  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.12] });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.brand}>
          <View style={styles.markStage}>
            <Animated.View
              style={[
                styles.halo,
                {
                  opacity: haloOpacity,
                  transform: [{ scale: Animated.multiply(haloScale, scale) }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.mark,
                {
                  opacity,
                  transform: [{ scale }],
                },
              ]}
            >
              <View style={styles.markInner}>
                <View style={styles.heartbeatRow}>
                  <View style={[styles.heartbeatDot, styles.heartbeatDotPrimary]} />
                  <View style={styles.heartbeatLine} />
                  <View style={[styles.heartbeatDot, styles.heartbeatDotAccent]} />
                </View>
                <Text style={styles.markGlyph}>✚</Text>
              </View>
            </Animated.View>
          </View>

          <Animated.Text
            style={[styles.wordmark, { opacity }]}
            adjustsFontSizeToFit
            numberOfLines={1}
          >
            MyHealthtwin
          </Animated.Text>
          <Animated.Text style={[styles.tagline, { opacity }]}>
            Your personal health, modeled.
          </Animated.Text>
        </View>

        <View style={styles.footer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.footerText}>Preparing your space</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const MARK_SIZE = 96;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 64,
  },
  brand: {
    alignItems: 'center',
    gap: 14,
    marginTop: 24,
  },
  markStage: {
    width: MARK_SIZE + 56,
    height: MARK_SIZE + 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: MARK_SIZE + 40,
    height: MARK_SIZE + 40,
    borderRadius: (MARK_SIZE + 40) / 2,
    backgroundColor: colors.accent,
  },
  mark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...(iosShadows.lg as object),
  },
  markInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  heartbeatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heartbeatDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  heartbeatDotPrimary: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  heartbeatDotAccent: {
    backgroundColor: colors.accentSoft,
  },
  heartbeatLine: {
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  markGlyph: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    marginTop: 2,
  },
  wordmark: {
    color: colors.text,
    ...typography.title1,
    letterSpacing: -0.4,
  },
  tagline: {
    color: colors.muted,
    ...typography.subheadline,
  },
  footer: {
    alignItems: 'center',
    gap: 10,
  },
  footerText: {
    color: colors.muted,
    ...typography.footnote,
  },
});
