import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAdvancedMode } from '@/context/AdvancedModeContext';
import { Fragment, SceneHotspot } from '@/engine/types';
import { createId } from '@/engine/identity';
import {
  getGotoTarget,
  getSceneOptions,
  isValidDestination,
  type SceneOption,
} from '@/engine/editor-helpers';
import { ArrayEditor } from './ArrayEditor';

const DEFAULT_BOUNDS = { x: 0.35, y: 0.35, width: 0.3, height: 0.3 };

function ScenePicker({
  scenes,
  selectedLocationId,
  onSelect,
}: {
  scenes: SceneOption[];
  selectedLocationId: string | null;
  onSelect: (locationId: string) => void;
}) {
  const colors = useColors();
  if (!scenes.length) return null;

  return (
    <View style={styles.scenePicker}>
      <Text style={[styles.scenePickerTitle, { color: colors.mutedForeground }]}>
        Scenes in your story:
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {scenes.map(scene => {
          const selected = selectedLocationId === scene.locationId;
          return (
            <TouchableOpacity
              key={scene.uid}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? colors.primary + '22' : colors.muted,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
              onPress={() => onSelect(scene.locationId)}
              activeOpacity={0.7}
            >
              {selected && <Feather name="check" size={10} color={colors.primary} />}
              <Text
                style={[styles.chipText, { color: selected ? colors.primary : colors.foreground }]}
                numberOfLines={1}
              >
                {scene.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function BoundsField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.boundsField}>
      <Text style={[styles.boundsLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        style={[styles.boundsInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
        value={String(value)}
        onChangeText={v => {
          const n = parseFloat(v);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={colors.mutedForeground}
      />
    </View>
  );
}

function HotspotCard({
  hotspot,
  index,
  onChange,
  onRemove,
  scenes,
}: {
  hotspot: SceneHotspot;
  index: number;
  onChange: (patch: Partial<SceneHotspot>) => void;
  onRemove: () => void;
  scenes: SceneOption[];
}) {
  const colors = useColors();
  const { advancedMode } = useAdvancedMode();
  const [showConditions, setShowConditions] = useState((hotspot.conditions?.length ?? 0) > 0);

  const gotoTarget = getGotoTarget(hotspot.action);
  const knownLocations = scenes.map(s => s.locationId);
  const isBrokenLink = gotoTarget !== null && !isValidDestination(gotoTarget, knownLocations);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>
          Hotspot {index + 1}
        </Text>
        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="trash-2" size={15} color={colors.destructive} />
        </TouchableOpacity>
      </View>

      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Label</Text>
        <TextInput
          style={[styles.fieldInput, { color: colors.foreground }]}
          value={hotspot.label}
          onChangeText={v => onChange({ label: v })}
          placeholder="e.g. Lantern"
          placeholderTextColor={colors.mutedForeground}
        />
      </View>

      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>TAP REGION (0–1)</Text>
      <View style={styles.boundsRow}>
        <BoundsField label="X" value={hotspot.x} onChange={x => onChange({ x })} />
        <BoundsField label="Y" value={hotspot.y} onChange={y => onChange({ y })} />
        <BoundsField label="W" value={hotspot.width} onChange={width => onChange({ width })} />
        <BoundsField label="H" value={hotspot.height} onChange={height => onChange({ height })} />
      </View>

      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Action</Text>
        <TextInput
          style={[styles.fieldInput, { color: isBrokenLink ? colors.destructive : colors.foreground }]}
          value={gotoTarget ?? hotspot.action}
          onChangeText={v => {
            const cleaned = v.trim();
            onChange({ action: cleaned ? `goto:${cleaned}` : '' });
          }}
          placeholder="Pick a scene below"
          placeholderTextColor={colors.mutedForeground}
          autoCorrect={false}
          spellCheck={false}
          autoCapitalize="none"
        />
        {advancedMode && (
          <TextInput
            style={[styles.fieldInput, { color: colors.foreground, marginTop: 6 }]}
            value={hotspot.action}
            onChangeText={action => onChange({ action })}
            placeholder="goto:scene; variables.found = true"
            placeholderTextColor={colors.mutedForeground}
            autoCorrect={false}
            spellCheck={false}
            autoCapitalize="none"
          />
        )}
      </View>
      <ScenePicker
        scenes={scenes}
        selectedLocationId={gotoTarget}
        onSelect={locationId => onChange({ action: `goto:${locationId}` })}
      />

      <TouchableOpacity onPress={() => setShowConditions(!showConditions)} style={styles.toggleRow}>
        <Feather name={showConditions ? 'chevron-down' : 'chevron-right'} size={14} color={colors.mutedForeground} />
        <Text style={[styles.toggleText, { color: colors.mutedForeground }]}>
          {showConditions ? 'Hide conditions' : 'Add show-when conditions'}
        </Text>
      </TouchableOpacity>
      {showConditions && (
        <ArrayEditor
          label="SHOW WHEN"
          items={hotspot.conditions ?? []}
          onChange={conditions => onChange({ conditions })}
          placeholder={advancedMode ? 'variables.foundLantern = true' : 'e.g. variables.key = true'}
        />
      )}
    </View>
  );
}

export function HotspotEditor({
  hotspots,
  onChange,
  fragments,
}: {
  hotspots: SceneHotspot[];
  onChange: (hotspots: SceneHotspot[]) => void;
  fragments: Fragment[];
}) {
  const colors = useColors();

  const scenes = useMemo(() => getSceneOptions(fragments), [fragments]);

  const add = () =>
    onChange([
      ...hotspots,
      {
        uid: createId(),
        label: '',
        ...DEFAULT_BOUNDS,
        action: '',
        conditions: [],
      },
    ]);

  const update = (uid: string, patch: Partial<SceneHotspot>) =>
    onChange(hotspots.map(h => h.uid === uid ? { ...h, ...patch } : h));

  const remove = (uid: string) => onChange(hotspots.filter(h => h.uid !== uid));

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>HOTSPOTS</Text>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        Tap regions on the scene background during playtest (requires a background image).
      </Text>
      {hotspots.map((hotspot, i) => (
        <HotspotCard
          key={hotspot.uid}
          hotspot={hotspot}
          index={i}
          onChange={patch => update(hotspot.uid, patch)}
          onRemove={() => remove(hotspot.uid)}
          scenes={scenes}
        />
      ))}
      <TouchableOpacity
        style={[styles.addBtn, { borderColor: colors.primary }]}
        onPress={add}
        activeOpacity={0.8}
      >
        <Feather name="plus" size={15} color={colors.primary} />
        <Text style={[styles.addBtnText, { color: colors.primary }]}>Add Hotspot</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  label: { fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.8 },
  hint: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: -4 },
  card: { borderRadius: 10, borderWidth: 1, padding: 12, gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  field: { gap: 4 },
  fieldLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.6 },
  fieldInput: { fontSize: 14, fontFamily: 'Inter_400Regular', paddingVertical: 4 },
  boundsRow: { flexDirection: 'row', gap: 8 },
  boundsField: { flex: 1, gap: 4 },
  boundsLabel: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  boundsInput: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13, fontFamily: 'Inter_400Regular' },
  scenePicker: { gap: 6 },
  scenePickerTitle: { fontSize: 10, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.6 },
  chipsRow: { gap: 6, paddingVertical: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: 'Inter_400Regular', maxWidth: 120 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', paddingVertical: 10 },
  addBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
});
