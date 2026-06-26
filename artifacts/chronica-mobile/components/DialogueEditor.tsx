import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { createId } from '@/engine/identity';
import type { Character, DialogueLine } from '@/engine/types';

function LineCard({
  line,
  index,
  characters,
  onChange,
  onRemove,
  canRemove,
}: {
  line: DialogueLine;
  index: number;
  characters: Character[];
  onChange: (patch: Partial<DialogueLine>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const colors = useColors();
  const selected = line.speakerId ? characters.find(c => c.characterId === line.speakerId) : undefined;
  const expressions = selected?.expressions ?? [];

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>Line {index + 1}</Text>
        {canRemove && (
          <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="trash-2" size={15} color={colors.destructive} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={[styles.label, { color: colors.mutedForeground }]}>SPEAKER</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <TouchableOpacity
          style={[styles.chip, {
            backgroundColor: !line.speakerId ? colors.primary + '22' : colors.muted,
            borderColor: !line.speakerId ? colors.primary : colors.border,
          }]}
          onPress={() => onChange({ speakerId: null, expressionId: undefined })}
        >
          <Text style={[styles.chipText, { color: !line.speakerId ? colors.primary : colors.foreground }]}>
            Narration
          </Text>
        </TouchableOpacity>
        {characters.map(character => {
          const active = line.speakerId === character.characterId;
          return (
            <TouchableOpacity
              key={character.uid}
              style={[styles.chip, {
                backgroundColor: active ? colors.primary + '22' : colors.muted,
                borderColor: active ? colors.primary : colors.border,
              }]}
              onPress={() => onChange({ speakerId: character.characterId, expressionId: undefined })}
            >
              <Text style={[styles.chipText, { color: active ? colors.primary : colors.foreground }]}>
                {character.displayName}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {expressions.length > 0 && (
        <>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>EXPRESSION</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {expressions.map(expression => {
              const active = line.expressionId === expression.id;
              return (
                <TouchableOpacity
                  key={expression.id}
                  style={[styles.chip, {
                    backgroundColor: active ? colors.primary + '22' : colors.muted,
                    borderColor: active ? colors.primary : colors.border,
                  }]}
                  onPress={() => onChange({ expressionId: expression.id })}
                >
                  <Text style={[styles.chipText, { color: active ? colors.primary : colors.foreground }]}>
                    {expression.label || expression.id}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      )}

      <Text style={[styles.label, { color: colors.mutedForeground }]}>TEXT</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
        value={line.text}
        onChangeText={text => onChange({ text })}
        placeholder="What does the player read here?"
        placeholderTextColor={colors.mutedForeground}
        multiline
        textAlignVertical="top"
      />
    </View>
  );
}

export function DialogueEditor({
  lines,
  characters,
  onChange,
}: {
  lines: DialogueLine[];
  characters: Character[];
  onChange: (lines: DialogueLine[]) => void;
}) {
  const colors = useColors();

  const updateLine = (index: number, patch: Partial<DialogueLine>) => {
    const next = [...lines];
    next[index] = { ...next[index]!, ...patch };
    onChange(next);
  };

  const addLine = () => {
    onChange([...lines, { uid: createId(), speakerId: null, text: '' }]);
  };

  const removeLine = (index: number) => {
    onChange(lines.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.foreground }]}>Dialogue</Text>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        Lines play in order. Players tap to advance before choices appear.
      </Text>

      {lines.map((line, index) => (
        <LineCard
          key={line.uid}
          line={line}
          index={index}
          characters={characters}
          onChange={patch => updateLine(index, patch)}
          onRemove={() => removeLine(index)}
          canRemove={lines.length > 1}
        />
      ))}

      <TouchableOpacity style={[styles.addBtn, { borderColor: colors.border }]} onPress={addLine} activeOpacity={0.8}>
        <Feather name="plus" size={15} color={colors.primary} />
        <Text style={[styles.addBtnText, { color: colors.primary }]}>Add dialogue line</Text>
      </TouchableOpacity>

      {characters.length === 0 && (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Add characters in the Cast screen to assign named speakers and portraits.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  title: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  hint: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.8 },
  label: { fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.8 },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  input: { minHeight: 90, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
  },
  addBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
