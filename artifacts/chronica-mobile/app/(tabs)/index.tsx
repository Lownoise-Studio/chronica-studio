import React, { useState } from 'react';
import {
  FlatList, KeyboardAvoidingView, Modal, Platform, StyleSheet,
  Text, TextInput, TouchableOpacity, View, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useProjects } from '@/context/ProjectsContext';
import { ProjectCard } from '@/components/ProjectCard';
import { EmptyState } from '@/components/EmptyState';

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { projects, createProject, deleteProject, isLoaded } = useProjects();
  const [modal, setModal] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');

  const handleCreate = () => {
    if (!title.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    createProject(title.trim(), desc.trim());
    setTitle('');
    setDesc('');
    setModal(false);
  };

  const confirmDelete = (id: string, name: string) => {
    Alert.alert('Delete Project', `Delete "${name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          deleteProject(id);
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[
        styles.header,
        {
          paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16),
          borderBottomColor: colors.border,
        },
      ]}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Chronica</Text>
          <Text style={[styles.studio, { color: colors.primary }]}>by Lownoise Studio</Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setModal(true)}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={projects}
        keyExtractor={p => p.id}
        renderItem={({ item }) => (
          <ProjectCard
            project={item}
            onPress={() => router.push(`/project/${item.id}` as any)}
            onLongPress={() => confirmDelete(item.id, item.title)}
          />
        )}
        contentContainerStyle={[
          styles.list,
          !projects.length && styles.listEmpty,
          { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 16 },
        ]}
        ListEmptyComponent={
          isLoaded ? (
            <EmptyState
              icon="book-open"
              title="No projects yet"
              message="Create your first narrative game to get started"
              actionLabel="New Project"
              onAction={() => setModal(true)}
            />
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setModal(false)} activeOpacity={1} />
          <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>New Project</Text>

            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Title</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
              value={title}
              onChangeText={setTitle}
              placeholder="My Narrative Game"
              placeholderTextColor={colors.mutedForeground}
              autoFocus
            />

            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Description (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
              value={desc}
              onChangeText={setDesc}
              placeholder="A brief description of your story..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
            />

            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={[styles.sheetBtn, { borderColor: colors.border }]}
                onPress={() => setModal(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.sheetBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={handleCreate}
                activeOpacity={0.8}
              >
                <Text style={[styles.sheetBtnText, { color: '#fff' }]}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  studio: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  list: { paddingTop: 12 },
  listEmpty: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 24,
    paddingTop: 16,
    gap: 10,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  sheetTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  inputLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  input: { borderRadius: 8, borderWidth: 1, padding: 12, fontSize: 15, fontFamily: 'Inter_400Regular' },
  textArea: { height: 80, textAlignVertical: 'top' },
  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 6 },
  sheetBtn: { flex: 1, borderRadius: 8, borderWidth: 1, paddingVertical: 13, alignItems: 'center' },
  sheetBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
