import { Component, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadows, spacing } from '@/theme';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /**
   * Optional retry callback. When provided, the default fallback shows a
   * "Try again" button that calls it AND clears the boundary error. Defaults
   * to reloading the app (the previous behaviour).
   */
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Error Boundary caught:', error);
    console.error('Error Info:', info);
  }

  private handleRetry = () => {
    // Clear the boundary so children re-render; delegate any custom recovery
    // (e.g. refetch) to the optional onRetry prop.
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <View style={styles.container}>
            <View style={styles.card}>
              <View style={styles.iconDot} accessibilityRole="alert" />
              <Text style={styles.title}>Something went wrong</Text>
              <Text style={styles.message}>
                {this.state.error?.message ?? 'An unexpected error occurred.'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Try again"
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                onPress={this.handleRetry}
              >
                <Text style={styles.buttonText}>Try again</Text>
              </Pressable>
            </View>
          </View>
        )
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  iconDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.danger,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  button: {
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  buttonPressed: {
    backgroundColor: colors.primaryDark,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
