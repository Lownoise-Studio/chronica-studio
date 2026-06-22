import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { ChronicaState } from '@/engine/types';

export function DebugPanel({ state }: { state: ChronicaState }) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);

  const rows: [string, unknown][] = [
    ['location', state.location],
    ['instability', state.instability],
    ['reality_layer', state.reality_layer],
    ...Object.entries(state.variables).map(([k, v]) => [`variables.${k}`, v] as [string, unknown]),
    ...Object.entries(state.memory).map(([k, v]) => [`memory.${k}`, v] as [string, unknown]),
  ];

  return (
    <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity style={styles.header} onPress={() => setExpanded(!expanded)} activeOpacity={0.8}>
        <Feather name="terminal" size={13} color={colors.mutedForeground} />
        <Text style={[styles.headerText, { color: colors.mutedForeground }]}>State Inspector</Text>
        <Feather name={expanded ? 'chevron-down' : 'chevron-up'} size={13} color={colors.mutedForeground} />
      </TouchableOpacity>
      {expanded && (
        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          {rows.map(([key, val]) => (
            <View key={key} style={styles.row}>
              <Text style={[styles.key, { color: colors.primary }]}>{key}</Text>
              <Text style={[styles.val, { color: colors.foreground }]}>{JSON.stringify(val)}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10 },
  headerText: { flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium' },
  body: { maxHeight: 160, paddingHorizontal: 10, paddingBottom: 10 },
  row: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  key: { fontSize: 11, fontFamily: 'Inter_400Regular', flex: 1 },
  val: { fontSize: 11, fontFamily: 'Inter_400Regular', flex: 1, textAlign: 'right' },
});
