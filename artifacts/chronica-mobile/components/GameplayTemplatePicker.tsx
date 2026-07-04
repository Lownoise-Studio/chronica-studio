import React, { useMemo, useState } from 'react';
import {
  Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import {
  GAMEPLAY_TEMPLATE_DEFINITIONS,
  buildGameplayTemplate,
  type GameplayTemplateInput,
  type GameplayTemplateKind,
  type GameplayTemplateResult,
} from '@/engine/gameplay-templates';
import type { Fragment, Project } from '@/engine/types';

export interface GameplayTemplateApplyPayload {
  result: GameplayTemplateResult;
}

export function GameplayTemplatePicker({
  visible,
  project,
  onClose,
  onApply,
  includeScenePatches = false,
}: {
  visible: boolean;
  project: Project;
  onClose: () => void;
  onApply: (payload: GameplayTemplateApplyPayload) => void;
  /** When true, template may add hotspots / stage actors to the current scene. */
  includeScenePatches?: boolean;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const imageAssets = useMemo(
    () => (project.assets ?? []).filter(a => a.type === 'image').map(a => a.name),
    [project.assets],
  );

  const [kind, setKind] = useState<GameplayTemplateKind>('collect-item');
  const [label, setLabel] = useState('');
  const [secondaryLabel, setSecondaryLabel] = useState('');
  const [assetName, setAssetName] = useState(imageAssets[0] ?? '');
  const [includeObjective, setIncludeObjective] = useState(true);
  const [useMemoryFlag, setUseMemoryFlag] = useState(true);

  const secondaryField = useMemo(() => {
    switch (kind) {
      case 'collect-item':
        return { label: 'Hotspot label (optional)', placeholder: 'Same as item name' };
      case 'locked-door':
        return { label: 'Key name', placeholder: 'Rusty key' };
      case 'find-clue':
        return { label: 'Inspect text', placeholder: 'The ink is still wet.' };
      case 'talk-to-npc':
        return null;
      case 'simple-quest':
        return { label: 'Required item', placeholder: 'Lantern' };
      default:
        return null;
    }
  }, [kind]);

  const primaryField = useMemo(() => {
    switch (kind) {
      case 'collect-item':
        return { label: 'Item name', placeholder: 'Lantern' };
      case 'locked-door':
        return { label: 'Door name', placeholder: 'Harbor gate' };
      case 'find-clue':
        return { label: 'Clue name', placeholder: 'Wet note' };
      case 'talk-to-npc':
        return { label: 'NPC name', placeholder: 'Keeper' };
      case 'simple-quest':
        return { label: 'Quest title', placeholder: 'Light the harbor' };
      default:
        return { label: 'Name', placeholder: '' };
    }
  }, [kind]);

  const preview = useMemo((): GameplayTemplateResult | null => {
    const trimmed = label.trim();
    if (!trimmed) return null;
    try {
      const input: GameplayTemplateInput = {
        kind,
        label: trimmed,
        secondaryLabel: secondaryLabel.trim() || undefined,
        assetName: assetName.trim() || undefined,
        includeObjective,
        useMemoryFlag,
      };
      return buildGameplayTemplate(input, project);
    } catch {
      return null;
    }
  }, [kind, label, secondaryLabel, assetName, includeObjective, useMemoryFlag, project]);

  const resetAndClose = () => {
    setLabel('');
    setSecondaryLabel('');
    onClose();
  };

  const apply = () => {
    if (!preview) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onApply({ result: preview });
    resetAndClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={resetAndClose}>
      <View style={[styles.backdrop, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>Add gameplay template</Text>
            <TouchableOpacity onPress={resetAndClose}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Generates catalog entries, actions, and conditions using the existing Phase 1 model.
            </Text>

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Template</Text>
            <View style={styles.templateGrid}>
              {GAMEPLAY_TEMPLATE_DEFINITIONS.map(def => {
                const selected = kind === def.kind;
                return (
                  <TouchableOpacity
                    key={def.kind}
                    style={[
                      styles.templateCard,
                      {
                        backgroundColor: selected ? colors.primary + '18' : colors.card,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setKind(def.kind)}
                  >
                    <Text style={[styles.templateTitle, { color: colors.foreground }]}>{def.title}</Text>
                    <Text style={[styles.templateDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                      {def.description}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Field label={primaryField.label} value={label} onChange={setLabel} placeholder={primaryField.placeholder} />
            {secondaryField && (
              <Field
                label={secondaryField.label}
                value={secondaryLabel}
                onChange={setSecondaryLabel}
                placeholder={secondaryField.placeholder}
              />
            )}

            {(kind === 'collect-item' || kind === 'locked-door' || kind === 'talk-to-npc' || kind === 'simple-quest') && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Asset</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {(imageAssets.length ? imageAssets : ['(add images first)']).map(name => {
                    const selected = assetName === name;
                    return (
                      <TouchableOpacity
                        key={name}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: selected ? colors.primary + '22' : colors.muted,
                            borderColor: selected ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => setAssetName(name)}
                      >
                        <Text style={[styles.chipText, { color: selected ? colors.primary : colors.foreground }]} numberOfLines={1}>
                          {name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {kind === 'find-clue' && (
              <ToggleRow
                label="Store as memory flag"
                value={useMemoryFlag}
                onChange={setUseMemoryFlag}
                colors={colors}
              />
            )}

            {kind !== 'simple-quest' && (
              <ToggleRow
                label="Include objective"
                value={includeObjective}
                onChange={setIncludeObjective}
                colors={colors}
              />
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
                {includeScenePatches && preview.fragment?.hotspot && (
                  <Text style={[styles.previewNote, { color: colors.mutedForeground }]}>
                    Will add a hotspot{preview.fragment.stageActor ? ' and stage actor' : ''} to this scene.
                  </Text>
                )}
                {!includeScenePatches && preview.fragment?.hotspot && (
                  <Text style={[styles.previewNote, { color: colors.mutedForeground }]}>
                    Open a scene editor to place the generated hotspot.
                  </Text>
                )}
              </View>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.applyBtn, { backgroundColor: preview ? colors.primary : colors.muted }]}
            onPress={apply}
            disabled={!preview}
          >
            <Text style={styles.applyText}>Apply template</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
  },
  sheet: {
    maxHeight: Platform.OS === 'web' ? '90%' : '88%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  title: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  body: { paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  hint: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  sectionLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.6 },
  templateGrid: { gap: 8 },
  templateCard: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 4 },
  templateTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  templateDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  field: { gap: 6 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: Platform.OS === 'web' ? 10 : 8, fontSize: 14, fontFamily: 'Inter_400Regular' },
  chips: { gap: 6, paddingVertical: 2 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, maxWidth: 160 },
  chipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewCard: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 8 },
  previewRow: { gap: 2 },
  previewCategory: { fontSize: 10, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase' },
  previewSummary: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  previewNote: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16, marginTop: 4 },
  applyBtn: { margin: 16, marginTop: 8, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  applyText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 15 },
});
