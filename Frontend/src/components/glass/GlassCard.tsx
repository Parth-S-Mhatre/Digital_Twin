import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '@/constants/theme';
import Animated from 'react-native-reanimated';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const GlassCard = React.memo(function GlassCardInner({ children, style }: GlassCardProps) {
  return (
    <Animated.View style={[styles.container, style]}>
      <View style={styles.inner}>
        {children}
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    ...theme.shadows.card,
  },
  inner: {
    backgroundColor: theme.colors.cardBackground,
    padding: theme.spacing.lg,
  },
});
