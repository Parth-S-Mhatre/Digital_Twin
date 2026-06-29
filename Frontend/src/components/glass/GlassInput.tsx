import React from 'react';
import { TextInput, View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { theme } from '@/constants/theme';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

interface GlassInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  label?: string;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  editable?: boolean;
}

export const GlassInput = React.memo(function GlassInputInner({
  value,
  onChangeText,
  placeholder,
  label,
  style,
  inputStyle,
  secureTextEntry = false,
  keyboardType = 'default',
  editable = true,
}: GlassInputProps) {
  const borderWidth = useSharedValue(1);
  const isFocused = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      borderWidth: withSpring(borderWidth.value),
      borderColor: isFocused.value
        ? theme.colors.primary
        : theme.colors.border,
    };
  });

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <Animated.View style={[styles.wrapper, animatedStyle]}>
        <TextInput
          style={[styles.input, inputStyle]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textLight}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          editable={editable}
          onFocus={() => {
            isFocused.value = 1;
            borderWidth.value = 1.5;
          }}
          onBlur={() => {
            isFocused.value = 0;
            borderWidth.value = 1;
          }}
        />
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginLeft: theme.spacing.sm,
  },
  wrapper: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.25)',
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  input: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    fontWeight: '500',
  },
});
