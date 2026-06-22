import React, { useState, useRef } from 'react';
import {
  Alert, FlatList, Image, Modal, Platform, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/build/legacy';
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
  const [previewAsset, setPreviewAsset] = useState<ProjectAsset | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioRef = useRef<{ unload: () => void } | null>(null);

  const project = getProject(projectId!);

  const handleImport = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not supported', 'File import is only available on Android and iOS.');
      return;
    }
    try {
      setImporting(true);
      const { getDocumentAsync } = await import('expo-document-picker');

      const result = await getDocumentAsync({
        type: ['image/*', 'audio/*', 'application/json', 'text/plain'],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const baseDir = FileSystem.documentDirectory ?? '';
      const destDir = `${baseDir}chronica/${projectId}/`;
      await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });

      for (const file of result.assets) {
        const assetType = getAssetType(file.uri, file.mimeType ?? undefined);
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
          if (Platform.OS !== 'web') {
            const asset = project?.assets.find(a => a.id === assetId);
            if (asset) {
              try {
                await FileSystem.deleteAsync(asset.uri, { idempotent: true });
              } catch {}
            }
          }
          deleteAsset(projectId!, assetId);
          if (previewAsset?.id === assetId) closePreview();
        },
      },
    ]);
  };

  const handlePreview = (asset: ProjectAsset) => {
    setPreviewAsset(asset);
    setAudioPlaying(false);
    if (audioRef.current) {
      audioRef.current.unload();
      audioRef.current = null;
    }
  };

  const closePreview = () => {
    if (audioRef.current) {
      audioRef.current.unload();
      audioRef.current = null;
    }
    setAudioPlaying(false);
    setPreviewAsset(null);
  };

  const toggleAudio = async () => {
    if (!previewAsset) return;
    if (audioRef.current) {
      audioRef.current.unload();
      audioRef.current = null;
      setAudioPlaying(false);
      return;
    }
    try {
      const { Audio } = await import('expo-av');
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: previewAsset.uri },
        { shouldPlay: true, isLooping: false }
      );
      sound.setOnPlaybackStatusUpdate(status => {
        if ('didJustFinish' in status && status.didJustFinish) {
          setAudioPlaying(false);
          audioRef.current = null;
        }
      });
      audioRef.current = { unload: () => sound.unloadAsync().catch(() => {}) };
      setAudioPlaying(true);
    } catch {
      Alert.alert('Playback Error', 'Could not play this audio file.');
    }
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
          {
            backgroundColor: importing ? colors.mutedForeground : colors.primary,
            bottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 20,
          },
        ]}
        onPress={handleImport}
        disabled={importing}
        activeOpacity={0.8}
      >
        <Feather name={importing ? 'loader' : 'upload'} size={22} color="#fff" />
      </TouchableOpacity>

      {/* Preview modal */}
      <Modal visible={!!previewAsset} transparent animationType="fade" onRequestClose={closePreview}>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.92)' }]}>
          <TouchableOpacity style={[styles.closePreviewBtn, { top: insets.top + 16 }]} onPress={closePreview}>
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>

          {previewAsset?.type === 'image' && (
            <Image
              source={{ uri: previewAsset.uri }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          )}

          {previewAsset?.type === 'audio' && (
            <View style={styles.audioPreview}>
              <Feather name="music" size={48} color="#9d5ff5" />
              <Text style={[styles.previewName, { color: '#fff' }]}>{previewAsset.name}</Text>
              <TouchableOpacity
                style={[styles.playAudioBtn, { backgroundColor: '#9d5ff5' }]}
                onPress={toggleAudio}
                activeOpacity={0.8}
              >
                <Feather name={audioPlaying ? 'square' : 'play'} size={20} color="#fff" />
                <Text style={styles.playAudioText}>{audioPlaying ? 'Stop' : 'Play'}</Text>
              </TouchableOpacity>
            </View>
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
    if (Platform.OS === 'web') {
      setContent('(file preview not available on web)');
      return;
    }
    FileSystem.readAsStringAsync(asset.uri)
      .then(text => setContent(text))
      .catch(() => setContent('(could not read file)'));
  }, [asset.uri]);

  return (
    <ScrollView style={styles.dataPreview} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.dataText}>{content ?? 'Loading…'}</Text>
    </ScrollView>
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
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closePreviewBtn: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  previewImage: {
    width: '90%',
    height: '65%',
  },
  audioPreview: {
    alignItems: 'center',
    gap: 16,
    padding: 32,
  },
  previewName: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  playAudioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 30,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  playAudioText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  dataPreview: {
    width: '90%',
    maxHeight: '65%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
  },
  dataText: {
    color: '#e0ddf0',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  previewMeta: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 4,
    paddingTop: 16,
  },
  previewMetaText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
});
