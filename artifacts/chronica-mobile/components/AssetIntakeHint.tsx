import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import {
  classifyProjectAsset,
  formatSuggestedRecipe,
  needsClassificationAttention,
  type AssetIntakeClassification,
  type AssetIntakeRecipe,
} from '@/engine/asset-intake';
import type { ProjectAsset } from '@/engine/types';

export function useAssetIntakeClassification(
  asset: Pick<ProjectAsset, 'name' | 'type' | 'mimeType'>,
): AssetIntakeClassification {
  return useMemo(() => classifyProjectAsset(asset), [asset.name, asset.type, asset.mimeType]);
}

export function AssetIntakeBadge({
  classification,
  compact = false,
}: {
  classification: AssetIntakeClassification;
  compact?: boolean;
}) {
  const colors = useColors();
  const needsReview = needsClassificationAttention(classification);

  return (
    <View style={styles.row}>
      <View style={[styles.chip, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Text style={[styles.chipText, { color: colors.foreground }]} numberOfLines={1}>
          {classification.label}
          {!compact && classification.confidence !== 'high' ? ` · ${classification.confidence}` : ''}
        </Text>
      </View>
      {needsReview && (
        <View style={[styles.reviewChip, { backgroundColor: colors.muted }]}>
          <Feather name="help-circle" size={11} color={colors.mutedForeground} />
          <Text style={[styles.reviewText, { color: colors.mutedForeground }]}>Needs classification</Text>
        </View>
      )}
    </View>
  );
}

export function AssetIntakeSummary({
  classification,
  onApplySuggestion,
}: {
  classification: AssetIntakeClassification;
  onApplySuggestion?: () => void;
}) {
  const colors = useColors();
  const needsReview = needsClassificationAttention(classification);

  return (
    <View style={styles.summary}>
      <AssetIntakeBadge classification={classification} />
      {classification.suggestedRecipe !== 'none' && (
        <Text style={[styles.recipe, { color: colors.mutedForeground }]}>
          Suggested: {formatSuggestedRecipe(classification.suggestedRecipe)}
        </Text>
      )}
      {classification.hint && (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>{classification.hint}</Text>
      )}
      {needsReview && (
        <Text style={[styles.reviewNote, { color: colors.mutedForeground }]}>
          Optional — you can keep working without classifying this asset.
        </Text>
      )}
      {onApplySuggestion && classification.suggestedRecipe !== 'none' && (
        <TouchableOpacity
          style={[styles.applyBtn, { borderColor: colors.primary, backgroundColor: colors.primary + '12' }]}
          onPress={onApplySuggestion}
        >
          <Feather name="zap" size={14} color={colors.primary} />
          <Text style={[styles.applyBtnText, { color: colors.primary }]}>Apply suggestion</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function suggestedRecipeForAsset(
  asset: Pick<ProjectAsset, 'name' | 'type' | 'mimeType'>,
): AssetIntakeRecipe {
  return classifyProjectAsset(asset).suggestedRecipe;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: '100%',
  },
  chipText: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  reviewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  reviewText: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  summary: { gap: 6 },
  recipe: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular' },
  hint: { fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular' },
  reviewNote: { fontSize: 11, lineHeight: 16, fontStyle: 'italic', fontFamily: 'Inter_400Regular' },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 9,
    marginTop: 2,
  },
  applyBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
});
