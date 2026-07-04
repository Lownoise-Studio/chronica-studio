import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { ArrayEditor } from '@/components/ArrayEditor';
import { resolveStageObjectPresentationUri } from '@/engine/asset-resolver';
import {
  getHotspotForObject,
  getPresentationTransitionLabel,
  resolveStageObjectHotspotRef,
} from '@/engine/stage-presentation';
import { setStageObjectHotspotRef } from '@/engine/stage-placement';
import {
  STAGE_LAYERS,
  STAGE_LAYER_LABELS,
  moveStageObject,
} from '@/engine/stage-authoring';
import type {
  PresentationTransitionKind,
  ProjectAsset,
  SceneHotspot,
  StageLayer,
  StageObject,
} from '@/engine/types';

const NUDGE = 0.02;
const TRANSITIONS: PresentationTransitionKind[] = ['fade-in', 'fade-out', 'slide', 'zoom'];

export function StageObjectInspector({
  object,
  assets,
  hotspots,
  snapEnabled,
  colors,
  onPatch,
  onSelectHotspot,
  conditionSuggestions,
}: {
  object: StageObject;
  assets: readonly ProjectAsset[];
  hotspots: readonly SceneHotspot[];
  snapEnabled: boolean;
  colors: {
    foreground: string;
    mutedForeground: string;
    border: string;
    card: string;
    primary: string;
    muted: string;
  };
  onPatch: (patch: Partial<StageObject>) => void;
  onSelectHotspot?: (uid: string | null) => void;
  conditionSuggestions?: { label: string; value: string; disabled?: boolean }[];
}) {
  const previewUri = resolveStageObjectPresentationUri(assets, object.asset);
  const hotspotOptions = hotspots.map(h => ({ id: h.uid, label: h.label || h.uid }));
  const editableLayers = STAGE_LAYERS.filter(layer => layer !== 'ui-guides');

  return (
    <View style={[styles.inspector, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>Selected object</Text>

      {previewUri?.kind === 'image' ? (
        <View style={[styles.previewWrap, { borderColor: colors.border, backgroundColor: colors.muted }]}>
          <Image source={{ uri: previewUri.uri }} style={styles.previewImage} contentFit="contain" />
        </View>
      ) : previewUri?.kind === 'model' ? (
        <View style={[styles.previewWrap, styles.modelPreview, { borderColor: colors.border, backgroundColor: colors.muted }]}>
          {previewUri.previewUri ? (
            <Image source={{ uri: previewUri.previewUri }} style={styles.previewImage} contentFit="contain" />
          ) : (
            <Feather name="box" size={24} color={colors.primary} />
          )}
          <Text style={{ color: colors.foreground, fontSize: 11, fontFamily: 'Inter_500Medium' }}>{previewUri.label}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>3D model (presentation preview)</Text>
        </View>
      ) : (
        <View style={[styles.previewWrap, { borderColor: colors.border, backgroundColor: colors.muted }]}>
          <Feather name="image" size={24} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>No asset selected</Text>
        </View>
      )}

      <Field label="Label" value={object.label ?? ''} onChange={label => onPatch({ label })} colors={colors} />
      <Field label="Asset name" value={object.asset} onChange={asset => onPatch({ asset })} colors={colors} mono />

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Layer</Text>
      <View style={[styles.dropdown, { borderColor: colors.border, backgroundColor: colors.muted }]}>
        {editableLayers.map(layer => {
          const active = object.layer === layer;
          return (
            <TouchableOpacity
              key={layer}
              style={[styles.dropdownItem, active && { backgroundColor: colors.primary + '18' }]}
              onPress={() => onPatch({ layer: layer as StageLayer })}
            >
              <Text style={{ color: active ? colors.primary : colors.foreground, fontFamily: 'Inter_500Medium', fontSize: 13 }}>
                {STAGE_LAYER_LABELS[layer]}
              </Text>
              {active && <Feather name="check" size={14} color={colors.primary} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.row}>
        <Field label="X" value={String(object.x.toFixed(3))} onChange={raw => onPatch({ x: Number(raw) || 0 })} colors={colors} mono narrow />
        <Field label="Y" value={String(object.y.toFixed(3))} onChange={raw => onPatch({ y: Number(raw) || 0 })} colors={colors} mono narrow />
      </View>
      <View style={styles.row}>
        <Field label="Scale" value={String(object.scale ?? 1)} onChange={raw => onPatch({ scale: Number(raw) || 1 })} colors={colors} mono narrow />
        <Field label="Rotation°" value={String(object.rotation ?? 0)} onChange={raw => onPatch({ rotation: Number(raw) || 0 })} colors={colors} mono narrow />
      </View>

      <View style={styles.row}>
        <NudgeButton label="←" onPress={() => onPatch(moveStageObject(object, -NUDGE, 0, { snap: snapEnabled }))} colors={colors} />
        <NudgeButton label="→" onPress={() => onPatch(moveStageObject(object, NUDGE, 0, { snap: snapEnabled }))} colors={colors} />
        <NudgeButton label="↑" onPress={() => onPatch(moveStageObject(object, 0, -NUDGE, { snap: snapEnabled }))} colors={colors} />
        <NudgeButton label="↓" onPress={() => onPatch(moveStageObject(object, 0, NUDGE, { snap: snapEnabled }))} colors={colors} />
      </View>

      <ArrayEditor
        label="Visibility conditions"
        items={object.visibleWhen ?? []}
        onChange={visibleWhen => onPatch({ visibleWhen })}
        placeholder="variables.has_key == true"
        hint="All conditions must pass for preview visibility."
        suggestions={conditionSuggestions}
      />

      {hotspotOptions.length > 0 && (
        <>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Hotspot link</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <TouchableOpacity
              style={[styles.chip, { borderColor: !resolveStageObjectHotspotRef(object) ? colors.primary : colors.border }]}
              onPress={() => {
                const linked = setStageObjectHotspotRef(object, undefined);
                onPatch({ hotspotRef: linked.hotspotRef, interactionRef: linked.interactionRef });
                onSelectHotspot?.(null);
              }}
            >
              <Text style={styles.chipText}>None</Text>
            </TouchableOpacity>
            {hotspotOptions.map(option => {
              const active = resolveStageObjectHotspotRef(object) === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.chip, { borderColor: active ? colors.primary : colors.border }]}
                  onPress={() => {
                    const linked = setStageObjectHotspotRef(object, option.id);
                    onPatch({ hotspotRef: linked.hotspotRef, interactionRef: linked.interactionRef });
                    onSelectHotspot?.(option.id);
                  }}
                >
                  <Text style={styles.chipText} numberOfLines={1}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {getHotspotForObject(object, hotspots) && (
            <Text style={[styles.hint, { color: colors.primary }]}>
              Linked hotspot: {getHotspotForObject(object, hotspots)?.label}
            </Text>
          )}
        </>
      )}

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Enter transition</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <TouchableOpacity
          style={[styles.chip, { borderColor: !object.presentation?.enter ? colors.primary : colors.border }]}
          onPress={() => onPatch({ presentation: { ...object.presentation, enter: undefined } })}
        >
          <Text style={styles.chipText}>None</Text>
        </TouchableOpacity>
        {TRANSITIONS.map(transition => (
          <TouchableOpacity
            key={transition}
            style={[styles.chip, { borderColor: object.presentation?.enter === transition ? colors.primary : colors.border }]}
            onPress={() => onPatch({ presentation: { ...object.presentation, enter: transition } })}
          >
            <Text style={styles.chipText}>{getPresentationTransitionLabel(transition)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function NudgeButton({ label, onPress, colors }: { label: string; onPress: () => void; colors: { border: string; foreground: string } }) {
  return (
    <TouchableOpacity style={[styles.nudgeBtn, { borderColor: colors.border }]} onPress={onPress}>
      <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{label}</Text>
    </TouchableOpacity>
  );
}

function Field({
  label, value, onChange, colors, mono, narrow,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  colors: { mutedForeground: string; foreground: string; border: string };
  mono?: boolean;
  narrow?: boolean;
}) {
  return (
    <View style={[styles.field, narrow && styles.fieldNarrow]}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        style={[styles.input, { color: colors.foreground, borderColor: colors.border, fontFamily: mono ? 'Inter_400Regular' : 'Inter_400Regular' }]}
        value={value}
        onChangeText={onChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  inspector: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 8 },
  label: { fontSize: 10, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.6 },
  hint: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  previewWrap: { height: 96, borderWidth: 1, borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 4 },
  modelPreview: { padding: 8 },
  previewImage: { width: '100%', height: '100%' },
  dropdown: { borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 8 },
  row: { flexDirection: 'row', gap: 8 },
  field: { flex: 1, gap: 4 },
  fieldNarrow: { flex: 1 },
  nudgeBtn: { flex: 1, borderWidth: 1, borderRadius: 8, alignItems: 'center', paddingVertical: 8 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  chips: { gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, maxWidth: 160 },
  chipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
});
