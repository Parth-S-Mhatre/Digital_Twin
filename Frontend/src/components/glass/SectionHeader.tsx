import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/constants/theme';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  rightText?: string;
  onRightPress?: () => void;
}

export const SectionHeader = React.memo(function SectionHeaderInner(
  { title, subtitle, rightText, onRightPress }: SectionHeaderProps
) {
    return (
      <View style={styles.container}>
        <View style={styles.leftRow}>
          <View style={styles.accent} />
          <View style={styles.textGroup}>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
        </View>
        {rightText && (
          <Pressable onPress={onRightPress} hitSlop={12}>
            <Text style={styles.rightText}>{rightText}</Text>
          </Pressable>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1,
  },
  accent: {
    width: 3,
    height: 28,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
  },
  textGroup: {
    gap: 2,
  },
  title: {
    ...theme.typography.h3,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
  },
  rightText: {
    ...theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: '600',
  },
});
