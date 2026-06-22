import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Fragment } from '@/engine/types';

export function FragmentListItem({
  fragment,
  hasError,
  onPress,
  onDelete,
}: {
  fragment: Fragment;
  hasError?: boolean;
  onPress: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[
        styles.item,
        {
          backgroundColor: colors.card,
          borderColor: hasError ? colors.destructive + '88' : colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.left}>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.badgeText, { color: colors.primary }]} numberOfLines={1}>
              {fragment.locationId || 'no-location'}
            </Text>
            <Text style={[styles.priority, { color: colors.mutedForeground }]}>
              p{fragment.priority}
            </Text>
          </View>
          {fragment.title && fragment.title !== fragment.locationId && (
            <Text style={[styles.titleText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {fragment.title}
            </Text>
          )}
          {hasError && (
            <Feather name="alert-circle" size={13} color={colors.destructive} />
          )}
        </View>
        <Text style={[styles.text, { color: colors.foreground }]} numberOfLines={2}>
          {fragment.text || '(empty)'}
        </Text>
        <View style={styles.meta}>
          {fragment.conditions.length > 0 && (
            <View style={styles.metaItem}>
              <Feather name="filter" size={10} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {fragment.conditions.length}
              </Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Feather name="chevrons-right" size={10} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {fragment.choices.length} choice{fragment.choices.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity onPress={onDelete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="trash-2" size={15} color={colors.destructive} />
        </TouchableOpacity>
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 10, borderWidth: 1,
    marginHorizontal: 16, marginVertical: 4, padding: 12, gap: 10,
  },
  left: { flex: 1, gap: 6 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    gap: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
  },
  badgeText: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  priority: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  titleText: { fontSize: 11, fontFamily: 'Inter_400Regular', flexShrink: 1 },
  text: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
});
