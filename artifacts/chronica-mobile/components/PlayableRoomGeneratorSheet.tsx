import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import {
  executeGenerateRoomTransaction,
} from '@/engine/editor-mutations';
import {
  formatDiagnosticReportMessage,
} from '@/engine/diagnostics';
import {
  planPlayableRoomFromAssets,
  selectPlayableRoomAssets,
  type PlayableRoomPlan,
} from '@/engine/playable-room-generator';
import type { Project } from '@/engine/types';

export function PlayableRoomGeneratorSheet({
  visible,
  project,
  assetIds,
  onClose,
  onApplied,
}: {
  visible: boolean;
  project: Project;
  /** Optional subset of assets (e.g. from a recent import). */
  assetIds?: readonly string[];
  onClose: () => void;
  onApplied: (result: { project: Project; plan: PlayableRoomPlan }) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [fragmentUid, setFragmentUid] = useState<string | undefined>(undefined);
  const [createNewScene, setCreateNewScene] = useState(true);
  const [newSceneTitle, setNewSceneTitle] = useState('Generated Room');
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [includeNpc, setIncludeNpc] = useState(true);
  const [includePickup, setIncludePickup] = useState(true);
  const [lockedGate, setLockedGate] = useState(true);
  const [includeAmbient, setIncludeAmbient] = useState(true);
  const [includeSfx, setIncludeSfx] = useState(true);
  const [setAsStart, setSetAsStart] = useState(true);

  React.useEffect(() => {
    if (!visible) {
      setConfirmOverwrite(false);
      setFragmentUid(undefined);
    }
  }, [visible]);

  const selection = useMemo(
    () => selectPlayableRoomAssets(project, { assetIds }),
    [project, assetIds],
  );

  const plan = useMemo(
    () => planPlayableRoomFromAssets(project, {
      assetIds,
      fragmentUid,
      createNewScene,
      newSceneTitle,
      confirmOverwrite,
      includeNpc,
      includePickup,
      lockedGate,
      includeAmbient,
      includeSfx,
      setAsStartLocation: setAsStart,
    }),
    [
      project,
      assetIds,
      fragmentUid,
      createNewScene,
      newSceneTitle,
      confirmOverwrite,
      includeNpc,
      includePickup,
      lockedGate,
      includeAmbient,
      includeSfx,
      setAsStart,
    ],
  );

  const apply = () => {
    const options = {
      assetIds,
      fragmentUid,
      createNewScene,
      newSceneTitle,
      confirmOverwrite,
      includeNpc,
      includePickup,
      lockedGate,
      includeAmbient,
      includeSfx,
      setAsStartLocation: setAsStart,
    };
    const { plan: planned, transaction } = executeGenerateRoomTransaction(project, options);
    if (!transaction.ok || !transaction.after) {
      Alert.alert(
        'Could not generate room',
        formatDiagnosticReportMessage(transaction.diagnosticReport),
      );
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onApplied({ project: transaction.after, plan: planned });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.backdrop, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
        <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>Generate playable room</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Builds a Harbor-style adventure room from your classified assets — player spawn, NPC, pickup, gate, ambient, and SFX.
            </Text>

            <View style={[styles.selectionCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Selected assets</Text>
              <SelectionLine label="Background" value={selection.background?.name} colors={colors} />
              <SelectionLine label="Player" value={selection.player?.name} colors={colors} />
              <SelectionLine label="NPC" value={selection.npc?.name} colors={colors} />
              <SelectionLine label="Pickup" value={selection.pickup?.name} colors={colors} />
              <SelectionLine label="Gate/Door" value={selection.gate?.name ?? selection.door?.name} colors={colors} />
              <SelectionLine label="Ambient" value={selection.ambient?.name ?? selection.music?.name} colors={colors} />
            </View>

            <ToggleRow label="Create new scene" value={createNewScene} onChange={setCreateNewScene} colors={colors} />
            {createNewScene ? (
              <Field label="Scene title" value={newSceneTitle} onChange={setNewSceneTitle} colors={colors} />
            ) : (
              <>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Target scene</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {project.fragments.map(fragment => {
                    const selected = (fragmentUid ?? plan.targetFragmentUid) === fragment.uid;
                    return (
                      <TouchableOpacity
                        key={fragment.uid}
                        style={[styles.chip, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + '18' : colors.card }]}
                        onPress={() => setFragmentUid(fragment.uid)}
                      >
                        <Text style={{ color: selected ? colors.primary : colors.foreground, fontSize: 12 }} numberOfLines={1}>
                          {fragment.title || fragment.locationId}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            <ToggleRow label="Include NPC" value={includeNpc} onChange={setIncludeNpc} colors={colors} />
            <ToggleRow label="Include pickup" value={includePickup} onChange={setIncludePickup} colors={colors} />
            <ToggleRow label="Locked gate requires pickup" value={lockedGate} onChange={setLockedGate} colors={colors} disabled={!includePickup} />
            <ToggleRow label="Ambient audio" value={includeAmbient} onChange={setIncludeAmbient} colors={colors} />
            <ToggleRow label="SFX mapping" value={includeSfx} onChange={setIncludeSfx} colors={colors} />
            <ToggleRow label="Set as start scene" value={setAsStart} onChange={setSetAsStart} colors={colors} />

            {plan.preview.length > 0 && (
              <View style={[styles.previewCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Preview plan</Text>
                {plan.preview.map(line => (
                  <View key={`${line.category}-${line.summary}`} style={styles.previewRow}>
                    <Text style={[styles.previewCategory, { color: colors.primary }]}>{line.category}</Text>
                    <Text style={[styles.previewSummary, { color: colors.foreground }]}>{line.summary}</Text>
                  </View>
                ))}
              </View>
            )}

            {plan.conflicts.map(conflict => (
              <View key={conflict.message} style={[styles.warningCard, { borderColor: colors.destructive + '55', backgroundColor: colors.destructive + '10' }]}>
                <Feather name="alert-triangle" size={14} color={colors.destructive} />
                <Text style={[styles.warningText, { color: colors.foreground }]}>{conflict.message}</Text>
              </View>
            ))}

            {plan.conflicts.length > 0 && (
              <ToggleRow label="Replace existing room setup" value={confirmOverwrite} onChange={setConfirmOverwrite} colors={colors} />
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.applyBtn, { backgroundColor: plan.canApply ? colors.primary : colors.muted }]}
            disabled={!plan.canApply}
            onPress={apply}
          >
            <Text style={styles.applyText}>Generate playable room</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function SelectionLine({
  label,
  value,
  colors,
}: {
  label: string;
  value?: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.selectionRow}>
      <Text style={[styles.selectionLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.selectionValue, { color: colors.foreground }]} numberOfLines={1}>
        {value ?? '(placeholder — add asset later)'}
      </Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  colors,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
        value={value}
        onChangeText={onChange}
        placeholderTextColor={colors.mutedForeground}
      />
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  colors,
  disabled = false,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  colors: ReturnType<typeof useColors>;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, disabled && { opacity: 0.5 }]}>
      <Text style={[styles.toggleLabel, { color: colors.foreground }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} disabled={disabled} />
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
    maxHeight: Platform.OS === 'web' ? '92%' : '90%',
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
  selectionCard: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 6 },
  selectionRow: { flexDirection: 'row', gap: 8 },
  selectionLabel: { width: 88, fontSize: 11, fontFamily: 'Inter_500Medium' },
  selectionValue: { flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular' },
  field: { gap: 6 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: Platform.OS === 'web' ? 10 : 8, fontSize: 14, fontFamily: 'Inter_400Regular' },
  chips: { gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, maxWidth: 180 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  toggleLabel: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular' },
  previewCard: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 8 },
  previewRow: { gap: 2 },
  previewCategory: { fontSize: 10, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase' },
  previewSummary: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular' },
  warningCard: { flexDirection: 'row', gap: 8, borderWidth: 1, borderRadius: 8, padding: 10, alignItems: 'flex-start' },
  warningText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular' },
  applyBtn: { margin: 16, marginTop: 8, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  applyText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 15 },
});
