import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import {
  classifyProjectAsset,
  formatSuggestedRecipe,
  needsClassificationAttention,
  type AssetIntakeClassification,
  type AssetIntakeRecipe,
} from '@/engine/asset-intake';
import {
  executeApplyRecipeTransaction,
} from '@/engine/editor-mutations';
import {
  formatDiagnosticReportMessage,
} from '@/engine/diagnostics';
import {
  planAssetRecipeApplication,
  readableAssetLabel,
} from '@/engine/asset-recipes';
import type { AssetRecipePlan } from '@/engine/asset-recipes';
import type { Project, ProjectAsset } from '@/engine/types';

export function AssetRecipeApplySheet({
  visible,
  project,
  asset,
  recipe,
  onClose,
  onApplied,
}: {
  visible: boolean;
  project: Project;
  asset: ProjectAsset | null;
  recipe: AssetIntakeRecipe;
  onClose: () => void;
  onApplied: (result: { project: Project; plan: AssetRecipePlan }) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const classification = useMemo(
    (): AssetIntakeClassification | null => (asset ? classifyProjectAsset(asset) : null),
    [asset],
  );
  const [fragmentUid, setFragmentUid] = useState<string | undefined>(undefined);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [confirmLowConfidence, setConfirmLowConfidence] = useState(false);

  React.useEffect(() => {
    if (!visible) {
      setConfirmOverwrite(false);
      setConfirmLowConfidence(false);
      setFragmentUid(undefined);
    }
  }, [visible, asset?.id]);

  const plan = useMemo(() => {
    if (!asset || recipe === 'none') return null;
    return planAssetRecipeApplication(project, asset.id, recipe, {
      fragmentUid,
      confirmOverwrite,
      confirmLowConfidence,
    });
  }, [asset, recipe, project, fragmentUid, confirmOverwrite, confirmLowConfidence]);

  const needsReview = classification ? needsClassificationAttention(classification) : false;
  const hasOverwriteConflicts = (plan?.conflicts ?? []).some(
    conflict => conflict.kind !== 'missing-adventure',
  );

  const apply = () => {
    if (!asset || !plan?.ok) return;
    const { plan: planned, transaction } = executeApplyRecipeTransaction(project, asset.id, recipe, {
      fragmentUid,
      confirmOverwrite,
      confirmLowConfidence,
    });
    if (!transaction.ok || !transaction.after) {
      Alert.alert(
        'Could not apply recipe',
        formatDiagnosticReportMessage(transaction.diagnosticReport),
      );
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onApplied({ project: transaction.after, plan: planned });
    onClose();
  };

  if (!asset || recipe === 'none') return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.backdrop, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
        <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>Apply suggestion</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              {formatSuggestedRecipe(recipe)} for {readableAssetLabel(asset)} ({asset.name})
            </Text>

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Target scene</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {project.fragments.map(fragment => {
                const selected = (fragmentUid ?? plan?.targetFragmentUid) === fragment.uid;
                return (
                  <TouchableOpacity
                    key={fragment.uid}
                    style={[
                      styles.chip,
                      {
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? colors.primary + '18' : colors.card,
                      },
                    ]}
                    onPress={() => setFragmentUid(fragment.uid)}
                  >
                    <Text style={{ color: selected ? colors.primary : colors.foreground, fontSize: 12 }} numberOfLines={1}>
                      {fragment.title || fragment.locationId}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {plan?.preview.length ? (
              <View style={[styles.previewCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Preview</Text>
                {plan.preview.map(line => (
                  <View key={`${line.category}-${line.summary}`} style={styles.previewRow}>
                    <Text style={[styles.previewCategory, { color: colors.primary }]}>{line.category}</Text>
                    <Text style={[styles.previewSummary, { color: colors.foreground }]}>{line.summary}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {plan?.conflicts.map(conflict => (
              <View key={conflict.message} style={[styles.warningCard, { borderColor: colors.destructive + '55', backgroundColor: colors.destructive + '10' }]}>
                <Feather name="alert-triangle" size={14} color={colors.destructive} />
                <Text style={[styles.warningText, { color: colors.foreground }]}>{conflict.message}</Text>
              </View>
            ))}

            {hasOverwriteConflicts && (
              <ToggleRow
                label="Replace existing assignment"
                value={confirmOverwrite}
                onChange={setConfirmOverwrite}
                colors={colors}
              />
            )}

            {needsReview && (
              <ToggleRow
                label="I reviewed this low-confidence classification"
                value={confirmLowConfidence}
                onChange={setConfirmLowConfidence}
                colors={colors}
              />
            )}

            <Text style={[styles.note, { color: colors.mutedForeground }]}>
              Creates new objects and catalog entries only — existing configured objects are not modified unless you confirm overwrite above.
            </Text>
          </ScrollView>

          <TouchableOpacity
            style={[styles.applyBtn, { backgroundColor: plan?.canApply ? colors.primary : colors.muted }]}
            disabled={!plan?.canApply}
            onPress={apply}
          >
            <Text style={styles.applyText}>Apply suggestion</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
  onChange: (value: boolean) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={[styles.toggleLabel, { color: colors.foreground }]}>{label}</Text>
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
  chips: { gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, maxWidth: 180 },
  previewCard: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 8 },
  previewRow: { gap: 2 },
  previewCategory: { fontSize: 10, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase' },
  previewSummary: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular' },
  warningCard: { flexDirection: 'row', gap: 8, borderWidth: 1, borderRadius: 8, padding: 10, alignItems: 'flex-start' },
  warningText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  toggleLabel: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular' },
  note: { fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular' },
  applyBtn: { margin: 16, marginTop: 8, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  applyText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 15 },
});
