import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAdvancedMode } from '@/context/AdvancedModeContext';
import { Choice } from '@/engine/types';
import { ArrayEditor } from './ArrayEditor';

const generateId = (): string =>
  Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

function getGotoTarget(action: string): string | null {
  const steps = action.split(';').map(s => s.trim());
  for (const step of steps) {
    if (step.startsWith('goto:')) return step.slice(5).trim();
  }
  return null;
}

function ChoiceCard({
  choice, index, onChange, onRemove, knownLocations,
}: {
  choice: Choice;
  index: number;
  onChange: (patch: Partial<Choice>) => void;
  onRemove: () => void;
  knownLocations?: Set<string>;
}) {
  const colors = useColors();
  const { advancedMode } = useAdvancedMode();
  const [showConditions, setShowConditions] = useState(!!(choice.conditions?.length));

  const gotoTarget = getGotoTarget(choice.action);
  const isBrokenLink = gotoTarget && knownLocations && !knownLocations.has(gotoTarget);

  return (
    <View style={[styles.card, { backgroundColor: colors.secondary, borderColor: isBrokenLink ? colors.destructive + '88' : colors.border }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardNum, { color: colors.mutedForeground }]}>Choice {index + 1}</Text>
        {isBrokenLink && (
          <View style={styles.brokenBadge}>
            <Feather name="alert-circle" size={11} color={colors.destructive} />
            <Text style={[styles.brokenText, { color: colors.destructive }]}>
              Scene "{gotoTarget}" not found
            </Text>
          </View>
        )}
        <View style={styles.cardActions}>
          <TouchableOpacity
            onPress={() => setShowConditions(!showConditions)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="filter" size={14} color={showConditions ? colors.primary : colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="trash-2" size={14} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.field, { borderBottomColor: colors.border }]}>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Label</Text>
        <TextInput
          style={[styles.fieldInput, { color: colors.foreground }]}
          value={choice.label}
          onChangeText={v => onChange({ label: v })}
          placeholder="Text shown to the reader"
          placeholderTextColor={colors.mutedForeground}
        />
      </View>

      {advancedMode ? (
        <View style={[styles.field, showConditions ? { borderBottomColor: colors.border } : {}]}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Action</Text>
          <TextInput
            style={[styles.fieldInput, { color: isBrokenLink ? colors.destructive : colors.foreground }]}
            value={choice.action}
            onChangeText={v => onChange({ action: v })}
            placeholder="goto:location  ·  set:flag  ·  variables.x += 1"
            placeholderTextColor={colors.mutedForeground}
            autoCorrect={false}
            spellCheck={false}
            autoCapitalize="none"
          />
          <Text style={[styles.actionHint, { color: colors.mutedForeground }]}>
            goto:sceneId to navigate  ·  semicolons for multiple steps
          </Text>
        </View>
      ) : (
        <View style={[styles.field, showConditions ? { borderBottomColor: colors.border } : {}]}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Destination</Text>
          <TextInput
            style={[styles.fieldInput, { color: isBrokenLink ? colors.destructive : colors.foreground }]}
            value={choice.action.startsWith('goto:') ? choice.action.slice(5) : choice.action}
            onChangeText={v => {
              const cleaned = v.trim();
              onChange({ action: cleaned ? `goto:${cleaned}` : '' });
            }}
            placeholder="scene-id"
            placeholderTextColor={colors.mutedForeground}
            autoCorrect={false}
            spellCheck={false}
            autoCapitalize="none"
          />
          <Text style={[styles.actionHint, { color: colors.mutedForeground }]}>
            Scene ID this choice leads to
          </Text>
        </View>
      )}

      {showConditions && (
        <View style={{ marginTop: 4 }}>
          <ArrayEditor
            label="SHOW WHEN"
            items={choice.conditions ?? []}
            onChange={conditions => onChange({ conditions })}
            placeholder={advancedMode ? 'variables.trust >= 2' : 'e.g. variables.trust >= 2'}
            hint="All must be met for this choice to appear"
          />
        </View>
      )}
    </View>
  );
}

export function ChoiceEditor({
  choices,
  onChange,
  knownLocations,
}: {
  choices: Choice[];
  onChange: (choices: Choice[]) => void;
  knownLocations?: Set<string>;
}) {
  const colors = useColors();

  const add = () =>
    onChange([...choices, { uid: generateId(), label: '', action: '', conditions: [] }]);

  const update = (uid: string, patch: Partial<Choice>) =>
    onChange(choices.map(c => c.uid === uid ? { ...c, ...patch } : c));

  const remove = (uid: string) => onChange(choices.filter(c => c.uid !== uid));

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>CHOICES</Text>
      {choices.map((choice, i) => (
        <ChoiceCard
          key={choice.uid}
          choice={choice}
          index={i}
          onChange={patch => update(choice.uid, patch)}
          onRemove={() => remove(choice.uid)}
          knownLocations={knownLocations}
        />
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
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardNum: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  brokenBadge: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  brokenText: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  cardActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  field: { borderBottomWidth: 1, paddingBottom: 8, gap: 2 },
  fieldLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  fieldInput: { fontSize: 13, fontFamily: 'Inter_400Regular', minHeight: 28 },
  actionHint: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 2 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', paddingVertical: 12,
  },
  addBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
});
