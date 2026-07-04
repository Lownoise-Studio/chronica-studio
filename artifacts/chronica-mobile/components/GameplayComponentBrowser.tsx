import React, { useMemo, useState } from 'react';
import {
  Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import {
  BUILTIN_GAMEPLAY_COMPONENTS,
  GAMEPLAY_COMPONENT_CATEGORIES,
  buildGameplayComponent,
  searchGameplayComponents,
  type GameplayComponentCategory,
  type GameplayComponentIcon,
  type GameplayComponentResult,
} from '@/engine/gameplay-components';
import type { Project } from '@/engine/types';

type FeatherName = ComponentProps<typeof Feather>['name'];

const ICON_MAP: Record<GameplayComponentIcon, FeatherName> = {
  box: 'box',
  lock: 'lock',
  user: 'user',
  gift: 'gift',
  'toggle-left': 'toggle-left',
  flag: 'flag',
};

const CATEGORY_LABELS: Record<GameplayComponentCategory, string> = {
  interaction: 'Interaction',
  character: 'Character',
  progression: 'Progression',
  world: 'World',
  utility: 'Utility',
};

export interface GameplayComponentApplyPayload {
  result: GameplayComponentResult;
}

export function GameplayComponentBrowser({
  visible,
  project,
  onClose,
  onInsert,
  includeScenePatches = false,
}: {
  visible: boolean;
  project: Project;
  onClose: () => void;
  onInsert: (payload: GameplayComponentApplyPayload) => void;
  includeScenePatches?: boolean;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const imageAssets = useMemo(
    () => (project.assets ?? []).filter(a => a.type === 'image').map(a => a.name),
    [project.assets],
  );

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<GameplayComponentCategory | 'all'>('all');
  const [selectedId, setSelectedId] = useState(BUILTIN_GAMEPLAY_COMPONENTS[0]?.id ?? 'collectible');
  const [label, setLabel] = useState('');
  const [secondaryLabel, setSecondaryLabel] = useState('');
  const [assetName, setAssetName] = useState(imageAssets[0] ?? '');
  const [includeObjective, setIncludeObjective] = useState(true);
  const [requireKey, setRequireKey] = useState(true);

  const filtered = useMemo(
    () => searchGameplayComponents(query, category),
    [query, category],
  );

  const selected = useMemo(
    () => filtered.find(c => c.id === selectedId) ?? filtered[0] ?? BUILTIN_GAMEPLAY_COMPONENTS[0],
    [filtered, selectedId],
  );

  const preview = useMemo((): GameplayComponentResult | null => {
    if (!selected || !label.trim()) return null;
    try {
      return buildGameplayComponent({
        componentId: selected.id,
        label: label.trim(),
        secondaryLabel: secondaryLabel.trim() || undefined,
        assetName: assetName.trim() || undefined,
        includeObjective,
        requireKey: selected.id === 'door' ? requireKey : undefined,
      }, project);
    } catch {
      return null;
    }
  }, [selected, label, secondaryLabel, assetName, includeObjective, requireKey, project]);

  const secondaryField = useMemo(() => {
    switch (selected?.id) {
      case 'treasure-chest':
        return { label: 'Reward item', placeholder: 'Gold coin' };
      case 'door':
        return requireKey ? { label: 'Key name', placeholder: 'Rusty key' } : null;
      case 'checkpoint':
        return { label: 'Save hint text', placeholder: 'A safe place to save progress.' };
      default:
        return null;
    }
  }, [selected?.id, requireKey]);

  const resetAndClose = () => {
    setQuery('');
    setLabel('');
    setSecondaryLabel('');
    onClose();
  };

  const insert = () => {
    if (!preview) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onInsert({ result: preview });
    resetAndClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={resetAndClose}>
      <View style={[styles.backdrop, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>Gameplay Components</Text>
            <TouchableOpacity onPress={resetAndClose}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Reusable authoring prefabs that expand into catalogs and scene hotspots. All generated content stays editable.
            </Text>

            <TextInput
              style={[styles.search, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={query}
              onChangeText={setQuery}
              placeholder="Search components…"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <CategoryChip label="All" selected={category === 'all'} onPress={() => setCategory('all')} colors={colors} />
              {GAMEPLAY_COMPONENT_CATEGORIES.map(cat => (
                <CategoryChip
                  key={cat}
                  label={CATEGORY_LABELS[cat]}
                  selected={category === cat}
                  onPress={() => setCategory(cat)}
                  colors={colors}
                />
              ))}
            </ScrollView>

            <View style={styles.grid}>
              {filtered.map(component => {
                const active = selected?.id === component.id;
                return (
                  <TouchableOpacity
                    key={component.id}
                    style={[
                      styles.card,
                      {
                        backgroundColor: active ? colors.primary + '14' : colors.card,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setSelectedId(component.id)}
                  >
                    <Feather name={ICON_MAP[component.icon]} size={18} color={active ? colors.primary : colors.foreground} />
                    <Text style={[styles.cardTitle, { color: colors.foreground }]}>{component.name}</Text>
                    <Text style={[styles.cardDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                      {component.description}
                    </Text>
                    <Text style={[styles.cardCategory, { color: colors.primary }]}>
                      {CATEGORY_LABELS[component.category]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selected && (
              <>
                <Field
                  label={selected.id === 'checkpoint' ? 'Checkpoint name' : 'Instance label'}
                  value={label}
                  onChange={setLabel}
                  placeholder={selected.name}
                />
                {secondaryField && (
                  <Field
                    label={secondaryField.label}
                    value={secondaryLabel}
                    onChange={setSecondaryLabel}
                    placeholder={secondaryField.placeholder}
                  />
                )}
                {(selected.id === 'treasure-chest' || selected.id === 'door' || selected.id === 'npc' || selected.id === 'collectible') && (
                  <>
                    <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Asset</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                      {(imageAssets.length ? imageAssets : ['(add images first)']).map(name => {
                        const picked = assetName === name;
                        return (
                          <TouchableOpacity
                            key={name}
                            style={[styles.chip, { backgroundColor: picked ? colors.primary + '22' : colors.muted, borderColor: picked ? colors.primary : colors.border }]}
                            onPress={() => setAssetName(name)}
                          >
                            <Text style={[styles.chipText, { color: picked ? colors.primary : colors.foreground }]} numberOfLines={1}>{name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </>
                )}
                {selected.id === 'door' && (
                  <ToggleRow label="Require key" value={requireKey} onChange={setRequireKey} colors={colors} />
                )}
                {selected.id !== 'checkpoint' && (
                  <ToggleRow label="Include objective" value={includeObjective} onChange={setIncludeObjective} colors={colors} />
                )}
              </>
            )}

            {preview && (
              <View style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Preview</Text>
                {preview.preview.map(line => (
                  <View key={`${line.category}-${line.summary}`} style={styles.previewRow}>
                    <Text style={[styles.previewCategory, { color: colors.primary }]}>{line.category}</Text>
                    <Text style={[styles.previewSummary, { color: colors.foreground }]}>{line.summary}</Text>
                  </View>
                ))}
                {includeScenePatches && (preview.patch.hotspots?.length || preview.patch.stageActors?.length) ? (
                  <Text style={[styles.previewNote, { color: colors.mutedForeground }]}>
                    Will insert {preview.patch.hotspots?.length ?? 0} hotspot(s)
                    {preview.patch.stageActors?.length ? ` and ${preview.patch.stageActors.length} stage actor(s)` : ''} into this scene.
                  </Text>
                ) : null}
              </View>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.insertBtn, { backgroundColor: preview ? colors.primary : colors.muted }]}
            onPress={insert}
            disabled={!preview}
          >
            <Text style={styles.insertText}>Insert component</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function CategoryChip({
  label, selected, onPress, colors,
}: {
  label: string; selected: boolean; onPress: () => void; colors: ReturnType<typeof useColors>;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, { backgroundColor: selected ? colors.primary + '22' : colors.muted, borderColor: selected ? colors.primary : colors.border }]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, { color: selected ? colors.primary : colors.foreground }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Field({
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="words"
        autoCorrect={false}
      />
    </View>
  );
}

function ToggleRow({
  label, value, onChange, colors,
}: {
  label: string; value: boolean; onChange: (v: boolean) => void; colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end', paddingHorizontal: 12 },
  sheet: { maxHeight: Platform.OS === 'web' ? '92%' : '90%', borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  title: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  body: { paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  hint: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  search: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: Platform.OS === 'web' ? 10 : 8, fontSize: 14, fontFamily: 'Inter_400Regular' },
  sectionLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.6 },
  chips: { gap: 6, paddingVertical: 2 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, maxWidth: 140 },
  chipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { width: '48%', borderWidth: 1, borderRadius: 10, padding: 10, gap: 4, minHeight: 108 },
  cardTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  cardDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 15, flex: 1 },
  cardCategory: { fontSize: 10, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase' },
  field: { gap: 6 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: Platform.OS === 'web' ? 10 : 8, fontSize: 14, fontFamily: 'Inter_400Regular' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewCard: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 8 },
  previewRow: { gap: 2 },
  previewCategory: { fontSize: 10, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase' },
  previewSummary: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  previewNote: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16, marginTop: 4 },
  insertBtn: { margin: 16, marginTop: 8, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  insertText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 15 },
});
