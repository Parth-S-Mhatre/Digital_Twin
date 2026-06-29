import React from 'react';
import { StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { useSpringEntrance } from '@/hooks/useSpringEntrance';

interface FloatingHealthIconProps {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  delay: number;
  position: {
    top?: number;
    left?: number;
    right?: number;
  };
}

export const FloatingHealthIcon = React.memo(function FloatingHealthIconInner({
  name,
  color,
  delay,
  position,
}: FloatingHealthIconProps) {
  const animatedStyle = useSpringEntrance({
    delay,
    distance: 20,
  });

  return (
    <Animated.View
      style={[
        styles.icon,
        { backgroundColor: `${color}15` },
        animatedStyle,
        {
          top: position.top,
          left: position.left,
          right: position.right,
        },
      ]}
    >
      <Ionicons name={name} size={28} color={color} />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  icon: {
    width: 56,
    height: 56,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    ...theme.shadows.soft,
  },
});
