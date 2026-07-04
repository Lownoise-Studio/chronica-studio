import React, { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { filterStageAssets, type StageAssetFilter } from '@/engine/stage-placement';
import { resolveModelPreviewUri } from '@/engine/asset-resolver';
import type { ProjectAsset } from '@/engine/types';

const FILTERS: { id: StageAssetFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'image', label: 'Images' },
  { id: 'model', label: 'Models' },
  { id: 'audio', label: 'Audio' },
  { id: 'data', label: 'Data' },
];

const TYPE_ICONS: Record<ProjectAsset['type'], keyof typeof Feather.glyphMap> = {
  image: 'image',
  audio: 'music',
  data: 'file-text',
  model: 'box',
};

export function StageAssetPicker({
  visible,
  assets,
  onClose,
  onSelect,
}: {
  visible: boolean;
  assets: readonly ProjectAsset[];
  onClose: () => void;
  onSelect: (asset: ProjectAsset) => void;
}) {
  const colors = useColors();
  const [filter, setFilter] = useState<StageAssetFilter>('image');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const byType = filterStageAssets(assets, filter);
    const q = query.trim().toLowerCase();
    if (!q) return byType;
    return byType.filter(asset => asset.name.toLowerCase().includes(q));
  }, [assets, filter, query]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>Insert asset</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Choose an asset to add as a stage object. Images work best for scene composition.
          </Text>

          <TextInput
            style={[styles.search, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search assets…"
            placeholderTextColor={colors.mutedForeground}
            autoCorrect={false}
            autoCapitalize="none"
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {FILTERS.map(item => {
              const active = filter === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.filterChip, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary + '18' : colors.card }]}
                  onPress={() => setFilter(item.id)}
                >
                  <Text style={{ color: active ? colors.primary : colors.foreground, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView style={styles.gridScroll} contentContainerStyle={styles.grid}>
            {filtered.length === 0 ? (
              <Text style={[styles.empty, { color: colors.mutedForeground }]}>No assets match this filter.</Text>
            ) : filtered.map(asset => {
              const modelPreviewUri = asset.type === 'model' ? resolveModelPreviewUri(assets, asset) : undefined;
              return (
              <TouchableOpacity
                key={asset.id}
                style={[styles.tile, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => {
                  onSelect(asset);
                  onClose();
                }}
                activeOpacity={0.85}
              >
                {asset.type === 'image' ? (
                  <Image source={{ uri: asset.uri }} style={styles.thumb} contentFit="cover" />
                ) : asset.type === 'model' ? (
                  modelPreviewUri ? (
                    <Image source={{ uri: modelPreviewUri }} style={styles.thumb} contentFit="cover" />
                  ) : (
                    <View style={[styles.iconThumb, { backgroundColor: colors.secondary }]}>
                      <Feather name="box" size={24} color={colors.primary} />
                    </View>
                  )
                ) : (
                  <View style={[styles.iconThumb, { backgroundColor: colors.secondary }]}>
                    <Feather name={TYPE_ICONS[asset.type]} size={24} color={colors.primary} />
                  </View>
                )}
                <Text style={[styles.tileName, { color: colors.foreground }]} numberOfLines={2}>{asset.name}</Text>
                <Text style={[styles.tileMeta, { color: colors.mutedForeground }]}>{asset.type}</Text>
              </TouchableOpacity>
            );})}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#00000066',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    maxHeight: '82%',
    padding: 16,
    gap: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  hint: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular' },
  search: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'Inter_400Regular' },
  filters: { gap: 8 },
  filterChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  gridScroll: { flexGrow: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '30%', minWidth: 96, borderWidth: 1, borderRadius: 10, padding: 8, gap: 6 },
  thumb: { width: '100%', aspectRatio: 1, borderRadius: 6 },
  iconThumb: { width: '100%', aspectRatio: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  tileName: { fontSize: 11, fontFamily: 'Inter_500Medium', lineHeight: 14 },
  tileMeta: { fontSize: 10, fontFamily: 'Inter_400Regular', textTransform: 'uppercase' },
  empty: { fontSize: 13, fontFamily: 'Inter_400Regular', paddingVertical: 24, textAlign: 'center', width: '100%' },
});
