import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

/**
 * Lightweight value stepper used in place of a gesture slider.
 *
 * This is intentionally simple: it avoids gesture-handler and reanimated
 * worklets, which makes it more stable on lower-end Android devices and
 * friendlier for accessibility.
 */
export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 1,
  step = 1,
  label,
  formatValue,
  disabled = false,
}: {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  formatValue?: (v: number) => string;
  disabled?: boolean;
}) {
  const clampedValue = useMemo(() => Math.min(max, Math.max(min, value)), [max, min, value]);
  const displayValue = formatValue ? formatValue(clampedValue) : String(clampedValue);
  const progress = max === min ? 0 : (clampedValue - min) / (max - min);
  const canDecrease = !disabled && clampedValue > min;
  const canIncrease = !disabled && clampedValue < max;

  const setNextValue = (delta: number) => {
    if (disabled) return;
    const nextRaw = clampedValue + delta;
    const snapped = Math.min(max, Math.max(min, Math.round(nextRaw / step) * step));
    onValueChange(Number.isFinite(snapped) ? Math.round(snapped * 1000) / 1000 : clampedValue);
  };

  return (
    <View style={[styles.container, disabled && styles.containerDisabled]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.valueText}>{displayValue}</Text>
        </View>
      ) : null}

      <View style={styles.controlRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label ?? 'value'}`}
          onPress={() => setNextValue(-step)}
          disabled={!canDecrease}
          style={({ pressed }) => [
            styles.button,
            !canDecrease && styles.buttonDisabled,
            pressed && canDecrease && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>−</Text>
        </Pressable>

        <View style={styles.trackWrap}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(6, progress * 100)}%` }]} />
          </View>
          <Text style={styles.helperText}>
            {min} to {max} in steps of {step}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label ?? 'value'}`}
          onPress={() => setNextValue(step)}
          disabled={!canIncrease}
          style={({ pressed }) => [
            styles.button,
            !canIncrease && styles.buttonDisabled,
            pressed && canIncrease && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  containerDisabled: {
    opacity: 0.55,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  valueText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: '700',
    minWidth: 56,
    textAlign: 'right',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  buttonPressed: {
    backgroundColor: colors.fill,
    transform: [{ scale: 0.97 }],
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  trackWrap: {
    flex: 1,
    gap: 6,
  },
  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  helperText: {
    color: colors.muted,
    fontSize: 12,
  },
});
