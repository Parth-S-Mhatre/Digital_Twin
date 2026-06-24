import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

export function MedicalBackdrop() {
  const [floatA] = useState(() => new Animated.Value(0));
  const [floatB] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const floating = (value: Animated.Value, toValue: number, duration: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(value, {
            toValue: 0,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      );

    const animationA = floating(floatA, -10, 2400);
    const animationB = floating(floatB, 12, 3000);

    animationA.start();
    animationB.start();

    return () => {
      animationA.stop();
      animationB.stop();
    };
  }, [floatA, floatB]);

  const translateYA = floatA.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });
  const translateYB = floatB.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 12],
  });
  return (
    <View style={styles.container}>
      <View style={styles.topWash} />
      <Animated.View style={[styles.orbLarge, { transform: [{ translateY: translateYA }] }]} />
      <Animated.View style={[styles.orbSmall, { transform: [{ translateY: translateYB }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  topWash: {
    position: 'absolute',
    top: -32,
    left: -60,
    right: -60,
    height: 220,
    backgroundColor: '#A8DCF0',
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
    opacity: 0.85,
  },
  orbLarge: {
    position: 'absolute',
    top: 48,
    right: -36,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(14, 165, 233, 0.14)',
  },
  orbSmall: {
    position: 'absolute',
    top: 178,
    left: -18,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
  },
});
