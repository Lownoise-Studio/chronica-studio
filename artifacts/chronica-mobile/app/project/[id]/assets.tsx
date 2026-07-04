import React, { useState, useRef, useMemo } from 'react';
import {
  ActivityIndicator,
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
import { AssetIntakeSummary, suggestedRecipeForAsset, useAssetIntakeClassification } from '@/components/AssetIntakeHint';
import { AssetRecipeApplySheet } from '@/components/AssetRecipeApplySheet';
import { PlayableRoomGeneratorSheet } from '@/components/PlayableRoomGeneratorSheet';
import { ModelAssetDetailPanel } from '@/components/ModelAssetDetailPanel';
import { EmptyState } from '@/components/EmptyState';
import { ProjectAsset } from '@/engine/types';
import { createId } from '@/engine/identity';
import { isModelAsset, validateModelAssetsInLibrary } from '@/engine/model-assets';
import { buildAssetImportReport, summarizeImportReport, type AssetIntakeRecipe } from '@/engine/asset-intake';
import type { AssetRecipePlan } from '@/engine/asset-recipes';
import type { PlayableRoomPlan } from '@/engine/playable-room-generator';
import { buildProjectIntegrityReport } from '@/engine/project-integrity';
import { executeBatchAssetImportTransaction, executeSafeAssetDelete } from '@/engine/editor-mutations';
import { buildBatchImportFailureReport, formatDiagnosticReportMessage } from '@/engine/diagnostics';
import { pickAndImportAssetFiles, pickAndImportAssetZip, type ImportAssetsResult } from '@/storage/asset-import-io';
import { assetDir, ensureDir, copyFile, deleteFile, readText } from '@/storage/fileSystem';

export default function AssetsScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getProject, addAsset, updateAsset, replaceProjectSnapshot } = useProjects();
  const [importing, setImporting] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<ProjectAsset | null>(null);
  const [modelDetailAsset, setModelDetailAsset] = useState<ProjectAsset | null>(null);
  const [recipeSheetOpen, setRecipeSheetOpen] = useState(false);
  const [recipeAsset, setRecipeAsset] = useState<ProjectAsset | null>(null);
  const [recipeToApply, setRecipeToApply] = useState<AssetIntakeRecipe>('none');
  const [roomGeneratorOpen, setRoomGeneratorOpen] = useState(false);
  const [importReportSummary, setImportReportSummary] = useState<string | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioRef = useRef<{ unload: () => void; pause: () => void; play: () => void } | null>(null);

  const project = getProject(projectId!);
  const existingNames = (project?.assets ?? []).map(asset => asset.name);

  const finishImport = (result: ImportAssetsResult) => {
    if (!result.ok) {
      if (result.cancelled) return;
      Alert.alert('Import failed', result.error);
      return;
    }

    if (!project) return;

    const transaction = executeBatchAssetImportTransaction(project, result.assets);
    if (!transaction.ok) {
      const report = buildBatchImportFailureReport(transaction);
      Alert.alert('Import failed', formatDiagnosticReportMessage(report));
      return;
    }

    replaceProjectSnapshot(projectId!, transaction.after!);

    const report = buildAssetImportReport(result.assets);
    setImportReportSummary(summarizeImportReport(report));

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const skippedNote = result.skipped > 0 ? ` ${result.skipped} unsupported file(s) were skipped.` : '';
    const intakeNote = report.suggestedNextActions.length > 0
      ? `\n\n${summarizeImportReport(report)}. Tap assets for suggested use.`
      : '';
    Alert.alert('Import complete', `Added ${result.assets.length} asset(s) to your library.${skippedNote}${intakeNote}`);
  };

  const handleImportImage = async () => {
    try {
      setImporting(true);

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
      if (result.canceled || !result.assets?.length || !project) return;

      const incoming: ProjectAsset[] = [];

      if (Platform.OS !== 'web') {
        const dir = assetDir(projectId!);
        await ensureDir(dir);
        for (const img of result.assets) {
          const ext = img.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
          const name = `img_${createId()}.${ext}`;
          const destUri = `${dir}${name}`;
          await copyFile(img.uri, destUri);
          incoming.push({
            id: createId(),
            name,
            type: 'image',
            uri: destUri,
            mimeType: img.mimeType ?? `image/${ext}`,
            size: img.fileSize ?? 0,
            importedAt: new Date().toISOString(),
          });
        }
      } else {
        for (const img of result.assets) {
          const mimeType = img.mimeType ?? 'image/jpeg';
          const ext = mimeType.split('/')[1] ?? 'jpg';
          const name = img.fileName ?? `img_${createId()}.${ext}`;
          incoming.push({
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

      if (incoming.length === 0) return;

      const transaction = executeBatchAssetImportTransaction(project, incoming);
      if (!transaction.ok) {
        const report = buildBatchImportFailureReport(transaction);
        Alert.alert('Import failed', formatDiagnosticReportMessage(report));
        return;
      }

      replaceProjectSnapshot(projectId!, transaction.after!);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Import failed', 'Could not import the selected image(s).');
    } finally {
      setImporting(false);
    }
  };

  const handleImportFiles = async () => {
    try {
      setImporting(true);
      finishImport(await pickAndImportAssetFiles(projectId!, existingNames));
    } finally {
      setImporting(false);
    }
  };

  const handleImportZip = async () => {
    try {
      setImporting(true);
      finishImport(await pickAndImportAssetZip(projectId!, existingNames));
    } finally {
      setImporting(false);
    }
  };

  const showImportMenu = () => {
    if (Platform.OS === 'web') {
      void handleImportImage();
      return;
    }

    Alert.alert(
      'Import Assets',
      'Add images, audio, or portable 3D models (GLB/glTF) from your device, or import a zip pack.',
      [
        { text: 'Photo Library', onPress: () => { void handleImportImage(); } },
        { text: 'Files (multi-select)', onPress: () => { void handleImportFiles(); } },
        { text: 'Zip Pack', onPress: () => { void handleImportZip(); } },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const handleDelete = (assetId: string, name: string) => {
    Alert.alert('Remove Asset', `Remove "${name}" from this story?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          if (!project) return;
          const { transaction } = executeSafeAssetDelete(project, assetId);
          if (!transaction.ok || !transaction.after) {
            const report = transaction.diagnosticReport;
            const message = report?.summary
              ?? transaction.diagnostics
                .filter(item => item.severity === 'error')
                .map(item => item.message)
                .join('\n\n')
              ?? 'This asset is still referenced elsewhere in the project.';
            Alert.alert('Cannot remove asset', message);
            return;
          }

          const asset = project.assets.find(a => a.id === assetId);
          if (asset) await deleteFile(asset.uri).catch(() => {});
          replaceProjectSnapshot(projectId!, transaction.after!);
          if (previewAsset?.id === assetId) closePreview();
          if (modelDetailAsset?.id === assetId) setModelDetailAsset(null);
        },
      },
    ]);
  };

  const handlePreview = (asset: ProjectAsset) => {
    if (isModelAsset(asset)) {
      setModelDetailAsset(asset);
      return;
    }
    setPreviewAsset(asset);
    setAudioPlaying(false);
    if (audioRef.current) { audioRef.current.unload(); audioRef.current = null; }
  };

  const closePreview = () => {
    if (audioRef.current) { audioRef.current.unload(); audioRef.current = null; }
    setAudioPlaying(false);
    setPreviewAsset(null);
  };

  const closeModelDetail = () => setModelDetailAsset(null);

  const handleModelUpdate = (assetId: string, patch: Partial<ProjectAsset>) => {
    updateAsset(projectId!, assetId, patch);
    setModelDetailAsset(prev => (prev?.id === assetId ? { ...prev, ...patch } : prev));
  };

  const handleImportModelPreview = (modelAsset: ProjectAsset, imageAsset: ProjectAsset) => {
    const previewId = createId();
    const preview = { ...imageAsset, id: previewId };
    addAsset(projectId!, preview);
    updateAsset(projectId!, modelAsset.id, { previewImageAssetId: previewId });
    setModelDetailAsset(prev => (prev?.id === modelAsset.id ? { ...prev, previewImageAssetId: previewId } : prev));
  };

  const commitRecipeResult = ({ project: nextProject, plan }: { project: NonNullable<ReturnType<typeof getProject>>; plan: AssetRecipePlan }) => {
    if (!projectId) return;
    replaceProjectSnapshot(projectId, nextProject);
    Alert.alert(
      'Suggestion applied',
      `Updated "${plan.targetFragmentTitle}" with ${plan.preview.length} planned change${plan.preview.length === 1 ? '' : 's'}. You can edit the results in the scene editor.`,
    );
  };

  const openRecipeSheet = (asset: ProjectAsset) => {
    const recipe = suggestedRecipeForAsset(asset);
    if (recipe === 'none') return;
    setRecipeAsset(asset);
    setRecipeToApply(recipe);
    setRecipeSheetOpen(true);
  };

  const commitPlayableRoomResult = ({ project: nextProject, plan }: {
    project: NonNullable<ReturnType<typeof getProject>>;
    plan: PlayableRoomPlan;
  }) => {
    if (!projectId || !plan.patch) return;
    replaceProjectSnapshot(projectId, nextProject);
    Alert.alert(
      'Playable room generated',
      `"${plan.targetFragmentTitle}" is ready in Chronica Player. Talk to the NPC, collect the pickup, then try the gate.`,
    );
  };

  const assets = project?.assets ?? [];
  const modelLibraryWarnings = project ? validateModelAssetsInLibrary(project) : [];
  const libraryIntakeReport = useMemo(() => buildAssetImportReport(assets), [assets]);
  const integrityReport = useMemo(
    () => (project ? buildProjectIntegrityReport(project) : null),
    [project],
  );
  const resolvedModelDetail = modelDetailAsset
    ? assets.find(a => a.id === modelDetailAsset.id) ?? modelDetailAsset
    : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={assets}
        keyExtractor={a => a.id}
        renderItem={({ item }) => (
          <AssetItem
            asset={item}
            assets={assets}
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
            <View style={styles.headerBlock}>
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                Tap an asset to preview. Import PNG, JPG, WEBP, GIF, MP3, WAV, OGG, M4A, GLB, GLTF, or a zip pack.
              </Text>
              {integrityReport && !integrityReport.ok && (
                <View style={[styles.libraryWarning, { borderColor: colors.destructive + '55', backgroundColor: colors.destructive + '10' }]}>
                  <Feather name="shield" size={14} color={colors.destructive} />
                  <Text style={[styles.libraryWarningText, { color: colors.foreground }]}>
                    Project integrity: {integrityReport.summary}. Review scenes and assets before playtest.
                  </Text>
                </View>
              )}
              {integrityReport && integrityReport.ok && integrityReport.warnings.length > 0 && (
                <View style={[styles.libraryInfo, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
                  <Feather name="shield" size={14} color={colors.primary} />
                  <Text style={[styles.libraryWarningText, { color: colors.foreground }]}>
                    Project integrity: {integrityReport.summary}
                  </Text>
                </View>
              )}
              {modelLibraryWarnings.length > 0 && (
                <View style={[styles.libraryWarning, { borderColor: colors.destructive + '55', backgroundColor: colors.destructive + '10' }]}>
                  <Feather name="alert-triangle" size={14} color={colors.destructive} />
                  <Text style={[styles.libraryWarningText, { color: colors.foreground }]}>
                    {modelLibraryWarnings.length} model asset{modelLibraryWarnings.length === 1 ? '' : 's'} need attention (missing preview or invalid extension).
                  </Text>
                </View>
              )}
              {libraryIntakeReport.unknown.length > 0 && (
                <View style={[styles.libraryInfo, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
                  <Feather name="info" size={14} color={colors.primary} />
                  <Text style={[styles.libraryWarningText, { color: colors.foreground }]}>
                    {libraryIntakeReport.unknown.length} asset{libraryIntakeReport.unknown.length === 1 ? '' : 's'} may need classification — optional, tap to review suggested use.
                  </Text>
                </View>
              )}
              {importReportSummary && (
                <View style={[styles.libraryInfo, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
                  <Feather name="check-circle" size={14} color={colors.primary} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[styles.libraryWarningText, { color: colors.foreground }]}>
                      Last import: {importReportSummary}
                    </Text>
                    <TouchableOpacity onPress={() => setImportReportSummary(null)}>
                      <Text style={[styles.dismissLink, { color: colors.primary }]}>Dismiss</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              <TouchableOpacity
                style={[styles.generateRoomBtn, { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
                onPress={() => setRoomGeneratorOpen(true)}
              >
                <Feather name="map" size={15} color={colors.primary} />
                <Text style={[styles.generateRoomText, { color: colors.primary }]}>Generate playable room</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="image"
            title="No assets yet"
            message="Import images, audio, and portable GLB/glTF models for scenes and stage composition. Zip packs from asset stores work too."
            actionLabel="Import Assets"
            onAction={showImportMenu}
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
        onPress={showImportMenu}
        disabled={importing}
        activeOpacity={0.8}
      >
        {importing ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Feather name="plus" size={24} color="#fff" />
        )}
      </TouchableOpacity>

      <Modal visible={!!previewAsset} transparent animationType="fade" onRequestClose={closePreview}>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.92)' }]}>
          <TouchableOpacity style={[styles.closePreviewBtn, { top: insets.top + 16 }]} onPress={closePreview}>
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>

          {previewAsset?.type === 'image' && (
            <Image source={{ uri: previewAsset.uri }} style={styles.previewImage} resizeMode="contain" />
          )}

          {previewAsset?.type === 'audio' && previewAsset && (
            <AudioPreview
              asset={previewAsset}
              playing={audioPlaying}
              onToggle={async () => {
                if (audioPlaying && audioRef.current) {
                  await audioRef.current.pause();
                  setAudioPlaying(false);
                  return;
                }
                if (audioRef.current) {
                  await audioRef.current.play();
                  setAudioPlaying(true);
                  return;
                }
                try {
                  const { Audio } = await import('expo-av');
                  await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
                  const { sound } = await Audio.Sound.createAsync({ uri: previewAsset.uri });
                  audioRef.current = {
                    unload: () => { sound.unloadAsync().catch(() => {}); },
                    pause: () => sound.pauseAsync().catch(() => {}),
                    play: () => sound.playAsync().catch(() => {}),
                  };
                  await sound.playAsync();
                  setAudioPlaying(true);
                } catch {
                  Alert.alert('Playback failed', 'Could not play this audio file.');
                }
              }}
            />
          )}

          {previewAsset?.type === 'data' && previewAsset && (
            <DataPreview asset={previewAsset} />
          )}

          <View style={[styles.previewMeta, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.previewMetaText}>{previewAsset?.name}</Text>
            <Text style={styles.previewMetaText}>
              {previewAsset?.mimeType} · {((previewAsset?.size ?? 0) / 1024).toFixed(1)} KB
            </Text>
            {previewAsset && project && (
              <PreviewIntakeSummary
                asset={previewAsset}
                onApply={() => openRecipeSheet(previewAsset)}
              />
            )}
          </View>
        </View>
      </Modal>

      <ModelAssetDetailPanel
        visible={!!resolvedModelDetail}
        asset={resolvedModelDetail}
        assets={assets}
        project={project ?? null}
        onClose={closeModelDetail}
        onUpdate={patch => resolvedModelDetail && handleModelUpdate(resolvedModelDetail.id, patch)}
        onImportPreviewImage={imageAsset => {
          if (!resolvedModelDetail) return;
          handleImportModelPreview(resolvedModelDetail, imageAsset);
        }}
        onRecipeApplied={commitRecipeResult}
      />

      {project && recipeAsset && (
        <AssetRecipeApplySheet
          visible={recipeSheetOpen}
          project={project}
          asset={recipeAsset}
          recipe={recipeToApply}
          onClose={() => setRecipeSheetOpen(false)}
          onApplied={result => {
            commitRecipeResult(result);
            setRecipeSheetOpen(false);
          }}
        />
      )}

      {project && (
        <PlayableRoomGeneratorSheet
          visible={roomGeneratorOpen}
          project={project}
          onClose={() => setRoomGeneratorOpen(false)}
          onApplied={commitPlayableRoomResult}
        />
      )}
    </View>
  );
}

function PreviewIntakeSummary({
  asset,
  onApply,
}: {
  asset: ProjectAsset;
  onApply?: () => void;
}) {
  const classification = useAssetIntakeClassification(asset);
  return (
    <View style={styles.previewIntake}>
      <AssetIntakeSummary classification={classification} onApplySuggestion={onApply} />
    </View>
  );
}

function AudioPreview({
  asset,
  playing,
  onToggle,
}: {
  asset: ProjectAsset;
  playing: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.audioPreview}>
      <Feather name="music" size={48} color="#fff" />
      <Text style={styles.audioTitle}>{asset.name}</Text>
      <TouchableOpacity style={styles.audioBtn} onPress={onToggle} activeOpacity={0.8}>
        <Feather name={playing ? 'pause' : 'play'} size={20} color="#fff" />
        <Text style={styles.audioBtnText}>{playing ? 'Pause' : 'Play'}</Text>
      </TouchableOpacity>
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
  headerBlock: { gap: 8, paddingBottom: 4 },
  hint: { fontSize: 12, fontFamily: 'Inter_400Regular', paddingHorizontal: 20 },
  libraryWarning: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    alignItems: 'flex-start',
  },
  libraryWarningText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular' },
  libraryInfo: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    alignItems: 'flex-start',
  },
  dismissLink: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  generateRoomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
  },
  generateRoomText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
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
  audioPreview: { alignItems: 'center', gap: 16, paddingHorizontal: 24 },
  audioTitle: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  audioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  audioBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  dataPreview: { width: '90%', maxHeight: '65%', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10 },
  dataText: { color: '#e0ddf0', fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  previewMeta: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', gap: 4, paddingTop: 16 },
  previewMetaText: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'Inter_400Regular' },
  previewIntake: { width: '90%', marginTop: 8, paddingHorizontal: 8 },
});
