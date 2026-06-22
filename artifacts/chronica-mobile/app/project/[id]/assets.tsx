import React, { useState } from 'react';
import { Alert, FlatList, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useProjects } from '@/context/ProjectsContext';
import { AssetItem } from '@/components/AssetItem';
import { EmptyState } from '@/components/EmptyState';
import { ProjectAsset } from '@/engine/types';

const generateId = (): string =>
  Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

function getAssetType(uri: string, mime?: string): 'image' | 'audio' | 'data' {
  if (mime?.startsWith('image/')) return 'image';
  if (mime?.startsWith('audio/')) return 'audio';
  const ext = uri.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'image';
  if (['mp3', 'ogg', 'wav', 'm4a', 'aac'].includes(ext)) return 'audio';
  return 'data';
}

export default function AssetsScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getProject, addAsset, deleteAsset } = useProjects();
  const [importing, setImporting] = useState(false);

  const project = getProject(projectId!);

  const handleImport = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not supported', 'File import is only available on Android and iOS.');
      return;
    }
    try {
      setImporting(true);
      const DocumentPicker = await import('expo-document-picker');
      const FileSystem = await import('expo-file-system');

      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'audio/*', 'application/json', 'text/plain'],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      for (const file of result.assets) {
        const assetType = getAssetType(file.uri, file.mimeType ?? undefined);
        const destDir = `${FileSystem.documentDirectory}chronica/${projectId}/`;
        await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
        const destUri = `${destDir}${file.name}`;
        await FileSystem.copyAsync({ from: file.uri, to: destUri });

        const asset: ProjectAsset = {
          id: generateId(),
          name: file.name,
          type: assetType,
          uri: destUri,
          mimeType: file.mimeType ?? 'application/octet-stream',
          size: file.size ?? 0,
          importedAt: new Date().toISOString(),
        };
        addAsset(projectId!, asset);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {
      Alert.alert('Import failed', 'Could not import the selected file(s).');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = (assetId: string, name: string) => {
    Alert.alert('Remove Asset', `Remove "${name}" from this project?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const asset = project?.assets.find(a => a.id === assetId);
          if (asset && Platform.OS !== 'web') {
            try {
              const FileSystem = await import('expo-file-system');
              await FileSystem.deleteAsync(asset.uri, { idempotent: true });
            } catch {}
          }
          deleteAsset(projectId!, assetId);
        },
      },
    ]);
  };

  const assets = project?.assets ?? [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={assets}
        keyExtractor={a => a.id}
        renderItem={({ item }) => (
          <AssetItem asset={item} onDelete={() => handleDelete(item.id, item.name)} />
        )}
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 80,
        }}
        ListEmptyComponent={
          <EmptyState
            icon="folder"
            title="No assets yet"
            message="Import images, audio, or data files from your device"
            actionLabel="Import File"
            onAction={handleImport}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity
        style={[
          styles.fab,
          { backgroundColor: importing ? colors.mutedForeground : colors.primary, bottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 20 },
        ]}
        onPress={handleImport}
        disabled={importing}
        activeOpacity={0.8}
      >
        <Feather name={importing ? 'loader' : 'upload'} size={22} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fab: {
    position: 'absolute',
    right: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
