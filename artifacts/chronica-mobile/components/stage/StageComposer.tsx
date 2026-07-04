import React, { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { StageAssetPicker } from '@/components/stage/StageAssetPicker';
import { StageEditorHandles } from '@/components/stage/StageEditorHandles';
import { StageObjectInspector } from '@/components/stage/StageObjectInspector';
import { StagePreviewRenderer } from '@/components/stage/StagePreviewRenderer';
import { resolveSceneBackgroundUri } from '@/engine/asset-resolver';
import { createId } from '@/engine/identity';
import { resolveStageObjectHotspotRef } from '@/engine/stage-presentation';
import {
  insertStageObjectFromAsset,
  mergeStageScenePreset,
  STAGE_SCENE_PRESET_DEFINITIONS,
  updateStageObjectTransform,
  deleteStageObjects,
  type StageScenePresetKind,
} from '@/engine/stage-placement';
import {
  DEFAULT_SNAP_GRID,
  LIGHTING_PRESET_LABELS,
  LIGHTING_PRESETS,
  LIGHTING_PRESET_TINTS,
  STAGE_LAYER_LABELS,
  alignStageObjects,
  bringStageObjectForward,
  duplicateStageObject,
  emptyStageComposition,
  moveStageObject,
  normalizeStageComposition,
  sendStageObjectBackward,
  snapStageObject,
  sortStageObjectsByLayer,
  toggleStageObjectHidden,
  toggleStageObjectLock,
} from '@/engine/stage-authoring';
import type {
  ChronicaState,
  LightingPreset,
  ProjectAsset,
  SceneHotspot,
  StageActor,
  StageComposition,
  StageObject,
} from '@/engine/types';

export function StageComposer({
  composition,
  onChange,
  backgroundImage,
  assets,
  hotspots,
  stageActors: _stageActors,
  previewState,
  selectedObjectUid,
  highlightedHotspotUid,
  onSelectObject,
  onSelectHotspot,
  conditionSuggestions,
}: {
  composition: StageComposition | undefined;
  onChange: (next: StageComposition) => void;
  backgroundImage?: string;
  assets: ProjectAsset[];
  hotspots: SceneHotspot[];
  stageActors: StageActor[];
  previewState?: ChronicaState | null;
  selectedObjectUid?: string | null;
  highlightedHotspotUid?: string | null;
  onSelectObject?: (uid: string | null) => void;
  onSelectHotspot?: (uid: string | null) => void;
  conditionSuggestions?: { label: string; value: string; disabled?: boolean }[];
}) {
  const colors = useColors();
  const normalized = useMemo(() => normalizeStageComposition(composition), [composition]);
  const [internalSelectedUids, setInternalSelectedUids] = useState<string[]>([]);
  const selectedUids = selectedObjectUid !== undefined
    ? (selectedObjectUid ? [selectedObjectUid] : [])
    : internalSelectedUids;
  const setSelectedUids = (uids: string[]) => {
    if (onSelectObject) onSelectObject(uids[0] ?? null);
    else setInternalSelectedUids(uids);
    const object = normalized.objects.find(o => o.uid === uids[0]);
    const hotspotUid = object ? resolveStageObjectHotspotRef(object) : null;
    if (onSelectHotspot && hotspotUid) onSelectHotspot(hotspotUid);
  };
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);

  const imageAssets = useMemo(() => assets.filter(a => a.type === 'image'), [assets]);
  const defaultAssetName = imageAssets[0]?.name;
  const backgroundUri = resolveSceneBackgroundUri(assets, backgroundImage);
  const sortedObjects = useMemo(() => sortStageObjectsByLayer(normalized.objects), [normalized.objects]);
  const selectedUid = selectedUids[0] ?? null;
  const selected = sortedObjects.find(o => o.uid === selectedUid) ?? null;

  const update = useCallback((next: StageComposition) => onChange(normalizeStageComposition(next)), [onChange]);

  const setObjects = useCallback((objects: StageObject[]) => {
    update({ ...normalized, objects });
  }, [normalized, update]);

  const patchSelected = useCallback((patch: Partial<StageObject>) => {
    if (!selectedUid) return;
    setObjects(normalized.objects.map(o => (o.uid === selectedUid ? updateStageObjectTransform(o, patch, { snap: snapEnabled }) : o)));
  }, [normalized.objects, selectedUid, setObjects, snapEnabled]);

  const deleteSelected = useCallback(() => {
    if (!selectedUid) return;
    setObjects(deleteStageObjects(normalized.objects, [selectedUid]));
    setSelectedUids([]);
  }, [normalized.objects, selectedUid, setObjects]);

  const duplicateSelected = useCallback(() => {
    if (!selected) return;
    const copy = duplicateStageObject(selected, createId());
    setObjects([...normalized.objects, copy]);
    setSelectedUids([copy.uid]);
  }, [normalized.objects, selected, setObjects]);

  const insertAsset = useCallback((asset: ProjectAsset) => {
    const result = insertStageObjectFromAsset(normalized, asset, {
      createUid: createId,
      x: 0.5,
      y: 0.55,
      layer: asset.type === 'image' ? 'props' : 'effects',
    });
    update(result.composition);
    setSelectedUids([result.object.uid]);
  }, [normalized, update]);

  const applyPreset = useCallback((kind: StageScenePresetKind) => {
    const next = mergeStageScenePreset(normalized, kind, {
      assetName: defaultAssetName,
      createUid: createId,
    });
    update(next);
    const last = sortStageObjectsByLayer(next.objects).at(-1);
    if (last) setSelectedUids([last.uid]);
  }, [defaultAssetName, normalized, update]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedUid) {
        event.preventDefault();
        deleteSelected();
        return;
      }
      if (event.key === 'd' && (event.metaKey || event.ctrlKey) && selected) {
        event.preventDefault();
        duplicateSelected();
        return;
      }
      if (event.key === 'g') {
        event.preventDefault();
        setSnapEnabled(v => !v);
        return;
      }
      if (event.key === ']' && selectedUid) {
        event.preventDefault();
        setObjects(bringStageObjectForward(normalized.objects, selectedUid));
        return;
      }
      if (event.key === '[' && selectedUid) {
        event.preventDefault();
        setObjects(sendStageObjectBackward(normalized.objects, selectedUid));
        return;
      }
      if (!selected || selected.locked) return;
      const nudge = event.shiftKey ? 0.05 : 0.02;
      if (event.key === 'ArrowLeft') { event.preventDefault(); patchSelected(moveStageObject(selected, -nudge, 0, { snap: snapEnabled })); }
      if (event.key === 'ArrowRight') { event.preventDefault(); patchSelected(moveStageObject(selected, nudge, 0, { snap: snapEnabled })); }
      if (event.key === 'ArrowUp') { event.preventDefault(); patchSelected(moveStageObject(selected, 0, -nudge, { snap: snapEnabled })); }
      if (event.key === 'ArrowDown') { event.preventDefault(); patchSelected(moveStageObject(selected, 0, nudge, { snap: snapEnabled })); }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteSelected, duplicateSelected, normalized.objects, patchSelected, selected, selectedUid, setObjects, snapEnabled]);

  const onCanvasLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setCanvasSize({ width, height });
  };

  const tapToPlace = (xPx: number, yPx: number) => {
    if (!canvasSize.width || !canvasSize.height) return;
    const rawX = xPx / canvasSize.width;
    const rawY = yPx / canvasSize.height;
    const point = snapEnabled
      ? snapStageObject({ uid: '', asset: '', x: rawX, y: rawY, layer: 'props' })
      : { x: rawX, y: rawY };
    if (selected && !selected.locked) {
      patchSelected({ x: point.x, y: point.y });
      return;
    }
    if (defaultAssetName) {
      const result = insertStageObjectFromAsset(normalized, { name: defaultAssetName, type: 'image' }, {
        createUid: createId,
        x: point.x,
        y: point.y,
      });
      update(result.composition);
      setSelectedUids([result.object.uid]);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.foreground }]}>Stage composition</Text>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        Visual authoring only — gameplay still runs through hotspots and stage actors.
        {Platform.OS === 'web' ? ' Shortcuts: arrows nudge, ⌘D duplicate, Delete remove, G snap, [ ] layer order.' : ''}
      </Text>

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Scene presets</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {STAGE_SCENE_PRESET_DEFINITIONS.map(preset => (
          <TouchableOpacity
            key={preset.kind}
            style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={() => applyPreset(preset.kind)}
          >
            <Text style={[styles.chipText, { color: colors.foreground }]} numberOfLines={1}>{preset.title}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Lighting preset</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {LIGHTING_PRESETS.map(preset => {
          const active = normalized.lightingPreset === preset;
          return (
            <TouchableOpacity
              key={preset}
              style={[styles.chip, { backgroundColor: active ? colors.primary + '22' : colors.muted, borderColor: active ? colors.primary : colors.border }]}
              onPress={() => update({ ...normalized, lightingPreset: preset })}
            >
              <Text style={[styles.chipText, { color: active ? colors.primary : colors.foreground }]}>{LIGHTING_PRESET_LABELS[preset]}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Camera guides</Text>
      <View style={styles.guideRow}>
        {([
          ['safeArea', 'Safe area'],
          ['aspectGuide', 'Aspect'],
          ['centerGuides', 'Center'],
          ['ruleOfThirds', 'Thirds'],
        ] as const).map(([key, label]) => {
          const active = !!normalized.cameraGuides?.[key];
          return (
            <TouchableOpacity
              key={key}
              style={[styles.guideChip, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary + '18' : colors.card }]}
              onPress={() => update({
                ...normalized,
                cameraGuides: { ...normalized.cameraGuides, [key]: !active },
              })}
            >
              <Text style={{ color: active ? colors.primary : colors.foreground, fontSize: 11, fontFamily: 'Inter_500Medium' }}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.toolbar}>
        <ToolButton icon="image" label="Assets" onPress={() => setAssetPickerOpen(true)} colors={colors} />
        <ToolButton icon="copy" label="Duplicate" disabled={!selected} onPress={duplicateSelected} colors={colors} />
        <ToolButton icon="trash-2" label="Delete" disabled={!selected} onPress={deleteSelected} colors={colors} />
        <ToolButton icon="lock" label="Lock" disabled={!selected} onPress={() => {
          if (!selectedUid) return;
          setObjects(normalized.objects.map(o => o.uid === selectedUid ? toggleStageObjectLock(o) : o));
        }} colors={colors} />
        <ToolButton icon="eye-off" label="Hide" disabled={!selected} onPress={() => {
          if (!selectedUid) return;
          setObjects(normalized.objects.map(o => o.uid === selectedUid ? toggleStageObjectHidden(o) : o));
        }} colors={colors} />
        <ToolButton icon="grid" label={snapEnabled ? 'Snap on' : 'Snap off'} onPress={() => setSnapEnabled(v => !v)} colors={colors} active={snapEnabled} />
      </View>

      <View style={styles.toolbar}>
        <ToolButton icon="arrow-up" label="Align top" disabled={selectedUids.length < 2} onPress={() => setObjects(alignStageObjects(normalized.objects, selectedUids, 'top'))} colors={colors} />
        <ToolButton icon="minus" label="Align mid" disabled={selectedUids.length < 2} onPress={() => setObjects(alignStageObjects(normalized.objects, selectedUids, 'center-y'))} colors={colors} />
        <ToolButton icon="chevrons-up" label="Forward" disabled={!selectedUid} onPress={() => selectedUid && setObjects(bringStageObjectForward(normalized.objects, selectedUid))} colors={colors} />
        <ToolButton icon="chevrons-down" label="Back" disabled={!selectedUid} onPress={() => selectedUid && setObjects(sendStageObjectBackward(normalized.objects, selectedUid))} colors={colors} />
      </View>

      <Pressable style={[styles.canvas, { borderColor: colors.border, backgroundColor: colors.muted }]} onLayout={onCanvasLayout} onPress={event => tapToPlace(event.nativeEvent.locationX, event.nativeEvent.locationY)}>
        {backgroundUri ? (
          <Image source={{ uri: backgroundUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={styles.canvasEmpty}>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Choose a background image to compose</Text>
          </View>
        )}
        {normalized.lightingPreset && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: LIGHTING_PRESET_TINTS[normalized.lightingPreset as LightingPreset] }]} pointerEvents="none" />
        )}
        <CameraGuidesOverlay guides={normalized.cameraGuides} colors={colors} />
        <StagePreviewRenderer
          composition={normalized}
          assets={assets}
          canvasWidth={canvasSize.width}
          canvasHeight={canvasSize.height}
          hotspots={hotspots}
          previewState={previewState}
          mode="editor"
          selectedObjectUid={selectedUid}
          highlightedHotspotUid={highlightedHotspotUid}
          showHotspotLinks
          onObjectPress={object => setSelectedUids([object.uid])}
        />
        {selected && (
          <StageEditorHandles
            object={selected}
            canvasWidth={canvasSize.width}
            canvasHeight={canvasSize.height}
            snapEnabled={snapEnabled}
            onTransform={patch => patchSelected(patch)}
          />
        )}
      </Pressable>

      <ToggleRow
        label="Show presentation overlay in playtest"
        value={normalized.showPresentationOverlay !== false}
        onChange={show => update({ ...normalized, showPresentationOverlay: show })}
        colors={colors}
      />

      {selected && (
        <StageObjectInspector
          object={selected}
          assets={assets}
          hotspots={hotspots}
          snapEnabled={snapEnabled}
          colors={colors}
          onPatch={patchSelected}
          onSelectHotspot={onSelectHotspot}
          conditionSuggestions={conditionSuggestions}
        />
      )}

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Objects ({normalized.objects.length})</Text>
      {sortedObjects.length === 0 ? (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>No stage objects yet. Open Assets or apply a scene preset.</Text>
      ) : sortedObjects.map(object => (
        <TouchableOpacity
          key={object.uid}
          style={[styles.objectRow, { borderColor: selectedUids.includes(object.uid) ? colors.primary : colors.border, backgroundColor: colors.card }]}
          onPress={() => {
            const next = selectedUids.includes(object.uid)
              ? selectedUids.filter(id => id !== object.uid)
              : [...selectedUids, object.uid];
            setSelectedUids(next);
          }}
        >
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium', fontSize: 13 }}>{object.label || object.asset || object.uid}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{STAGE_LAYER_LABELS[object.layer]}{object.hidden ? ' · hidden' : ''}{object.locked ? ' · locked' : ''}</Text>
        </TouchableOpacity>
      ))}

      <StageAssetPicker
        visible={assetPickerOpen}
        assets={assets}
        onClose={() => setAssetPickerOpen(false)}
        onSelect={insertAsset}
      />
    </View>
  );
}

function CameraGuidesOverlay({
  guides,
  colors,
}: {
  guides: StageComposition['cameraGuides'];
  colors: ReturnType<typeof useColors>;
}) {
  if (!guides) return null;
  const line = { backgroundColor: colors.primary + '55' };
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {guides.centerGuides && (
        <>
          <View style={[styles.guideV, line, { left: '50%' }]} />
          <View style={[styles.guideH, line, { top: '50%' }]} />
        </>
      )}
      {guides.ruleOfThirds && (
        <>
          <View style={[styles.guideV, line, { left: '33.33%' }]} />
          <View style={[styles.guideV, line, { left: '66.66%' }]} />
          <View style={[styles.guideH, line, { top: '33.33%' }]} />
          <View style={[styles.guideH, line, { top: '66.66%' }]} />
        </>
      )}
      {guides.safeArea && (
        <View style={[styles.safeArea, { borderColor: colors.primary + '88' }]} />
      )}
      {guides.aspectGuide && (
        <View style={[styles.aspectGuide, { borderColor: colors.accent + '88' }]} />
      )}
    </View>
  );
}

function ToolButton({
  icon, label, onPress, colors, disabled, active,
}: {
  icon: ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.toolBtn, { borderColor: active ? colors.primary : colors.border, opacity: disabled ? 0.45 : 1 }]}
      onPress={onPress}
      disabled={disabled}
    >
      <Feather name={icon} size={13} color={active ? colors.primary : colors.foreground} />
      <Text style={{ color: active ? colors.primary : colors.foreground, fontSize: 10, fontFamily: 'Inter_500Medium' }}>{label}</Text>
    </TouchableOpacity>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  colors,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <TouchableOpacity
      style={[styles.toggleRow, { borderColor: colors.border, backgroundColor: colors.card }]}
      onPress={() => onChange(!value)}
      activeOpacity={0.8}
    >
      <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 }}>{label}</Text>
      <Feather name={value ? 'toggle-right' : 'toggle-left'} size={22} color={value ? colors.primary : colors.mutedForeground} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  title: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  hint: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular' },
  label: { fontSize: 10, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.6 },
  chips: { gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, maxWidth: 180 },
  chipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  guideRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  guideChip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  canvas: { width: '100%', aspectRatio: 16 / 9, borderWidth: 1, borderRadius: 10, overflow: 'hidden', minHeight: 180 },
  canvasEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  inspector: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 8 },
  objectRow: { borderWidth: 1, borderRadius: 8, padding: 10, gap: 2 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10 },
  guideV: { position: 'absolute', top: 0, bottom: 0, width: 1 },
  guideH: { position: 'absolute', left: 0, right: 0, height: 1 },
  safeArea: { position: 'absolute', top: '8%', bottom: '8%', left: '6%', right: '6%', borderWidth: 1, borderRadius: 8 },
  aspectGuide: { position: 'absolute', top: '12%', bottom: '12%', left: '12%', right: '12%', borderWidth: 1 },
});

export { emptyStageComposition, DEFAULT_SNAP_GRID };
