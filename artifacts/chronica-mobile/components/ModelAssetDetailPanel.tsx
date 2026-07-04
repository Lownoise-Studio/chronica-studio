import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { createId } from '@/engine/identity';
import { resolveModelPreviewUri } from '@/engine/asset-resolver';
import { AssetIntakeSummary } from '@/components/AssetIntakeHint';
import { AssetRecipeApplySheet } from '@/components/AssetRecipeApplySheet';
import {
  MODEL_IMPORT_GUIDANCE,
  formatModelAssetSize,
  getModelAssetLibraryMessages,
  modelAssetHasPreview,
  suggestedPreviewImageName,
} from '@/engine/model-assets';
import { classifyProjectAsset } from '@/engine/asset-intake';
import type { AssetIntakeRecipe } from '@/engine/asset-intake';
import type { Project } from '@/engine/types';
import type { ProjectAsset } from '@/engine/types';

export function ModelAssetDetailPanel({
  visible,
  asset,
  assets,
  project,
  onClose,
  onUpdate,
  onImportPreviewImage,
  onRecipeApplied,
}: {
  visible: boolean;
  asset: ProjectAsset | null;
  assets: readonly ProjectAsset[];
  project: Project | null;
  onClose: () => void;
  onUpdate: (patch: Partial<ProjectAsset>) => void;
  onImportPreviewImage: (imageAsset: ProjectAsset) => void;
  onRecipeApplied?: (result: import('@/engine/asset-recipes').AssetRecipeApplyResult) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [source, setSource] = useState('');
  const [license, setLicense] = useState('');
  const [recipeSheetOpen, setRecipeSheetOpen] = useState(false);
  const [recipeToApply, setRecipeToApply] = useState<AssetIntakeRecipe>('none');

  React.useEffect(() => {
    if (!asset) return;
    setSource(asset.source ?? '');
    setLicense(asset.license ?? '');
  }, [asset?.id]);

  const previewUri = asset ? resolveModelPreviewUri(assets, asset) : undefined;
  const messages = useMemo(
    () => (asset ? getModelAssetLibraryMessages(asset, assets) : []),
    [asset, assets],
  );
  const imageAssets = useMemo(
    () => assets.filter(a => a.type === 'image' && a.id !== asset?.id),
    [assets, asset?.id],
  );
  const hasPreview = asset ? modelAssetHasPreview(asset, assets) : false;
  const intake = useMemo(
    () => (asset ? classifyProjectAsset(asset) : null),
    [asset?.id, asset?.name, asset?.type, asset?.mimeType],
  );

  if (!asset) return null;

  const saveMetadata = () => {
    onUpdate({
      source: source.trim() || undefined,
      license: license.trim() || undefined,
    });
  };

  const linkPreview = (imageAsset: ProjectAsset) => {
    onUpdate({ previewImageAssetId: imageAsset.id });
  };

  const pickPreviewImage = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission required', 'Allow photo library access to add a preview thumbnail.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.length) return;
      const img = result.assets[0]!;
      const mimeType = img.mimeType ?? 'image/png';
      const ext = mimeType.split('/')[1] ?? 'png';
      const name = suggestedPreviewImageName(asset.name).replace(/\.png$/i, `.${ext}`);
      onImportPreviewImage({
        id: createId(),
        name,
        type: 'image',
        uri: img.uri,
        mimeType,
        size: img.fileSize ?? 0,
        importedAt: new Date().toISOString(),
      });
    } catch {
      Alert.alert('Import failed', 'Could not add a preview thumbnail.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>Model asset</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 16 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.previewCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
              {previewUri ? (
                <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />
              ) : (
                <View style={[styles.previewFallback, { backgroundColor: colors.muted }]}>
                  <Feather name="box" size={36} color={colors.primary} />
                  <Text style={[styles.previewFallbackText, { color: colors.mutedForeground }]}>No preview thumbnail</Text>
                </View>
              )}
            </View>

            {!hasPreview && (
              <View style={[styles.warningCard, { borderColor: colors.destructive + '55', backgroundColor: colors.destructive + '12' }]}>
                <Feather name="alert-triangle" size={14} color={colors.destructive} />
                <Text style={[styles.warningText, { color: colors.foreground }]}>
                  Add a preview thumbnail so stage authoring shows this model clearly.
                </Text>
              </View>
            )}

            <MetaSection title="Details" colors={colors}>
              <MetaRow label="Filename" value={asset.name} colors={colors} />
              <MetaRow label="Type" value={asset.type} colors={colors} />
              <MetaRow label="MIME" value={asset.mimeType || '—'} colors={colors} />
              <MetaRow label="Size" value={formatModelAssetSize(asset.size)} colors={colors} />
              <MetaRow label="Source" value={asset.source || '—'} colors={colors} />
              <MetaRow label="License" value={asset.license || '—'} colors={colors} />
            </MetaSection>

            {intake && (
              <MetaSection title="Suggested use" colors={colors}>
                <AssetIntakeSummary
                  classification={intake}
                  onApplySuggestion={
                    project && intake.suggestedRecipe !== 'none'
                      ? () => {
                          setRecipeToApply(intake.suggestedRecipe);
                          setRecipeSheetOpen(true);
                        }
                      : undefined
                  }
                />
              </MetaSection>
            )}

            <MetaSection title="Edit metadata" colors={colors}>
              <Field label="Source" value={source} onChange={setSource} placeholder="e.g. Blender export" colors={colors} />
              <Field label="License" value={license} onChange={setLicense} placeholder="e.g. CC0" colors={colors} />
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={saveMetadata}>
                <Text style={styles.primaryBtnText}>Save metadata</Text>
              </TouchableOpacity>
            </MetaSection>

            <MetaSection title="Preview thumbnail" colors={colors}>
              <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.border }]} onPress={pickPreviewImage}>
                <Feather name="image" size={15} color={colors.primary} />
                <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>Import preview image</Text>
              </TouchableOpacity>
              {imageAssets.length > 0 && (
                <>
                  <Text style={[styles.hint, { color: colors.mutedForeground }]}>Or link an existing image:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                    {imageAssets.map(imageAsset => {
                      const active = asset.previewImageAssetId === imageAsset.id;
                      return (
                        <TouchableOpacity
                          key={imageAsset.id}
                          style={[styles.chip, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary + '18' : colors.card }]}
                          onPress={() => linkPreview(imageAsset)}
                        >
                          <Text style={{ color: active ? colors.primary : colors.foreground, fontSize: 11 }} numberOfLines={1}>
                            {imageAsset.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </>
              )}
            </MetaSection>

            <MetaSection title="GLB / glTF import guidance" colors={colors}>
              {MODEL_IMPORT_GUIDANCE.map(line => (
                <Text key={line} style={[styles.guidance, { color: colors.mutedForeground }]}>• {line}</Text>
              ))}
            </MetaSection>

            {messages.length > 0 && (
              <MetaSection title="Validation" colors={colors}>
                {messages.map(message => (
                  <View key={message.message} style={styles.messageRow}>
                    <Feather
                      name={message.kind === 'warning' ? 'alert-circle' : 'info'}
                      size={13}
                      color={message.kind === 'warning' ? colors.destructive : colors.primary}
                    />
                    <Text style={[styles.messageText, { color: colors.foreground }]}>{message.message}</Text>
                  </View>
                ))}
              </MetaSection>
            )}
          </ScrollView>
          {project && asset && (
            <AssetRecipeApplySheet
              visible={recipeSheetOpen}
              project={project}
              asset={asset}
              recipe={recipeToApply}
              onClose={() => setRecipeSheetOpen(false)}
              onApplied={result => {
                onRecipeApplied?.(result);
                setRecipeSheetOpen(false);
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function MetaSection({
  title,
  colors,
  children,
}: {
  title: string;
  colors: ReturnType<typeof useColors>;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function MetaRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.metaRow}>
      <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.metaValue, { color: colors.foreground }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  colors,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  content: { paddingHorizontal: 16, gap: 14 },
  previewCard: { borderWidth: 1, borderRadius: 10, overflow: 'hidden', height: 160 },
  previewImage: { width: '100%', height: '100%' },
  previewFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  previewFallbackText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  warningCard: { flexDirection: 'row', gap: 8, borderWidth: 1, borderRadius: 8, padding: 10, alignItems: 'flex-start' },
  warningText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular' },
  section: { gap: 8 },
  sectionTitle: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.6 },
  metaRow: { flexDirection: 'row', gap: 10 },
  metaLabel: { width: 72, fontSize: 12, fontFamily: 'Inter_500Medium' },
  metaValue: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular' },
  field: { gap: 4 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, fontFamily: 'Inter_400Regular' },
  primaryBtn: { borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 8, paddingVertical: 10 },
  secondaryBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  hint: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  chips: { gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, maxWidth: 140 },
  guidance: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular' },
  messageRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  messageText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular' },
});
