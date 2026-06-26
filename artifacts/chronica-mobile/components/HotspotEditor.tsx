import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAdvancedMode } from '@/context/AdvancedModeContext';
import { Fragment, ProjectAsset, SceneHotspot } from '@/engine/types';
import { resolveSceneBackgroundUri } from '@/engine/asset-resolver';
import { createId } from '@/engine/identity';
import {
  getGotoTarget,
  getSceneOptions,
  isValidDestination,
  type SceneOption,
} from '@/engine/editor-helpers';
import {
  DEFAULT_HOTSPOT_SIZE,
  getHotspotDisplayLabel,
  HOTSPOT_NUDGE_STEP,
  nudgeHotspot,
  resizeHotspot,
  summarizeHotspotAction,
  type HotspotResizeDirection,
} from '@/engine/hotspot-helpers';
import { ArrayEditor } from './ArrayEditor';
import { HotspotPreviewCanvas } from './HotspotPreviewCanvas';

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
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Quick link to scene</Text>
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

function ResizeButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.resizeBtn, { borderColor: colors.border, backgroundColor: colors.muted }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.resizeBtnText, { color: colors.foreground }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function HotspotCard({
  hotspot,
  index,
  selected,
  onSelect,
  onChange,
  onRemove,
  scenes,
}: {
  hotspot: SceneHotspot;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<SceneHotspot>) => void;
  onRemove: () => void;
  scenes: SceneOption[];
}) {
  const colors = useColors();
  const { advancedMode } = useAdvancedMode();
  const [showConditions, setShowConditions] = useState((hotspot.conditions?.length ?? 0) > 0);

  const ordinal = index + 1;
  const displayLabel = getHotspotDisplayLabel(hotspot, ordinal);
  const gotoTarget = getGotoTarget(hotspot.action);
  const knownLocations = scenes.map(s => s.locationId);
  const isBrokenLink = gotoTarget !== null && !isValidDestination(gotoTarget, knownLocations);
  const actionSummary = summarizeHotspotAction(hotspot.action, id =>
    scenes.find(s => s.locationId === id)?.title,
  );

  const applyBounds = (patch: Partial<SceneHotspot>) => onChange(patch);

  const nudge = (dx: number, dy: number) => {
    applyBounds(nudgeHotspot(hotspot, dx, dy));
  };

  const resize = (direction: HotspotResizeDirection) => {
    applyBounds(resizeHotspot(hotspot, direction));
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onSelect}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>{displayLabel}</Text>
        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="trash-2" size={15} color={colors.destructive} />
        </TouchableOpacity>
      </View>

      <Text style={[styles.actionSummary, { color: colors.mutedForeground }]}>{actionSummary}</Text>

      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Label</Text>
        <TextInput
          style={[styles.fieldInput, { color: colors.foreground, borderColor: colors.border }]}
          value={hotspot.label}
          onChangeText={label => onChange({ label })}
          placeholder={`Hotspot ${ordinal}`}
          placeholderTextColor={colors.mutedForeground}
        />
      </View>

      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Position</Text>
      <View style={styles.nudgeRow}>
        <TouchableOpacity style={[styles.nudgeBtn, { borderColor: colors.border }]} onPress={() => nudge(-HOTSPOT_NUDGE_STEP, 0)}>
          <Feather name="arrow-left" size={14} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.nudgeBtn, { borderColor: colors.border }]} onPress={() => nudge(0, -HOTSPOT_NUDGE_STEP)}>
          <Feather name="arrow-up" size={14} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.nudgeBtn, { borderColor: colors.border }]} onPress={() => nudge(0, HOTSPOT_NUDGE_STEP)}>
          <Feather name="arrow-down" size={14} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.nudgeBtn, { borderColor: colors.border }]} onPress={() => nudge(HOTSPOT_NUDGE_STEP, 0)}>
          <Feather name="arrow-right" size={14} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Size</Text>
      <View style={styles.resizeRow}>
        <ResizeButton label="Wider" onPress={() => resize('wider')} />
        <ResizeButton label="Narrower" onPress={() => resize('narrower')} />
        <ResizeButton label="Taller" onPress={() => resize('taller')} />
        <ResizeButton label="Shorter" onPress={() => resize('shorter')} />
      </View>

      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Tap action</Text>
      <ScenePicker
        scenes={scenes}
        selectedLocationId={gotoTarget}
        onSelect={locationId => onChange({ action: `goto:${locationId}` })}
      />
      {isBrokenLink && (
        <Text style={[styles.errorText, { color: colors.destructive }]}>
          Destination scene not found
        </Text>
      )}

      {advancedMode && (
        <>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Action string</Text>
          <TextInput
            style={[styles.actionInput, { color: colors.foreground, borderColor: colors.border }]}
            value={hotspot.action}
            onChangeText={action => onChange({ action })}
            placeholder="goto:scene; variables.found = true"
            placeholderTextColor={colors.mutedForeground}
            autoCorrect={false}
            spellCheck={false}
            autoCapitalize="none"
          />
        </>
      )}

      <TouchableOpacity onPress={() => setShowConditions(!showConditions)} style={styles.toggleRow}>
        <Feather name={showConditions ? 'chevron-down' : 'chevron-right'} size={14} color={colors.mutedForeground} />
        <Text style={[styles.toggleText, { color: colors.mutedForeground }]}>
          {showConditions ? 'Hide conditions' : 'Show only when…'}
        </Text>
      </TouchableOpacity>
      {showConditions && (
        <ArrayEditor
          label="SHOW WHEN"
          items={hotspot.conditions ?? []}
          onChange={conditions => onChange({ conditions })}
          placeholder={advancedMode ? 'variables.foundLantern == true' : 'e.g. variables.key == true'}
        />
      )}
    </TouchableOpacity>
  );
}

