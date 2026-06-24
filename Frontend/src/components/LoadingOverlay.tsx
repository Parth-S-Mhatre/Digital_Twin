import { useEffect, useState } from 'react';
import { Animated, Easing, Modal, Platform, StyleSheet, Text, View } from 'react-native';

import { colors, iosShadows, motion, springs, typography } from '@/theme';

/**
 * Full-screen blocking overlay shown while a prediction is running.
 *
 * iOS-style: a translucent frosted backdrop with a floating rounded card, a
 * custom dual-arc spinner that rotates with an ease-in/out loop, and a title +
 * message using the type scale. The card springs in when `visible` flips on.
 */
export function LoadingOverlay({
  visible,
  message = 'Analyzing your digital twin…',
}: {
  visible: boolean;
  message?: string;
}) {
  if (!visible) {
    return null;
  }

  const content = (
    <View style={styles.backdrop}>
      <LoadingCard message={message} />
    </View>
  );

  if (Platform.OS === 'web') {
    return <View style={styles.webContainer}>{content}</View>;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      {content}
    </Modal>
  );
}

function LoadingCard({ message }: { message: string }) {
  const [spin] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));
  const [cardScale] = useState(() => new Animated.Value(0.9));
  const [cardOpacity] = useState(() => new Animated.Value(0));
  const useNative = Platform.OS !== 'web';

  useEffect(() => {
    // Card springs in.
    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: motion.fast,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: useNative,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        useNativeDriver: useNative,
        ...springs.bouncy,
      }),
    ]).start();

    // Spinner loops with an ease-in/out so it breathes rather than spins flat.
    const rotation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1000,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: useNative,
      })
    );
    // Soft opacity pulse on the inner ring.
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: useNative,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: useNative,
        }),
      ])
    );

    rotation.start();
    breathing.start();
    return () => {
      rotation.stop();
      breathing.stop();
    };
  }, [cardOpacity, cardScale, pulse, spin, useNative]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] });

  return (
    <Animated.View
      style={[
        styles.card,
        { opacity: cardOpacity, transform: [{ scale: cardScale }] },
      ]}
    >
      <View style={styles.spinnerStage}>
        <Animated.View
          style={[styles.ringInner, { opacity: ringOpacity }]}
          pointerEvents="none"
        />
        <Animated.View
          style={[styles.arcWrap, { transform: [{ rotate }] }]}
          pointerEvents="none"
        >
          <View style={styles.arcPrimary} />
          <View style={[styles.arc, { borderColor: colors.primary, borderTopColor: 'transparent', borderRightColor: 'transparent' }]} />
        </Animated.View>
        <View style={styles.dot} pointerEvents="none" />
      </View>
      <Text style={styles.title}>Crunching the numbers</Text>
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
}

const SPINNER = 56;

const styles = StyleSheet.create({
  webContainer: {
    ...StyleSheet.absoluteFill,
    zIndex: 999,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(13, 27, 42, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 28,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    ...(iosShadows.lg as object),
  },
  spinnerStage: {
    width: SPINNER + 24,
    height: SPINNER + 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  ringInner: {
    position: 'absolute',
    width: SPINNER - 6,
    height: SPINNER - 6,
    borderRadius: (SPINNER - 6) / 2,
    backgroundColor: colors.accentSoft,
  },
  arcWrap: {
    width: SPINNER,
    height: SPINNER,
    borderRadius: SPINNER / 2,
  },
  arc: {
    position: 'absolute',
    width: SPINNER,
    height: SPINNER,
    borderRadius: SPINNER / 2,
    borderWidth: 4,
  },
  arcPrimary: {
    position: 'absolute',
    width: SPINNER,
    height: SPINNER,
    borderRadius: SPINNER / 2,
    borderWidth: 4,
    borderColor: colors.accentSoft,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  title: {
    color: colors.text,
    ...typography.title3,
  },
  message: {
    color: colors.muted,
    ...typography.subheadline,
    marginTop: 6,
    textAlign: 'center',
  },
});
