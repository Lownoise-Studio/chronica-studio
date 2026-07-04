import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAdvancedMode } from '@/context/AdvancedModeContext';
import { createId } from '@/engine/identity';
import type { Character, InventoryItem, NpcStateProfile, ProjectAsset, StageActor, StageActorGameplayState } from '@/engine/types';
import { ArrayEditor, type ArrayEditorSuggestion } from './ArrayEditor';

const NPC_STATES: StageActorGameplayState[] = ['idle', 'following', 'hidden', 'hostile', 'friendly', 'disabled'];
const NUDGE = 0.05;

function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T | undefined;
  onChange: (next: T) => void;
}) {
  const colors = useColors();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
      {options.map(option => {
        const selected = value === option;
        return (
          <TouchableOpacity
            key={option}
            style={[styles.chip, { backgroundColor: selected ? colors.primary + '22' : colors.muted, borderColor: selected ? colors.primary : colors.border }]}
            onPress={() => onChange(option)}
          >
            <Text style={[styles.chipText, { color: selected ? colors.primary : colors.foreground }]}>{option}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export function StageActorEditor({
  stageActors,
  onChange,
  assets,
  characters,
  npcProfiles = [],
  conditionSuggestions = [],
}: {
  stageActors: StageActor[];
  onChange: (actors: StageActor[]) => void;
  assets: ProjectAsset[];
  characters: Character[];
  npcProfiles?: NpcStateProfile[];
  conditionSuggestions?: ArrayEditorSuggestion[];
}) {
  const colors = useColors();
  const { advancedMode } = useAdvancedMode();
  const [selectedUid, setSelectedUid] = useState<string | null>(stageActors[0]?.uid ?? null);

  const imageAssets = useMemo(() => assets.filter(a => a.type === 'image').map(a => a.name), [assets]);
  const selected = stageActors.find(a => a.uid === selectedUid) ?? null;
  const selectedIndex = selected ? stageActors.indexOf(selected) : -1;

  const update = (uid: string, patch: Partial<StageActor>) =>
    onChange(stageActors.map(a => (a.uid === uid ? { ...a, ...patch } : a)));

  const addActor = () => {
    const uid = createId();
    const next: StageActor = {
      uid,
      label: `Actor ${stageActors.length + 1}`,
      asset: imageAssets[0] ?? '',
      x: 0.5,
      y: 0.85,
      width: 0.3,
      gameplayState: 'idle',
    };
    onChange([...stageActors, next]);
    setSelectedUid(uid);
  };

  const applyNpcProfile = (uid: string, profileId: string) => {
    const profile = npcProfiles.find(p => p.id === profileId);
    if (!profile) return;
    const character = characters.find(c => c.characterId === profile.characterId);
    update(uid, {
      label: profile.label,
      characterId: profile.characterId,
      gameplayState: profile.defaultState,
      stateVariable: profile.stateVariable,
      asset: character?.defaultPortrait ?? imageAssets[0] ?? '',
    });
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>STAGE ACTORS</Text>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        Place NPCs and props on the scene stage. Gameplay state maps to variables the runtime already reads.
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {stageActors.map((actor, i) => {
          const active = actor.uid === selectedUid;
          return (
            <TouchableOpacity
              key={actor.uid}
              style={[styles.tab, { backgroundColor: active ? colors.primary + '22' : colors.muted, borderColor: active ? colors.primary : colors.border }]}
              onPress={() => setSelectedUid(actor.uid)}
            >
              <Text style={[styles.tabText, { color: active ? colors.primary : colors.foreground }]}>
                {actor.label?.trim() || `Actor ${i + 1}`}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity style={[styles.tab, { borderColor: colors.border }]} onPress={addActor}>
          <Feather name="plus" size={14} color={colors.primary} />
        </TouchableOpacity>
      </ScrollView>

      {selected && selectedIndex >= 0 ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>{selected.label || `Actor ${selectedIndex + 1}`}</Text>
            <TouchableOpacity onPress={() => {
              onChange(stageActors.filter(a => a.uid !== selected.uid));
              setSelectedUid(null);
            }}>
              <Feather name="trash-2" size={15} color={colors.destructive} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Label</Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
            value={selected.label ?? ''}
            onChangeText={label => update(selected.uid, { label })}
          />

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Sprite asset</Text>
          <ChipRow options={imageAssets.length ? imageAssets : ['']} value={selected.asset} onChange={asset => update(selected.uid, { asset })} />

          {npcProfiles.length > 0 && (
            <>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Apply NPC profile</Text>
              <ChipRow
                options={npcProfiles.map(p => p.id)}
                value={undefined}
                onChange={profileId => applyNpcProfile(selected.uid, profileId)}
              />
            </>
          )}

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Gameplay state</Text>
          <ChipRow
            options={NPC_STATES}
            value={selected.gameplayState ?? 'idle'}
            onChange={gameplayState => update(selected.uid, { gameplayState })}
          />

          {advancedMode && (
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
              value={selected.stateVariable ?? ''}
              onChangeText={stateVariable => update(selected.uid, { stateVariable })}
              placeholder="variables.npc_state"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
            />
          )}

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Position</Text>
          <View style={styles.nudgeRow}>
            <TouchableOpacity style={[styles.nudgeBtn, { borderColor: colors.border }]} onPress={() => update(selected.uid, { x: Math.max(0, selected.x - NUDGE) })}>
              <Feather name="arrow-left" size={14} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.nudgeBtn, { borderColor: colors.border }]} onPress={() => update(selected.uid, { y: Math.max(0, selected.y - NUDGE) })}>
              <Feather name="arrow-up" size={14} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.nudgeBtn, { borderColor: colors.border }]} onPress={() => update(selected.uid, { y: Math.min(1, selected.y + NUDGE) })}>
              <Feather name="arrow-down" size={14} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.nudgeBtn, { borderColor: colors.border }]} onPress={() => update(selected.uid, { x: Math.min(1, selected.x + NUDGE) })}>
              <Feather name="arrow-right" size={14} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <ArrayEditor
            label="SHOW WHEN"
            items={selected.visibleWhen ?? []}
            onChange={visibleWhen => update(selected.uid, { visibleWhen })}
            placeholder="variables.door_unlocked == true"
            suggestions={conditionSuggestions}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  label: { fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.8 },
  hint: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: -6 },
  tabs: { gap: 8 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  tabText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  card: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  fieldLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.6 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, fontFamily: 'Inter_400Regular' },
  chipsRow: { gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  nudgeRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  nudgeBtn: { width: 40, height: 36, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
