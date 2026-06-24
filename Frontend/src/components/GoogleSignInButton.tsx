import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, springs, typography } from '@/theme';

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

/**
 * "Continue with Google" button.
 *
 * Carries the same spring press feedback as `PrimaryButton` and renders an
 * accurate four-color Google "G" via react-native-svg (already a dependency),
 * so it's crisp at any density and identical on web/native. White pill on a
 * hairline border — the standard iOS look for Sign in with Google.
 */
export function GoogleSignInButton({ title, onPress, loading = false, disabled = false }: Props) {
  const [scale] = useState(() => new Animated.Value(1));
  const isDisabled = loading || disabled;
  const useNative = Platform.OS !== 'web';

  useEffect(() => {
    return () => scale.stopAnimation();
  }, [scale]);

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: useNative, ...springs.snappy }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: useNative, ...springs.bouncy }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      <Animated.View
        style={[
          styles.base,
          { transform: [{ scale }] },
          isDisabled && styles.disabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.primaryDark} />
        ) : (
          <>
            <GoogleG size={18} />
            <Text style={styles.text}>{title}</Text>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

/**
 * Official four-color Google "G" logo drawn as SVG paths. Uses the canonical
 * Google brand palette so it reads correctly everywhere with zero image assets.
 */
function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <View style={styles.gWrap} accessibilityElementsHidden>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Path
          fill="#4285F4"
          d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
        />
        <Path
          fill="#34A853"
          d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
        />
        <Path
          fill="#FBBC05"
          d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
        />
        <Path
          fill="#EA4335"
          d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  disabled: {
    opacity: 0.55,
  },
  text: {
    color: colors.text,
    ...typography.headline,
    fontSize: 16,
    fontWeight: '600',
  },
  gWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
  },
});
