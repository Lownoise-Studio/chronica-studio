import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { InventoryItem } from '@/engine/types';
import type { PlayerViewColors } from '@/components/PlayerView';

export function GameplayInventoryHud({
  items,
  colors,
}: {
  items: InventoryItem[];
  colors: PlayerViewColors;
}) {
  if (!items.length) return null;

  return (
    <View style={[styles.wrap, styles.inventoryWrap]} pointerEvents="box-none">
      <View style={[styles.panel, { backgroundColor: colors.card + 'ee', borderColor: colors.border }]}>
        <Feather name="package" size={12} color={colors.primary} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {items.map(item => (
            <View key={item.id} style={[styles.chip, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Text style={[styles.chipText, { color: colors.foreground }]} numberOfLines={1}>
                {item.label}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 20,
  },
  inventoryWrap: {
    top: 88,
  },
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  row: { gap: 6, alignItems: 'center' },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: 140,
  },
  chipText: { fontSize: 11, fontFamily: 'Inter_500Medium' },
});
