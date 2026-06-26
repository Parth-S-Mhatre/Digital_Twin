import { Platform, AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';

import { useAlert, type AlertLevel } from '@/context/AlertContext';
import { colors, radius, shadows, spacing } from '@/theme';

/**
 * Renders the active alerts as stacked toasts anchored to the top of the screen.
 * Mount once near the app root (see src/app/_layout.tsx). Modeled on the
 * severity-coded cards already used by HealthNotificationPanel.
 */
const LEVEL_STYLES: Record<
  AlertLevel,
  { border: string; background: string; accent: string; label: string }
> = {
  info: {
    border: colors.borderStrong,
    background: colors.surface,
    accent: colors.primary,
    label: 'Info',
  },
  warning: {
    border: 'rgba(255,132,92,0.35)',
    background: 'rgba(255,132,92,0.10)',
    accent: colors.warning,
    label: 'Warning',
  },
  critical: {
    border: 'rgba(217,45,32,0.30)',
    background: 'rgba(217,45,32,0.10)',
    accent: colors.danger,
    label: 'Error',
  },
};

export function AlertHost() {
  const { alerts, dismissAlert } = useAlert();

  // Animate each toast in on mount.
  const visibleIds = useMemo(() => alerts.map((a) => a.id), [alerts]);

  return (
    <View
      style={[styles.host, Platform.OS === 'web' && styles.hostWeb]}
      pointerEvents={Platform.OS === 'web' ? undefined : 'box-none'}
    >
      {alerts.map((alert) => (
        <AlertCard
          key={alert.id}
          visible={visibleIds.includes(alert.id)}
          {...alert}
          onDismiss={() => dismissAlert(alert.id)}
        />
      ))}
    </View>
  );
}

type AlertCardProps = {
  level: AlertLevel;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
  visible: boolean;
  onDismiss: () => void;
};

function AlertCard({ level, title, message, action, visible, onDismiss }: AlertCardProps) {
  const theme = LEVEL_STYLES[level];
  const [opacity] = useState(0);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${theme.label}: ${title}${message ? `. ${message}` : ''}`);
  }, [theme.label, title, message]);

  return (
    <Pressable
      accessibilityRole="alert"
      accessibilityLabel={`${theme.label}: ${title}`}
      onPress={onDismiss}
      style={[
        styles.card,
        {
          borderColor: theme.border,
          backgroundColor: theme.background,
          opacity: visible ? 1 : opacity,
          transform: [{ translateY: visible ? 0 : -8 }],
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: theme.accent }]} />
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
      {action ? (
        <Pressable
          hitSlop={8}
          style={[styles.actionBtn, { borderColor: theme.accent }]}
          onPress={() => {
            action.onPress();
            onDismiss();
          }}
        >
          <Text style={[styles.actionText, { color: theme.accent }]}>{action.label}</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    gap: spacing.sm,
    zIndex: 1000,
    elevation: 1000,
  },
  hostWeb: {
    pointerEvents: 'none',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    ...shadows.card,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 2,
  },
  body: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  message: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  actionBtn: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
