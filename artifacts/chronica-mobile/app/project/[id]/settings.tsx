import React, { useEffect, useState } from 'react';
import {
  Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useProjects } from '@/context/ProjectsContext';

export default function SettingsScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getProject, updateProject, deleteProject, syncProjectToCloud, downloadProjectFromCloud } = useProjects();

  const project = getProject(projectId!);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (project) { setTitle(project.title); setDesc(project.description); }
  }, [project?.id]);

  if (!project) return null;

  const save = () => {
    updateProject(projectId!, { title: title.trim() || project.title, description: desc.trim() });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const confirmDelete = () => {
    Alert.alert('Delete Project', `Delete "${project.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          deleteProject(projectId!);
          router.dismissAll();
        },
      },
    ]);
  };

  const handleSync = async () => {
    setSyncing(true);
    const ok = await syncProjectToCloud(projectId!);
    setSyncing(false);
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Backed Up', 'Project saved to cloud.');
    } else {
      Alert.alert('Sync Failed', 'Could not reach the server. Check your connection.');
    }
  };

  const handleRestore = async () => {
    setSyncing(true);
    const ok = await downloadProjectFromCloud(projectId!);
    setSyncing(false);
    Alert.alert(ok ? 'Restored' : 'Failed', ok ? 'Project restored from cloud.' : 'No cloud backup found.');
  };

  const stats: [string, number][] = [
    ['Fragments', project.fragments.length],
    ['Locations', new Set(project.fragments.map(f => f.locationId)).size],
    ['Assets', project.assets.length],
    ['Total Choices', project.fragments.reduce((s, f) => s + f.choices.length, 0)],
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        padding: 16,
        gap: 12,
        paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 24,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Project info */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.secTitle, { color: colors.foreground }]}>Project Info</Text>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Title</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
          value={title}
          onChangeText={setTitle}
          placeholder="Project title"
          placeholderTextColor={colors.mutedForeground}
        />
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
          value={desc}
          onChangeText={setDesc}
          placeholder="Brief description..."
          placeholderTextColor={colors.mutedForeground}
          multiline
          numberOfLines={3}
        />
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={save} activeOpacity={0.8}>
          <Text style={styles.btnText}>Save Changes</Text>
        </TouchableOpacity>
      </View>

      {/* Cloud sync */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.secTitle, { color: colors.foreground }]}>Cloud Sync</Text>
        <Text style={[styles.secDesc, { color: colors.mutedForeground }]}>
          Back up or restore your project via cloud storage.
        </Text>
        <View style={styles.syncRow}>
          <TouchableOpacity
            style={[styles.syncBtn, { backgroundColor: colors.primary }]}
            onPress={handleSync}
            disabled={syncing}
            activeOpacity={0.8}
          >
            <Feather name="upload-cloud" size={15} color="#fff" />
            <Text style={styles.syncBtnText}>{syncing ? 'Working...' : 'Backup'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.syncBtn, { backgroundColor: colors.secondary, borderColor: colors.border, borderWidth: 1 }]}
            onPress={handleRestore}
            disabled={syncing}
            activeOpacity={0.8}
          >
            <Feather name="download-cloud" size={15} color={colors.foreground} />
            <Text style={[styles.syncBtnText, { color: colors.foreground }]}>Restore</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.secTitle, { color: colors.foreground }]}>Stats</Text>
        {stats.map(([label, val]) => (
          <View key={label} style={styles.statRow}>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
            <Text style={[styles.statVal, { color: colors.foreground }]}>{val}</Text>
          </View>
        ))}
      </View>

      {/* Danger */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.destructive + '66' }]}>
        <Text style={[styles.secTitle, { color: colors.destructive }]}>Danger Zone</Text>
        <TouchableOpacity
          style={[styles.deleteBtn, { borderColor: colors.destructive }]}
          onPress={confirmDelete}
          activeOpacity={0.8}
        >
          <Feather name="trash-2" size={15} color={colors.destructive} />
          <Text style={[styles.deleteBtnText, { color: colors.destructive }]}>Delete Project</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 10 },
  secTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  secDesc: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  input: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'Inter_400Regular' },
  textArea: { height: 80, textAlignVertical: 'top' },
  btn: { borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  syncRow: { flexDirection: 'row', gap: 12 },
  syncBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, paddingVertical: 10 },
  syncBtnText: { color: '#fff', fontFamily: 'Inter_500Medium', fontSize: 13 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  statVal: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 8, borderWidth: 1, paddingVertical: 12 },
  deleteBtnText: { fontFamily: 'Inter_500Medium', fontSize: 14 },
});
