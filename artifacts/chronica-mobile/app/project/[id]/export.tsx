import React, { useState } from 'react';
import {
  Alert, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as FS from 'expo-file-system/legacy';
import { useColors } from '@/hooks/useColors';
import { useProjects } from '@/context/ProjectsContext';
import { useAdvancedMode } from '@/context/AdvancedModeContext';
import { compileProject } from '@/engine/compiler';
import { isChronicaPackageBytes } from '@/engine/chronica-package';
import { documentDirectory } from '@/storage/fileSystem';
import { buildChronicaPackageBytes } from '@/storage/chronica-package-io';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function readFileBytes(uri: string): Promise<Uint8Array> {
  const b64 = await FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 });
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function writeAndShareJson(filename: string, content: string): Promise<void> {
  if (Platform.OS === 'web') {
    await Share.share({ message: content, title: filename });
    return;
  }
  try {
    const dir = `${documentDirectory}pse_exports/`;
    await FS.makeDirectoryAsync(dir, { intermediates: true });
    const path = `${dir}${filename}`;
    await FS.writeAsStringAsync(path, content);
    if (Platform.OS === 'ios') {
      await Share.share({ url: path, title: filename });
    } else {
      await Share.share({ message: content, title: filename });
    }
  } catch {
    await Share.share({ message: content, title: filename });
  }
}

async function writeAndSharePackage(filename: string, bytes: Uint8Array): Promise<void> {
  if (Platform.OS === 'web') {
    Alert.alert('Not supported', 'Game package export is not available in the web preview. Use the iOS or Android app.');
    return;
  }
  const dir = `${documentDirectory}pse_exports/`;
  await FS.makeDirectoryAsync(dir, { intermediates: true });
  const path = `${dir}${filename}`;
  await FS.writeAsStringAsync(path, bytesToBase64(bytes), { encoding: FS.EncodingType.Base64 });
  await Share.share({ url: path, title: filename });
}

