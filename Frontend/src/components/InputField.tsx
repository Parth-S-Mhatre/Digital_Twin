import { forwardRef, useState } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { colors, springs, typography } from '@/theme';

type Props = TextInputProps & {
  label: string;
  error?: string;
};

/**
 * iOS-style text field.
 *
 * On focus the border smoothly shifts to the accent blue and a soft focus glow
 * (shadow + faint fill) fades in — the same affordance iOS uses to signal the
 * active responder. Label uses the subheadline scale; the field keeps the
 * existing prop surface so form code is unchanged.
 */
export const InputField = forwardRef<TextInput, Props>(function InputField(
  { label, error, style, onFocus, onBlur, ...props },
  ref
) {
  const [focused, setFocused] = useState(false);
  const [borderAnim] = useState(() => new Animated.Value(0));

  const handleFocus = (e: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => {
    setFocused(true);
    onFocus?.(e);
    Animated.spring(borderAnim, {
      toValue: 1,
      useNativeDriver: Platform.OS !== 'web',
      ...springs.smooth,
    }).start();
  };

  const handleBlur = (e: Parameters<NonNullable<TextInputProps['onBlur']>>[0]) => {
    setFocused(false);
    onBlur?.(e);
    Animated.spring(borderAnim, {
      toValue: 0,
      useNativeDriver: Platform.OS !== 'web',
      ...springs.smooth,
    }).start();
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
  });
  const glowOpacity = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.18],
  });

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputStage}>
        <Animated.View
          pointerEvents="none"
          style={[styles.glow, { opacity: glowOpacity, borderColor }]}
        />
        <Animated.View style={[styles.inputBorder, { borderColor }]}>
          <TextInput
            ref={ref}
            placeholderTextColor={colors.faint}
            onFocus={handleFocus}
            onBlur={handleBlur}
            style={[styles.input, focused && styles.inputFocused, style]}
            {...props}
          />
        </Animated.View>
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    color: colors.text,
    ...typography.subheadline,
    fontWeight: '600',
  },
  inputStage: {
    position: 'relative',
  },
  // Faint colored halo that fades in on focus; sits 2px outside the field.
  glow: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 17,
    borderWidth: 2,
    backgroundColor: 'rgba(29, 94, 255, 0.06)',
  },
  inputBorder: {
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: colors.inputBg,
  },
  input: {
    color: colors.text,
    paddingHorizontal: 16,
    paddingVertical: 14,
    // Override the body size (17) for a slightly tighter form-field feel.
    ...typography.body,
    fontSize: 16,
  },
  inputFocused: {
    backgroundColor: colors.surface,
  },
  error: {
    color: colors.danger,
    ...typography.caption,
    marginTop: 2,
  },
});
