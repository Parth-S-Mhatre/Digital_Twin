import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Platform, type ViewStyle } from 'react-native';

import { motion, springs } from '@/theme';

type SpringPreset = keyof typeof springs;

type EntranceOptions = {
  /** Stagger delay in ms before the element animates in. */
  delay?: number;
  /** Vertical offset (px) the element travels from. */
  distance?: number;
  /** Spring preset to use on native; easing on web falls back to cubic. */
  preset?: SpringPreset;
};

type EntranceResult = {
  opacity: Animated.Value;
  transform: NonNullable<ViewStyle['transform']>;
};

/**
 * Spring-driven entrance animation.
 *
 * On native this uses `Animated.spring` so elements settle with the same
 * overshoot/undershoot feel as a native iOS view. On web, springs don't run on
 * the native driver, so we fall back to a snappy cubic ease with the same
 * distance/opacity semantics — keeping the visual language identical without
 * jank in the browser.
 *
 * Returns an object shaped to spread straight onto an `Animated.View`:
 *   const style = useSpringEntrance({ delay: 120 });
 *   <Animated.View style={[style]} />
 */
export function useSpringEntrance({
  delay = 0,
  distance = 16,
  preset = 'smooth',
}: EntranceOptions = {}): EntranceResult {
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(distance));
  const useNative = Platform.OS !== 'web';

  useEffect(() => {
    // A tiny delay plus parallel opacity + translate gives the staggered
    // "cascade" feel that native apps use when revealing grouped content.
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: motion.slow,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: useNative,
      }),
      useNative
        ? Animated.spring(translateY, {
            toValue: 0,
            delay,
            ...springs[preset],
            useNativeDriver: true,
          })
        : Animated.timing(translateY, {
            toValue: 0,
            duration: motion.slow,
            delay,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }),
    ]);

    animation.start();
    return () => {
      // stop() is safe to call on both branches of the parallel animation.
      animation.stop();
    };
  }, [delay, distance, opacity, preset, translateY, useNative]);

  return useMemo(
    () => ({ opacity, transform: [{ translateY }] }),
    [opacity, translateY]
  );
}

/**
 * Convenience helper that merges an entrance result into a StyleSheet style,
 * preserving any caller-provided transform-friendly props. Kept tiny so call
 * sites can stay readable: `style={[styles.card, useSpringEntranceStyle()]}`
 */
export function useSpringEntranceStyle(options?: EntranceOptions): ViewStyle {
  return useSpringEntrance(options);
}

/** Narrow cast helper for text styles that want entrance opacity only. */
export function useFadeInTextStyle(delay = 0): { opacity: Animated.Value } {
  const { opacity } = useSpringEntrance({ delay, distance: 0 });
  // Animated.Text only animates opacity on the native driver safely.
  return { opacity };
}
