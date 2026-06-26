import React, { useState, useRef } from 'react';
import {
  Alert, FlatList, Image, Modal, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useColors } from '@/hooks/useColors';
import { useProjects } from '@/context/ProjectsContext';
import { AssetItem } from '@/components/AssetItem';
import { EmptyState } from '@/components/EmptyState';
import { ProjectAsset } from '@/engine/types';
import { createId } from '@/engine/identity';
import { assetDir, ensureDir, copyFile, deleteFile, readText } from '@/storage/fileSystem';

export default function AssetsScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getProject, addAsset, deleteAsset } = useProjects();
  const [importing, setImporting] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<ProjectAsset | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioRef = useRef<{ unload: () => void } | null>(null);

  const project = getProject(projectId!);

  const handleImportImage = async () => {
    try {
      setImporting(true);

      // On native, request permission first; web uses the browser file picker natively
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission required', 'Allow access to your photo library to import images.');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.9,
      });
      if (result.canceled || !result.assets?.length) return;

      if (Platform.OS !== 'web') {
        // Native: copy picked images into persistent app storage
        const dir = assetDir(projectId!);
        await ensureDir(dir);
        for (const img of result.assets) {
          const ext = img.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
          const name = `img_${createId()}.${ext}`;
          const destUri = `${dir}${name}`;
          await copyFile(img.uri, destUri);
          addAsset(projectId!, {
            id: createId(),
            name,
            type: 'image',
            uri: destUri,
            mimeType: `image/${ext}`,
            size: img.fileSize ?? 0,
            importedAt: new Date().toISOString(),
          });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } else {
        // Web: expo-image-picker returns a blob URI that is directly usable —
        // no file-system copy needed
        for (const img of result.assets) {
          const mimeType = img.mimeType ?? 'image/jpeg';
          const ext = mimeType.split('/')[1] ?? 'jpg';
          const name = img.fileName ?? `img_${createId()}.${ext}`;
          addAsset(projectId!, {
            id: createId(),
            name,
            type: 'image',
            uri: img.uri,
            mimeType,
            size: img.fileSize ?? 0,
            importedAt: new Date().toISOString(),
          });
        }
      }
    } catch {
      Alert.alert('Import failed', 'Could not import the selected image(s).');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = (assetId: string, name: string) => {
    Alert.alert('Remove Image', `Remove "${name}" from this story?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          const asset = project?.assets.find(a => a.id === assetId);
          if (asset) await deleteFile(asset.uri).catch(() => {});
          deleteAsset(projectId!, assetId);
          if (previewAsset?.id === assetId) closePreview();
        },
      },
    ]);
  };

  const handlePreview = (asset: ProjectAsset) => {
    setPreviewAsset(asset);
    setAudioPlaying(false);
    if (audioRef.current) { audioRef.current.unload(); audioRef.current = null; }
  };

  const closePreview = () => {
    if (audioRef.current) { audioRef.current.unload(); audioRef.current = null; }
    setAudioPlaying(false);
    setPreviewAsset(null);
  };

  const assets = project?.assets ?? [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={assets}
        keyExtractor={a => a.id}
        renderItem={({ item }) => (
          <AssetItem
            asset={item}
            onDelete={() => handleDelete(item.id, item.name)}
            onPreview={() => handlePreview(item)}
          />
        )}
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 80,
        }}
        ListHeaderComponent={
          assets.length > 0 ? (
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Tap an image to preview. Long-press for more options.
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="image"
            title="No images yet"
            message="Import images from your photo library to use as scene backgrounds"
            actionLabel="Import Image"
            onAction={handleImportImage}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity
        style={[
          styles.fab,
          {
            backgroundColor: importing ? colors.mutedForeground : colors.primary,
            bottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 20,
          },
        ]}
        onPress={handleImportImage}
        disabled={importing}
        activeOpacity={0.8}
      >
        <Feather name={importing ? 'loader' : 'image'} size={22} color="#fff" />
      </TouchableOpacity>

      {/* Preview modal */}
      <Modal visible={!!previewAsset} transparent animationType="fade" onRequestClose={closePreview}>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.92)' }]}>
          <TouchableOpacity style={[styles.closePreviewBtn, { top: insets.top + 16 }]} onPress={closePreview}>
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>

          {previewAsset?.type === 'image' && (
            <Image source={{ uri: previewAsset.uri }} style={styles.previewImage} resizeMode="contain" />
          )}

          {previewAsset?.type === 'data' && previewAsset && (
            <DataPreview asset={previewAsset} />
          )}

          <View style={[styles.previewMeta, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.previewMetaText}>{previewAsset?.name}</Text>
            <Text style={styles.previewMetaText}>
              {previewAsset?.mimeType} · {((previewAsset?.size ?? 0) / 1024).toFixed(1)} KB
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DataPreview({ asset }: { asset: ProjectAsset }) {
  const [content, setContent] = useState<string | null>(null);
  React.useEffect(() => {
    readText(asset.uri).then(setContent).catch(() => setContent('(could not read file)'));
  }, [asset.uri]);
  return (
    <ScrollView style={styles.dataPreview} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.dataText}>{content ?? 'Loading…'}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hint: { fontSize: 12, fontFamily: 'Inter_400Regular', paddingHorizontal: 20, paddingBottom: 8 },
  fab: {
    position: 'absolute', right: 20,
    width: 54, height: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  modalOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  closePreviewBtn: { position: 'absolute', right: 20, zIndex: 10, padding: 8 },
  previewImage: { width: '90%', height: '65%' },
  dataPreview: { width: '90%', maxHeight: '65%', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10 },
  dataText: { color: '#e0ddf0', fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  previewMeta: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', gap: 4, paddingTop: 16 },
  previewMetaText: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'Inter_400Regular' },
});