export function HotspotEditor({
  hotspots,
  onChange,
  fragments,
  backgroundImage,
  assets,
}: {
  hotspots: SceneHotspot[];
  onChange: (hotspots: SceneHotspot[]) => void;
  fragments: Fragment[];
  backgroundImage?: string;
  assets: ProjectAsset[];
}) {
  const colors = useColors();
  const [selectedUid, setSelectedUid] = useState<string | null>(hotspots[0]?.uid ?? null);

  const scenes = useMemo(() => getSceneOptions(fragments), [fragments]);
  const backgroundUri = resolveSceneBackgroundUri(assets, backgroundImage);

  const update = (uid: string, patch: Partial<SceneHotspot>) =>
    onChange(hotspots.map(h => h.uid === uid ? { ...h, ...patch } : h));

  const remove = (uid: string) => {
    onChange(hotspots.filter(h => h.uid !== uid));
    if (selectedUid === uid) setSelectedUid(null);
  };

  const placeHotspot = (x: number, y: number) => {
    const ordinal = hotspots.length + 1;
    const uid = createId();
    const next: SceneHotspot = {
      uid,
      label: `Hotspot ${ordinal}`,
      x,
      y,
      width: DEFAULT_HOTSPOT_SIZE,
      height: DEFAULT_HOTSPOT_SIZE,
      action: '',
      conditions: [],
    };
    onChange([...hotspots, next]);
    setSelectedUid(uid);
  };

  const selected = hotspots.find(h => h.uid === selectedUid) ?? null;
  const selectedIndex = selected ? hotspots.indexOf(selected) : -1;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>INTERACTIVE HOTSPOTS</Text>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        Tap the preview to place a region. Drag-style resize uses the size buttons below.
      </Text>

      <HotspotPreviewCanvas
        backgroundUri={backgroundUri}
        hotspots={hotspots}
        mode="edit"
        selectedUid={selectedUid}
        sceneOptions={scenes}
        onSelect={setSelectedUid}
        onPlace={placeHotspot}
      />

      {hotspots.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hotspotTabs}>
          {hotspots.map((hotspot, i) => {
            const active = hotspot.uid === selectedUid;
            return (
              <TouchableOpacity
                key={hotspot.uid}
                style={[
                  styles.hotspotTab,
                  {
                    backgroundColor: active ? colors.primary + '22' : colors.muted,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setSelectedUid(hotspot.uid)}
              >
                <Text style={[styles.hotspotTabText, { color: active ? colors.primary : colors.foreground }]}>
                  {getHotspotDisplayLabel(hotspot, i + 1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {selected && selectedIndex >= 0 ? (
        <HotspotCard
          hotspot={selected}
          index={selectedIndex}
          selected
          onSelect={() => setSelectedUid(selected.uid)}
          onChange={patch => update(selected.uid, patch)}
          onRemove={() => remove(selected.uid)}
          scenes={scenes}
        />
      ) : hotspots.length > 0 ? (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Select a hotspot tab or tap a region to edit label, size, and tap action.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  label: { fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.8 },
  hint: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: -6 },
  errorText: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  actionSummary: { fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: -4 },
  card: { borderRadius: 10, borderWidth: 1, padding: 12, gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  field: { gap: 4 },
  fieldLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.6 },
  fieldInput: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionInput: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  nudgeRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  nudgeBtn: {
    width: 40,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resizeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  resizeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  resizeBtnText: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  scenePicker: { gap: 6 },
  chipsRow: { gap: 6, paddingVertical: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: 'Inter_400Regular', maxWidth: 120 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  hotspotTabs: { gap: 8, paddingVertical: 2 },
  hotspotTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  hotspotTabText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
});
