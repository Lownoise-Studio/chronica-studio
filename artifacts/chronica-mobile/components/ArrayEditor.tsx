import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export interface ArrayEditorSuggestion {
  label: string;
  value: string;
}

export function ArrayEditor({
  label,
  items,
  onChange,
  placeholder,
  hint,
  suggestions,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  hint?: string;
  suggestions?: ArrayEditorSuggestion[];
}) {
  const colors = useColors();
  const [newItem, setNewItem] = useState('');

  const add = () => {
    const t = newItem.trim();
    if (!t) return;
    onChange([...items, t]);
    setNewItem('');
  };

  const activeSuggestions = suggestions?.filter(s => s.label.length > 0) ?? [];

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      {!!hint && <Text style={[styles.hint, { color: colors.mutedForeground }]}>{hint}</Text>}

      {activeSuggestions.length > 0 && (
        <View style={styles.suggestionsWrap}>
          <Text style={[styles.suggestTitle, { color: colors.mutedForeground }]}>
            Variables from your story:
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {activeSuggestions.map(s => {
              const alreadyAdded = items.some(it => it === s.value);
              const isSelected = newItem === s.value;
              return (
                <TouchableOpacity
                  key={s.label}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? colors.primary + '22' : colors.secondary,
                      borderColor: isSelected ? colors.primary : alreadyAdded ? colors.primary + '55' : colors.border,
                      opacity: alreadyAdded ? 0.5 : 1,
                    },
                  ]}
                  onPress={() => {
                    if (alreadyAdded) return;
                    setNewItem(s.value);
                  }}
                  activeOpacity={0.7}
                >
                  {alreadyAdded && (
                    <Feather name="check" size={10} color={colors.primary} />
                  )}
                  <Text style={[styles.chipText, { color: isSelected ? colors.primary : colors.foreground }]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

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
  suggestionsWrap: { gap: 4 },
  suggestTitle: { fontSize: 10, fontFamily: 'Inter_400Regular', letterSpacing: 0.3 },
  chipsRow: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
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
