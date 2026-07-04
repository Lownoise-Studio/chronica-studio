import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { GameObjective } from '@/engine/types';
import type { PlayerViewColors } from '@/components/PlayerView';

export function GameplayObjectiveTracker({
  active,
  completed,
  colors,
}: {
  active: GameObjective[];
  completed: GameObjective[];
  colors: PlayerViewColors;
}) {
  const [showCompleted, setShowCompleted] = useState(false);
  if (!active.length && !completed.length) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={[styles.panel, { backgroundColor: colors.card + 'ee', borderColor: colors.border }]}>
        <View style={styles.headerRow}>
          <Feather name="target" size={12} color={colors.primary} />
          <Text style={[styles.title, { color: colors.foreground }]}>Objectives</Text>
        </View>

        {active.map(objective => (
          <View key={objective.id} style={styles.objectiveRow}>
            <Feather name="circle" size={10} color={colors.primary} />
            <Text style={[styles.objectiveText, { color: colors.foreground }]} numberOfLines={2}>
              {objective.title}
            </Text>
          </View>
        ))}

        {completed.length > 0 && (
          <>
            <TouchableOpacity style={styles.completedToggle} onPress={() => setShowCompleted(v => !v)}>
              <Feather name={showCompleted ? 'chevron-down' : 'chevron-right'} size={12} color={colors.mutedForeground} />
              <Text style={[styles.completedLabel, { color: colors.mutedForeground }]}>
                Completed ({completed.length})
              </Text>
            </TouchableOpacity>
            {showCompleted && completed.map(objective => (
              <View key={objective.id} style={styles.objectiveRow}>
                <Feather name="check-circle" size={10} color={colors.mutedForeground} />
                <Text style={[styles.completedText, { color: colors.mutedForeground }]} numberOfLines={2}>
                  {objective.title}
                </Text>
              </View>
            ))}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 132,
    zIndex: 20,
  },
  panel: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.6 },
  objectiveRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingLeft: 2 },
  objectiveText: { flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium', lineHeight: 17 },
  completedToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  completedLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  completedText: { flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16, textDecorationLine: 'line-through' },
});
