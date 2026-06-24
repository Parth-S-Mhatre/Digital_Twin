import { View } from 'react-native';

import { HumanBodyAvatar } from './HumanBodyAvatar';
import type { OrganHealth } from '@/constants/health';

type Props = {
  organs: Record<string, OrganHealth>;
  scale?: number;
};

export function DigitalTwinBody({ organs, scale = 1 }: Props) {
  return (
    <View>
      <HumanBodyAvatar organs={organs} scale={scale} interactive={false} />
    </View>
  );
}
