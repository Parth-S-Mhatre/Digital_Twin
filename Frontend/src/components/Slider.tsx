import { useCallback, useMemo, useRef, useState } from 'react';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

/**
 * A lightweight range slider built on react-native-gesture-handler.
 * Works on iOS, Android, and web without any native module beyond
 * gesture-handler (already a project dependency).
 *
 * Props mirror a controlled input: `value`, `onValueChange`, `min`, `max`, `step`.
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
  const trackWidth = useRef(0);
  const [trackLayout, setTrackLayout] = useState({ width: 0 });

  const range = max - min;
  const fraction = (value - min) / range;

  const snapToStep = useCallback(
    (rawFraction: number) => {
      let snapped = min + Math.round(rawFraction * range / step) * step;
      snapped = Math.max(min, Math.min(max, snapped));
      // Clean floating-point artifacts.
      return Math.round(snapped * 1000) / 1000;
    },
    [min, max, range, step]
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        .onUpdate((evt) => {
          const w = trackLayout.width;
          if (w <= 0) return;
          const rawFraction = Math.max(0, Math.min(1, evt.absoluteX / w));
          const newValue = snapToStep(rawFraction);
          onValueChange(newValue);
        }),
    [disabled, trackLayout.width, snapToStep, onValueChange]
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .enabled(!disabled)
        .onEnd((evt) => {
          const w = trackLayout.width;
          if (w <= 0) return;
          const rawFraction = Math.max(0, Math.min(1, evt.absoluteX / w));
          const newValue = snapToStep(rawFraction);
          onValueChange(newValue);
        }),
    [disabled, trackLayout.width, snapToStep, onValueChange]
  );

  const composedGesture = useMemo(
    () => Gesture.Race(panGesture, tapGesture),
    [panGesture, tapGesture]
  );

  const fillWidth = trackLayout.width * fraction;
  const thumbPixelLeft = trackLayout.width * fraction;
  const displayValue = formatValue ? formatValue(value) : String(value);

  return (
    <View style={[styles.container, disabled && styles.containerDisabled]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.valueText}>{displayValue}</Text>
        </View>
      ) : null}

      <GestureDetector gesture={composedGesture}>
        <View
          style={styles.track}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            trackWidth.current = w;
            setTrackLayout({ width: w });
          }}
        >
          <View style={[styles.trackFill, { width: fillWidth }]} />
          <View style={[styles.thumb, { left: thumbPixelLeft }]} />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  containerDisabled: {
    opacity: 0.45,
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
    minWidth: 40,
    textAlign: 'right',
  },
  track: {
    height: 28,
    justifyContent: 'center',
    position: 'relative',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    top: '50%',
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.primary,
    marginTop: -3,
  },
  thumb: {
    position: 'absolute',
    top: '50%',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 2.5,
    borderColor: colors.primary,
    marginTop: -11,
    marginLeft: -11,
    ...Platform.select({
      web: { boxShadow: '0 2px 6px rgba(14,70,210,0.25)' },
      default: {
        shadowColor: colors.primaryDark,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 3,
      },
    }),
  },
});
