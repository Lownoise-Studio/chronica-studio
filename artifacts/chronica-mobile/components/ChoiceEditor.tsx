import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Choice } from '@/engine/types';

const generateId = (): string =>
  Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

export function ChoiceEditor({
  choices,
  onChange,
}: {
  choices: Choice[];
  onChange: (choices: Choice[]) => void;
}) {
  const colors = useColors();

  const add = () =>
    onChange([...choices, { uid: generateId(), label: '', action: '' }]);

  const update = (uid: string, patch: Partial<Choice>) =>
    onChange(choices.map(c => c.uid === uid ? { ...c, ...patch } : c));

  const remove = (uid: string) => onChange(choices.filter(c => c.uid !== uid));

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>CHOICES</Text>
      {choices.map((choice, i) => (
        <View key={choice.uid} style={[styles.card, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardNum, { color: colors.mutedForeground }]}>Choice {i + 1}</Text>
            <TouchableOpacity onPress={() => remove(choice.uid)}>
              <Feather name="trash-2" size={14} color={colors.destructive} />
            </TouchableOpacity>
          </View>
          <View style={[styles.field, { borderBottomColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Label</Text>
            <TextInput
              style={[styles.fieldInput, { color: colors.foreground }]}
              value={choice.label}
              onChangeText={v => update(choice.uid, { label: v })}
              placeholder="Text shown to player"
              placeholderTextColor={colors.mutedForeground}
            />
          </View>
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Action</Text>
            <TextInput
              style={[styles.fieldInput, { color: colors.foreground }]}
              value={choice.action}
              onChangeText={v => update(choice.uid, { action: v })}
              placeholder="goto:location or variables.x += 1"
              placeholderTextColor={colors.mutedForeground}
              autoCorrect={false}
              spellCheck={false}
              autoCapitalize="none"
            />
          </View>
        </View>
      ))}
      <TouchableOpacity
        style={[styles.addBtn, { borderColor: colors.primary }]}
        onPress={add}
        activeOpacity={0.8}
      >
        <Feather name="plus" size={15} color={colors.primary} />
        <Text style={[styles.addBtnText, { color: colors.primary }]}>Add Choice</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  label: { fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.8 },
  card: { borderRadius: 10, borderWidth: 1, padding: 12, gap: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardNum: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  field: { borderBottomWidth: 1, paddingBottom: 8, gap: 2 },
  fieldLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  fieldInput: { fontSize: 13, fontFamily: 'Inter_400Regular', minHeight: 28 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingVertical: 12,
  },
  addBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
});
