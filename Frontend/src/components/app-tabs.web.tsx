import { TabList, Tabs, TabSlot, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/constants/theme';

const TABS = [
  { name: 'dashboard', href: '/dashboard', icon: '⌂', label: 'Home' },
  { name: 'chat', href: '/chat', icon: '💬', label: 'Chat' },
  { name: 'profile', href: '/profile', icon: '◎', label: 'Settings' },
] as const;

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList style={styles.tabBar}>
        {TABS.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
            <WebTabButton tab={tab} />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}

function WebTabButton({
  tab,
  isFocused,
  ...props
}: TabTriggerSlotProps & { tab: { icon: string; label: string } }) {
  return (
    <Pressable
      {...props}
      style={({ pressed }) => [styles.tabItem, pressed && styles.pressed]}
    >
      <View style={[styles.tabContent, isFocused && styles.tabContentActive]}>
        <Text style={[styles.tabIcon, isFocused && styles.tabIconActive]}>{tab.icon}</Text>
        <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>{tab.label}</Text>
        {isFocused && <View style={styles.activeDot} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    ...theme.shadows.soft,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
  },
  tabContent: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    gap: 3,
    minWidth: 64,
  },
  tabContentActive: {
    backgroundColor: theme.colors.fill,
  },
  tabIcon: {
    fontSize: 20,
    color: theme.colors.textLight,
  },
  tabIconActive: {
    color: theme.colors.primary,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textLight,
  },
  tabLabelActive: {
    color: theme.colors.primary,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
  },
  pressed: {
    opacity: 0.8,
  },
});
