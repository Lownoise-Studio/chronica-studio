import React, { useState } from 'react';
import {
  Alert, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { ChronicaState } from '@/engine/types';

interface Props {
  state: ChronicaState;
  onStateChange?: (updated: ChronicaState) => void;
}

export function DebugPanel({ state, onStateChange }: Props) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  type Row = { key: string; displayKey: string; rawValue: unknown; ns: 'variables' | 'memory' | null };

  const rows: Row[] = [
    { key: 'location', displayKey: 'location', rawValue: state.location, ns: null },
    { key: 'instability', displayKey: 'instability', rawValue: state.instability, ns: null },
    { key: 'reality_layer', displayKey: 'reality_layer', rawValue: state.reality_layer, ns: null },
    ...Object.entries(state.variables).map(([k, v]) => ({
      key: `variables.${k}`, displayKey: `variables.${k}`, rawValue: v, ns: 'variables' as const,
    })),
    ...Object.entries(state.memory).map(([k, v]) => ({
      key: `memory.${k}`, displayKey: `memory.${k}`, rawValue: v, ns: 'memory' as const,
    })),
  ];

  const startEdit = (row: Row) => {
    if (!onStateChange || !row.ns) return;
    setEditingKey(row.key);
    setEditValue(JSON.stringify(row.rawValue));
  };

  const commitEdit = (row: Row) => {
    if (!onStateChange || !row.ns) return;
    try {
      const parsed = JSON.parse(editValue);
      const ns = row.ns;
      const fieldKey = row.key.slice(ns.length + 1);
      const updated: ChronicaState = {
        ...state,
        [ns]: { ...state[ns], [fieldKey]: parsed },
      };
      onStateChange(updated);
    } catch {
      Alert.alert('Invalid value', 'Enter a valid JSON value (e.g. "text", 42, true, null)');
    }
    setEditingKey(null);
  };

  return (
    <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity style={styles.header} onPress={() => setExpanded(!expanded)} activeOpacity={0.8}>
        <Feather name="terminal" size={13} color={colors.mutedForeground} />
        <Text style={[styles.headerText, { color: colors.mutedForeground }]}>State Inspector</Text>
        {onStateChange && (
          <Text style={[styles.editHint, { color: colors.primary }]}>tap to edit</Text>
        )}
        <Feather name={expanded ? 'chevron-down' : 'chevron-up'} size={13} color={colors.mutedForeground} />
      </TouchableOpacity>
      {expanded && (
        <ScrollView style={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {rows.map((row) => (
            <TouchableOpacity
              key={row.key}
              style={styles.row}
              onPress={() => startEdit(row)}
              activeOpacity={onStateChange && row.ns ? 0.6 : 1}
            >
              <Text style={[styles.key, { color: colors.primary }]}>{row.displayKey}</Text>
              {editingKey === row.key ? (
                <TextInput
                  style={[styles.editInput, { color: colors.foreground, borderColor: colors.primary }]}
                  value={editValue}
                  onChangeText={setEditValue}
                  onSubmitEditing={() => commitEdit(row)}
                  onBlur={() => commitEdit(row)}
                  autoFocus
                  returnKeyType="done"
                  selectTextOnFocus
                />
              ) : (
                <Text style={[styles.val, { color: colors.foreground }]}>
                  {JSON.stringify(row.rawValue)}
                </Text>
              )}
            </TouchableOpacity>
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
  editHint: { fontSize: 10, fontFamily: 'Inter_400Regular', marginRight: 4 },
  body: { maxHeight: 200, paddingHorizontal: 10, paddingBottom: 10 },
  row: { flexDirection: 'row', gap: 8, paddingVertical: 4, alignItems: 'center' },
  key: { fontSize: 11, fontFamily: 'Inter_400Regular', flex: 1 },
  val: { fontSize: 11, fontFamily: 'Inter_400Regular', flex: 1, textAlign: 'right' },
  editInput: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    textAlign: 'right',
  },
});
