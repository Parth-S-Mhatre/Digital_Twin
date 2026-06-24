import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { colors } from '@/theme';

export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={colors.surface}
      indicatorColor={colors.primary}
      labelStyle={{
        default: { color: colors.muted, fontSize: 12, fontWeight: '600' },
        selected: { color: colors.primaryDark, fontSize: 12, fontWeight: '700' },
      }}
      iconColor={colors.muted}
      tintColor={colors.primary}
    >
      {/* Form moved to a standalone screen; onboarding/editing is handled outside tabs */}

      <NativeTabs.Trigger name="dashboard">
        <NativeTabs.Trigger.Label>Dashboard</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
          selectedColor={colors.primary}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
          selectedColor={colors.primary}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
