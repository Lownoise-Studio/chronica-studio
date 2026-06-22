import React, { useState } from 'react';
import {
  Alert, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useProjects } from '@/context/ProjectsContext';
import { validateProject } from '@/engine/validator';
import { documentDirectory, ensureDir } from '@/storage/fileSystem';

async function writeAndShareJson(filename: string, content: string): Promise<void> {
  if (Platform.OS === 'web') {
    await Share.share({ message: content, title: filename });
    return;
  }
  try {
    const FS = await import('expo-file-system/build/legacy');
    const dir = `${documentDirectory}pse_exports/`;
    await FS.makeDirectoryAsync(dir, { intermediates: true });
    const path = `${dir}${filename}`;
    await FS.writeAsStringAsync(path, content);
    // Share the JSON text — works across all Android share targets
    await Share.share({ message: content, title: filename });
  } catch {
    // Final fallback: share content as plain text
    await Share.share({ message: content, title: filename });
  }
}

export default function ExportScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getProject, exportProject, importProject } = useProjects();
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [working, setWorking] = useState(false);

  const project = getProject(projectId!);
  if (!project) return null;

  const errors = validateProject(project);

  const handleExport = async () => {
    setWorking(true);
    try {
      const json = exportProject(projectId!);
      if (!json) { setStatus({ ok: false, msg: 'Export failed.' }); return; }
      const filename = `${project.title.replace(/[^a-z0-9]/gi, '_')}_v${project.schemaVersion}.json`;
      await writeAndShareJson(filename, json);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStatus({ ok: true, msg: 'Project exported successfully.' });
    } catch (e: any) {
      setStatus({ ok: false, msg: e?.message ?? 'Export failed.' });
    } finally {
      setWorking(false);
    }
  };

  const handleImport = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not supported', 'File import is only available on Android.');
      return;
    }
    setWorking(true);
    try {
      const { getDocumentAsync } = await import('expo-document-picker');
      const FS = await import('expo-file-system/build/legacy');
      const result = await getDocumentAsync({
        type: ['application/json', 'text/plain', 'text/json', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const file = result.assets[0];
      const content = await FS.readAsStringAsync(file.uri);
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
      {/* Export */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Feather name="download" size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Export Project</Text>
        </View>
        <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
          Save this project as a portable JSON file you can share or back up.
          Asset URIs are stripped — only project data and fragment content is exported.
        </Text>
        {errors.length > 0 && (
          <View style={[styles.warnBox, { backgroundColor: colors.destructive + '22', borderColor: colors.destructive + '55' }]}>
            <Feather name="alert-triangle" size={13} color={colors.destructive} />
            <Text style={[styles.warnText, { color: colors.destructive }]}>
              {errors.length} validation issue{errors.length !== 1 ? 's' : ''} found. Export will still work but the project may not play correctly.
            </Text>
          </View>
        )}
        <View style={styles.meta}>
          <Text style={[styles.metaItem, { color: colors.mutedForeground }]}>{project.fragments.length} fragments</Text>
          <Text style={[styles.metaItem, { color: colors.mutedForeground }]}>Schema v{project.schemaVersion}</Text>
          <Text style={[styles.metaItem, { color: colors.mutedForeground }]}>Updated {new Date(project.updatedAt).toLocaleDateString()}</Text>
        </View>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={handleExport}
          disabled={working}
          activeOpacity={0.8}
        >
          <Feather name={working ? 'loader' : 'share'} size={16} color="#fff" />
          <Text style={styles.btnText}>{working ? 'Exporting…' : 'Export & Share'}</Text>
        </TouchableOpacity>
      </View>

      {/* Import */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Feather name="upload" size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Import Project</Text>
        </View>
        <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
          Load a previously exported Chronica Studio JSON file.
          The imported project will be added as a new project in your library.
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

      {/* Status feedback */}
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

      {/* Format reference */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>File Format</Text>
        <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
          Exported files include:{'\n'}
          • <Text style={{ color: colors.foreground }}>schemaVersion</Text> — format version for compatibility checks{'\n'}
          • <Text style={{ color: colors.foreground }}>id, title, description</Text> — project metadata{'\n'}
          • <Text style={{ color: colors.foreground }}>fragments[]</Text> — all story fragments with choices{'\n'}
          • <Text style={{ color: colors.foreground }}>startLocation, initialVariables, initialMemory</Text> — default game state{'\n'}
          Asset files are not embedded — re-import images after loading on a new device.
        </Text>
      </View>
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
