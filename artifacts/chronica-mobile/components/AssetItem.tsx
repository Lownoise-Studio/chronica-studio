import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { AssetIntakeBadge, useAssetIntakeClassification } from '@/components/AssetIntakeHint';
import { resolveModelPreviewUri } from '@/engine/asset-resolver';
import { getModelAssetLibraryMessages, isModelAsset } from '@/engine/model-assets';
import { ProjectAsset } from '@/engine/types';

function fmtSize(b: number): string {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / (1024 * 1024)).toFixed(1)}MB`;
}

const icons: Record<string, string> = { audio: 'music', data: 'file-text', image: 'image', model: 'box' };

export function AssetItem({
  asset,
  assets = [],
  onDelete,
  onPreview,
}: {
  asset: ProjectAsset;
  assets?: readonly ProjectAsset[];
  onDelete: () => void;
  onPreview?: () => void;
}) {
  const colors = useColors();
  const previewUri = useMemo(
    () => (isModelAsset(asset) ? resolveModelPreviewUri(assets, asset) : undefined),
    [asset, assets],
  );
  const hasWarning = useMemo(
    () => isModelAsset(asset) && getModelAssetLibraryMessages(asset, assets).some(m => m.kind === 'warning'),
    [asset, assets],
  );
  const classification = useAssetIntakeClassification(asset);

  return (
    <TouchableOpacity
      style={[styles.item, { backgroundColor: colors.card, borderColor: hasWarning ? colors.destructive + '88' : colors.border }]}
      onPress={onPreview}
      activeOpacity={onPreview ? 0.7 : 1}
    >
      {asset.type === 'image' ? (
        <Image source={{ uri: asset.uri }} style={styles.thumb} />
      ) : isModelAsset(asset) ? (
        previewUri ? (
          <Image source={{ uri: previewUri }} style={styles.thumb} />
        ) : (
          <View style={[styles.iconBox, { backgroundColor: colors.secondary }]}>
            <Feather name="box" size={22} color={colors.primary} />
          </View>
        )
      ) : (
        <View style={[styles.iconBox, { backgroundColor: colors.secondary }]}>
          <Feather name={icons[asset.type] as keyof typeof Feather.glyphMap} size={22} color={colors.primary} />
        </View>
      )}
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {asset.name}
        </Text>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
          {asset.type.toUpperCase()} · {fmtSize(asset.size)}
          {hasWarning ? ' · needs attention' : ''}
        </Text>
        <AssetIntakeBadge classification={classification} compact />
      </View>
      {hasWarning && (
        <Feather name="alert-triangle" size={14} color={colors.destructive} style={{ marginRight: 2 }} />
      )}
      {onPreview && (
        <Feather name="eye" size={15} color={colors.mutedForeground} style={{ marginRight: 4 }} />
      )}
      <TouchableOpacity onPress={onDelete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Feather name="trash-2" size={16} color={colors.destructive} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginHorizontal: 16,
    marginVertical: 4,
  },
  thumb: { width: 48, height: 48, borderRadius: 6 },
  iconBox: { width: 48, height: 48, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  meta: { fontSize: 11, fontFamily: 'Inter_400Regular' },
});
