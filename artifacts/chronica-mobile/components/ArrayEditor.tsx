import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export function ArrayEditor({
  label,
  items,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  hint?: string;
}) {
  const colors = useColors();
  const [newItem, setNewItem] = useState('');

  const add = () => {
    const t = newItem.trim();
    if (!t) return;
    onChange([...items, t]);
    setNewItem('');
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      {!!hint && <Text style={[styles.hint, { color: colors.mutedForeground }]}>{hint}</Text>}
      {items.map((item, i) => (
        <View key={i} style={[styles.row, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <TextInput
            style={[styles.rowInput, { color: colors.foreground }]}
            value={item}
            onChangeText={v => onChange(items.map((x, j) => j === i ? v : x))}
            placeholderTextColor={colors.mutedForeground}
            autoCorrect={false}
            spellCheck={false}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => onChange(items.filter((_, j) => j !== i))}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={15} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      ))}
      <View style={[styles.row, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <TextInput
          style={[styles.rowInput, { color: colors.foreground }]}
          value={newItem}
          onChangeText={setNewItem}
          placeholder={placeholder || 'Add...'}
          placeholderTextColor={colors.mutedForeground}
          autoCorrect={false}
          spellCheck={false}
          autoCapitalize="none"
          onSubmitEditing={add}
          returnKeyType="done"
        />
        <TouchableOpacity onPress={add} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="plus" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.8 },
  hint: { fontSize: 11, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  rowInput: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular' },
});
