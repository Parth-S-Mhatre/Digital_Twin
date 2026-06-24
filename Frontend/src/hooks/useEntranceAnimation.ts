import { useEffect, useState } from 'react';
import { Animated, Easing, Platform } from 'react-native';

export function useEntranceAnimation(delay = 0) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(18));

  useEffect(() => {
    Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 700,
          delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
  }, [delay, opacity, translateY]);

  return {
    opacity,
    transform: [{ translateY }],
  };
}
