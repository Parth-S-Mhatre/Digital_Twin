import { TabList, Tabs, TabSlot, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList style={styles.tabShell}>
        <>
          <View style={styles.brandRow}>
            <View style={styles.brandPill}>
              <View style={styles.brandDot} />
              <Text style={styles.brandText}>Digital Twin</Text>
            </View>
            <Text style={styles.brandCaption}>Intake first, dashboard second</Text>
          </View>

          {/* Form moved to standalone onboarding/edit screen; removed from tab bar */}
          <TabTrigger name="dashboard" href="/dashboard" asChild>
            <TabButton icon="◌">Dashboard</TabButton>
          </TabTrigger>
          <TabTrigger name="profile" href="/profile" asChild>
            <TabButton icon="◎">Profile</TabButton>
          </TabTrigger>
        </>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, icon, isFocused, ...props }: TabTriggerSlotProps & { icon: string }) {
  return (
    <Pressable {...props} style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <View style={[styles.tabCard, isFocused && styles.tabCardActive]}>
        <Text style={[styles.tabIcon, isFocused && styles.tabIconActive]}>{icon}</Text>
        <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>{children}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabShell: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    boxShadow: '0px -8px 24px rgba(14, 70, 210, 0.08)',
    elevation: 12,
  },
  brandRow: {
    gap: 6,
  },
  brandPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  brandText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  brandCaption: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tabButton: {
    flex: 1,
  },
  tabCard: {
    minHeight: 58,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    boxShadow: '0px 5px 10px rgba(14, 70, 210, 0.06)',
    elevation: 2,
  },
  tabCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#EDF5FF',
  },
  tabIcon: {
    color: colors.muted,
    fontSize: 18,
    lineHeight: 18,
  },
  tabIconActive: {
    color: colors.primaryDark,
  },
  tabLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
});
