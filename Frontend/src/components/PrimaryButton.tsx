import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { colors, iosShadows, springs, typography } from '@/theme';

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
};

/**
 * iOS-style primary action button.
 *
 * - Continuous corner radius (14) tuned to the 50pt height.
 * - Spring press feedback: scale dips to ~0.97 on press-in and springs back
 *   on release, matching the native UIKit control feel.
 * - Primary uses a subtle top-light gradient via layered shadows; secondary is
 *   a grouped-fill surface with a hairline border.
 * Keeps the same prop API as before so every call site works unchanged.
 */
export function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}: Props) {
  const [scale] = useState(() => new Animated.Value(1));
  const isDisabled = loading || disabled;

  useEffect(() => {
    return () => {
      scale.stopAnimation();
    };
  }, [scale]);

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: Platform.OS !== 'web',
      ...springs.snappy,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: Platform.OS !== 'web',
      ...springs.bouncy,
    }).start();
  };

  const baseStyle: ViewStyle = {
    transform: [{ scale }],
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      <Animated.View
        style={[
          styles.base,
          variant === 'secondary' ? styles.secondary : styles.primary,
          baseStyle,
          isDisabled && styles.disabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator
            color={variant === 'secondary' ? colors.primary : colors.surface}
            size="small"
          />
        ) : (
          <Text style={[styles.text, variant === 'secondary' && styles.secondaryText]}>{title}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  primary: {
    backgroundColor: colors.primary,
    ...(iosShadows.md as object),
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...(iosShadows.sm as object),
  },
  disabled: {
    opacity: 0.55,
  },
  text: {
    color: '#FFFFFF',
    ...typography.headline,
    fontSize: 16,
  },
  secondaryText: {
    color: colors.primaryDark,
  },
});