export default function ExportScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getProject, exportProject, importProject, importProjectPackage } = useProjects();
  const { advancedMode } = useAdvancedMode();
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [working, setWorking] = useState(false);

  const project = getProject(projectId!);
  if (!project) return null;

  const compileResult = compileProject(project);
  const errors = compileResult.ok ? [] : compileResult.diagnostics;
  const imageCount = project.assets.filter(a => a.type === 'image').length;

  const handleExportJson = async () => {
    setWorking(true);
    try {
      const json = exportProject(projectId!);
      if (!json) { setStatus({ ok: false, msg: 'Export failed.' }); return; }
      const filename = `${project.title.replace(/[^a-z0-9]/gi, '_')}_v${project.schemaVersion}.json`;
      await writeAndShareJson(filename, json);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStatus({ ok: true, msg: 'Story JSON exported and shared successfully.' });
    } catch (e: any) {
      setStatus({ ok: false, msg: e?.message ?? 'Export failed.' });
    } finally {
      setWorking(false);
    }
  };

  const handleExportPackage = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not supported', 'Game package export is not available in the web preview. Use the iOS or Android app.');
      return;
    }
    if (errors.length > 0) {
      Alert.alert(
        'Fix issues before export',
        `${errors.length} validation issue${errors.length !== 1 ? 's' : ''} must be resolved before exporting a game package.\n\n${errors.slice(0, 4).map(e => `• ${e.message}`).join('\n')}`,
      );
      return;
    }
    setWorking(true);
    try {
      const built = await buildChronicaPackageBytes(project);
      if (!built.ok) {
        setStatus({ ok: false, msg: built.error });
        return;
      }
      if (built.warnings.length) {
        Alert.alert(
          'Export warnings',
          built.warnings.join('\n\n'),
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setWorking(false) },
            {
              text: 'Export anyway',
              onPress: async () => {
                try {
                  const filename = `${project.title.replace(/[^a-z0-9]/gi, '_')}.chronica`;
                  await writeAndSharePackage(filename, built.bytes);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  setStatus({
                    ok: true,
                    msg: `Game package exported with ${built.plan.assetFiles.length} image(s).`,
                  });
                } catch (e: any) {
                  setStatus({ ok: false, msg: e?.message ?? 'Export failed.' });
                } finally {
                  setWorking(false);
                }
              },
            },
          ],
        );
        return;
      }
      const filename = `${project.title.replace(/[^a-z0-9]/gi, '_')}.chronica`;
      await writeAndSharePackage(filename, built.bytes);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStatus({
        ok: true,
        msg: `Game package exported with ${built.plan.assetFiles.length} image(s).`,
      });
    } catch (e: any) {
      setStatus({ ok: false, msg: e?.message ?? 'Export failed.' });
    } finally {
      setWorking(false);
    }
  };

  const handleImport = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not supported', 'File import is not available in the web preview. Use the iOS or Android app.');
      return;
    }
    setWorking(true);
    try {
      const { getDocumentAsync } = await import('expo-document-picker');
      const result = await getDocumentAsync({
        type: ['application/zip', 'application/json', 'text/plain', 'text/json', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const file = result.assets[0];
      const bytes = await readFileBytes(file.uri);

      if (isChronicaPackageBytes(bytes)) {
        const outcome = await importProjectPackage(bytes);
        if (outcome.ok && outcome.project) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setStatus({
            ok: true,
            msg: `Imported game package "${outcome.project.title}" with images.`,
          });
        } else {
          setStatus({ ok: false, msg: outcome.error ?? 'Package import failed.' });
        }
        return;
      }

      const content = new TextDecoder().decode(bytes);
      const outcome = importProject(content);
      if (outcome.ok && outcome.project) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStatus({ ok: true, msg: `Imported "${outcome.project.title}" successfully.` });
      } else {
        setStatus({ ok: false, msg: outcome.error ?? 'Import failed.' });
      }
    } catch (e: any) {
      setStatus({ ok: false, msg: e?.message ?? 'Could not read file.' });
    } finally {
      setWorking(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 24 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Export game package (preferred) */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.primary + '55' }]}>
        <View style={styles.cardHeader}>
          <Feather name="package" size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Export Game Package</Text>
        </View>
        <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
          Recommended. Exports your story plus image files in a single .chronica package.
          Another device can import it and play with backgrounds intact.
        </Text>
        {errors.length > 0 && (
          <View style={[styles.warnBox, { backgroundColor: colors.destructive + '22', borderColor: colors.destructive + '55' }]}>
            <Feather name="alert-triangle" size={13} color={colors.destructive} />
            <Text style={[styles.warnText, { color: colors.destructive }]}>
              {errors.length} issue{errors.length !== 1 ? 's' : ''} found in your story. Export will still work, but some scenes may not run as expected.
            </Text>
          </View>
        )}
        <View style={styles.meta}>
          <Text style={[styles.metaItem, { color: colors.mutedForeground }]}>{project.fragments.length} scenes</Text>
          <Text style={[styles.metaItem, { color: colors.mutedForeground }]}>{imageCount} image{imageCount !== 1 ? 's' : ''}</Text>
          <Text style={[styles.metaItem, { color: colors.mutedForeground }]}>Updated {new Date(project.updatedAt).toLocaleDateString()}</Text>
        </View>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={handleExportPackage}
          disabled={working}
          activeOpacity={0.8}
        >
          <Feather name={working ? 'loader' : 'package'} size={16} color="#fff" />
          <Text style={styles.btnText}>{working ? 'Exporting…' : 'Export Game Package'}</Text>
        </TouchableOpacity>
      </View>

      {/* Export JSON backup */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Feather name="download" size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Export Story JSON</Text>
        </View>
        <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
          Lightweight backup of writing and choices only. Images are not included —
          re-import images after loading on a new device.
        </Text>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }]}
          onPress={handleExportJson}
          disabled={working}
          activeOpacity={0.8}
        >
          <Feather name={working ? 'loader' : 'share'} size={16} color={colors.foreground} />
          <Text style={[styles.btnText, { color: colors.foreground }]}>{working ? 'Exporting…' : 'Export JSON'}</Text>
        </TouchableOpacity>
      </View>

      {/* Import */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Feather name="upload" size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Import a Story</Text>
        </View>
        <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
          Load a .chronica game package or a previously exported JSON backup.
          The imported story will be added to your library.
        </Text>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }]}
          onPress={handleImport}
          disabled={working}
          activeOpacity={0.8}
        >
          <Feather name="file-plus" size={16} color={colors.foreground} />
          <Text style={[styles.btnText, { color: colors.foreground }]}>Choose File</Text>
        </TouchableOpacity>
      </View>

      {status && (
        <View style={[
          styles.statusBox,
          { backgroundColor: status.ok ? colors.primary + '22' : colors.destructive + '22',
            borderColor: status.ok ? colors.primary + '55' : colors.destructive + '55' }
        ]}>
          <Feather
            name={status.ok ? 'check-circle' : 'alert-circle'}
            size={15}
            color={status.ok ? colors.primary : colors.destructive}
          />
          <Text style={[styles.statusText, { color: status.ok ? colors.primary : colors.destructive }]}>
            {status.msg}
          </Text>
        </View>
      )}

      {advancedMode && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>File Formats</Text>
          <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
            <Text style={{ color: colors.foreground }}>.chronica</Text> — ZIP package with manifest.json, story.json, and assets/{'\n'}
            <Text style={{ color: colors.foreground }}>.json</Text> — story data only (legacy backup){'\n\n'}
            Package manifest fields: format, version, app, exportedAt, title, assetCount, storySchemaVersion
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  card: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  cardDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  warnBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 8, borderWidth: 1, padding: 10 },
  warnText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaItem: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 8, paddingVertical: 13 },
  btnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  statusBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 10, borderWidth: 1, padding: 14 },
  statusText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', lineHeight: 18 },
});
