import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { theme } from '@/constants/theme';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

interface GlassButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
}

export const GlassButton = React.memo(function GlassButtonInner({
  title,
  onPress,
  variant = 'primary',
  style,
  textStyle,
  disabled = false,
}: GlassButtonProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(disabled ? 0.5 : 1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.96);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  let containerStyle: ViewStyle;
  let textColor = theme.colors.white;

  if (variant === 'primary') {
    containerStyle = { backgroundColor: theme.colors.primary };
  } else if (variant === 'secondary') {
    containerStyle = { backgroundColor: 'rgba(255,255,255,0.25)' };
    textColor = theme.colors.textPrimary;
  } else {
    containerStyle = { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.primary };
    textColor = theme.colors.primary;
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[styles.base, containerStyle, style]}
    >
      <Animated.View style={[styles.inner, animatedStyle]}>
        <Text style={[styles.text, { color: textColor }, textStyle]}>
          {title}
        </Text>
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  inner: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
});
