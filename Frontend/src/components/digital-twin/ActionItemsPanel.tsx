import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { OrganHealth } from '@/constants/health';
import { HEALTH_STATUS_COLORS } from '@/constants/health';
import type { Recommendation, RecommendationPriority } from '@/types/api';
import { colors, radius, shadows, spacing } from '@/theme';

type Props = {
  /**
   * Either legacy plain-string recommendations (backward compatible) or the
   * new structured `Recommendation[]` from `POST /recommendations`.
   */
  recommendations: string[] | Recommendation[];
  organs: Record<string, OrganHealth>;
  onSelectOrgan?: (organId: string) => void;
};

const STATUS_PRIORITY: Record<OrganHealth['status'], number> = {
  critical: 0,
  warning: 1,
  moderate: 2,
  healthy: 3,
};

const REC_PRIORITY_COLOR: Record<RecommendationPriority, string> = {
  critical: '#DC2626', // red-600
  high: '#F59E0B',     // amber-500
  medium: '#3B82F6',   // blue-500
  low: '#10B981',      // emerald-500
};

function buildActionItems(recommendations: string[] | Recommendation[], organs: Record<string, OrganHealth>) {
  const organItems = Object.entries(organs)
    .filter(([, organ]) => organ.status !== 'healthy')
    .sort(([, a], [, b]) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status])
    .map(([key, organ]) => ({
      id: key,
      title: `${organ.name} — ${organ.status}`,
      description: `${organ.percentage}% health. Review diagnostics for ${organ.name.toLowerCase()}.`,
      color: HEALTH_STATUS_COLORS[organ.status],
      organId: key,
    }));

  let recItems: {
    id: string;
    title: string;
    description: string;
    color: string;
    organId: string | null;
  }[];

  if (recommendations.length > 0 && typeof recommendations[0] === 'object') {
    // Structured recommendations from POST /recommendations
    const priorityOrder: Record<RecommendationPriority, number> = {
      critical: 0, high: 1, medium: 2, low: 3,
    };
    recItems = (recommendations as Recommendation[])
      .slice()
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
      .slice(0, 3)
      .map((rec, idx) => ({
        id: `rec-${idx}`,
        title: rec.title,
        description: rec.rationale,
        color: REC_PRIORITY_COLOR[rec.priority] ?? colors.primary,
        organId: null,
      }));
  } else {
    // Legacy plain-string recommendations
    recItems = (recommendations as string[]).slice(0, 3).map((rec, idx) => ({
      id: `rec-${idx}`,
      title: 'Recommended action',
      description: rec,
      color: colors.primary,
      organId: null,
    }));
  }

  return [...organItems, ...recItems].slice(0, 5);
}

export function ActionItemsPanel({ recommendations, organs, onSelectOrgan }: Props) {
  const items = buildActionItems(recommendations, organs);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Action Items</Text>
        <Text style={styles.menu}>•••</Text>
      </View>

      <View style={styles.list}>
        {items.length === 0 ? (
          <View style={styles.emptyItem}>
            <Text style={styles.emptyText}>All systems healthy. No action items.</Text>
          </View>
        ) : (
          items.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => item.organId && onSelectOrgan?.(item.organId)}
              style={({ pressed }) => [
                styles.item,
                { borderLeftColor: item.color },
                pressed && item.organId ? styles.itemPressed : null,
              ]}
            >
              <View style={[styles.iconDot, { backgroundColor: item.color }]} />
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              </View>
              {item.organId ? <Text style={styles.chevron}>›</Text> : null}
            </Pressable>
          ))
        )}
      </View>

      <Pressable style={styles.addButton}>
        <Text style={styles.addButtonText}>+ Action Item</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flex: 1,
    ...shadows.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  menu: {
    color: colors.muted,
    fontSize: 16,
    letterSpacing: 2,
  },
  list: {
    gap: spacing.sm,
    flex: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
  },
  itemPressed: {
    opacity: 0.85,
  },
  iconDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  itemDescription: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 15,
  },
  chevron: {
    fontSize: 20,
    color: colors.faint,
    fontWeight: '300',
  },
  emptyItem: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  emptyText: {
    fontSize: 12,
    color: colors.muted,
  },
  addButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addButtonText: {
    color: colors.primaryDark,
    fontWeight: '700',
    fontSize: 13,
  },
});
