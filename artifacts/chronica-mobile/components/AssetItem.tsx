import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { ProjectAsset } from '@/engine/types';

function fmtSize(b: number): string {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / (1024 * 1024)).toFixed(1)}MB`;
}

const icons: Record<string, string> = { audio: 'music', data: 'file-text', image: 'image' };

export function AssetItem({
  asset,
  onDelete,
  onPreview,
}: {
  asset: ProjectAsset;
  onDelete: () => void;
  onPreview?: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPreview}
      activeOpacity={onPreview ? 0.7 : 1}
    >
      {asset.type === 'image' ? (
        <Image source={{ uri: asset.uri }} style={styles.thumb} />
      ) : (
        <View style={[styles.iconBox, { backgroundColor: colors.secondary }]}>
          <Feather name={icons[asset.type] as any} size={22} color={colors.primary} />
        </View>
      )}
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {asset.name}
        </Text>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
          {asset.type.toUpperCase()} · {fmtSize(asset.size)}
        </Text>
      </View>
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
