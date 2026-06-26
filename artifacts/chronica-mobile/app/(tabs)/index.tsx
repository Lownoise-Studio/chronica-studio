import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal,
  Platform, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useProjects } from '@/context/ProjectsContext';
import { ProjectCard } from '@/components/ProjectCard';
import { EmptyState } from '@/components/EmptyState';
import { Onboarding } from '@/components/Onboarding';
import { Project } from '@/engine/types';
import { navigateToPlay, useLoadGameActions } from '@/hooks/useLoadGameActions';

type Sheet = { kind: 'create' } | { kind: 'rename'; project: Project } | null;

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { projects, createProject, deleteProject, duplicateProject, updateProject, isLoaded, hasOnboarded, setHasOnboarded } = useProjects();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [titleInput, setTitleInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const { loadingGame, loadingDemo, handleLoadGame, handleTryDemo } = useLoadGameActions();

  const onLoadGame = async () => {
    const nav = await handleLoadGame();
    if (nav) navigateToPlay(router, nav);
  };

  const onTryDemo = async () => {
    const nav = await handleTryDemo();
    if (nav) navigateToPlay(router, nav);
  };

  const openCreate = () => { setTitleInput(''); setDescInput(''); setSheet({ kind: 'create' }); };

  const openRename = (p: Project) => { setTitleInput(p.title); setDescInput(p.description); setSheet({ kind: 'rename', project: p }); };

  const handleSubmit = () => {
    if (!titleInput.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (sheet?.kind === 'create') {
      const p = createProject(titleInput.trim(), descInput.trim());
      setSheet(null);
      router.push(`/project/${p.id}` as any);
    } else if (sheet?.kind === 'rename') {
      updateProject(sheet.project.id, { title: titleInput.trim(), description: descInput.trim() });
      setSheet(null);
    }
  };

  const showProjectMenu = (p: Project) => {
    Alert.alert(p.title, 'Choose an action', [
      {
        text: 'Edit Story Info',
        onPress: () => openRename(p),
      },
      {
        text: 'Duplicate',
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          duplicateProject(p.id);
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Delete Story', `Delete "${p.title}"? This cannot be undone.`, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                deleteProject(p.id);
              },
            },
          ]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const sheetTitle = sheet?.kind === 'create' ? 'New Story' : 'Rename Story';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {!hasOnboarded && (
        <Onboarding onDismiss={() => setHasOnboarded(true)} />
      )}

      <View style={[
        styles.header,
        { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16), borderBottomColor: colors.border },
      ]}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Chronica Studio</Text>
          <Text style={[styles.studio, { color: colors.primary }]}>by Lownoise Studio</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.loadBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={onLoadGame}
            disabled={loadingGame}
            activeOpacity={0.8}
          >
            {loadingGame ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Feather name="play-circle" size={16} color={colors.primary} />
                <Text style={[styles.loadBtnText, { color: colors.foreground }]}>Load Game</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={openCreate}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={projects}
        keyExtractor={p => p.id}
        renderItem={({ item }) => (
          <ProjectCard
            project={item}
            onPress={() => router.push(`/project/${item.id}` as any)}
            onLongPress={() => showProjectMenu(item)}
          />
        )}
        contentContainerStyle={[
          styles.list,
          !projects.length && styles.listEmpty,
          { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 16 },
        ]}
        ListHeaderComponent={
          <TouchableOpacity
            style={[styles.demoCard, { backgroundColor: colors.card, borderColor: colors.primary + '44' }]}
            onPress={onTryDemo}
            disabled={loadingDemo || loadingGame}
            activeOpacity={0.85}
          >
            <View style={styles.demoCardHeader}>
              <Feather name="zap" size={18} color={colors.primary} />
              <Text style={[styles.demoTitle, { color: colors.foreground }]}>Try Demo</Text>
              {loadingDemo && <ActivityIndicator size="small" color={colors.primary} />}
            </View>
            <Text style={[styles.demoDesc, { color: colors.mutedForeground }]}>
              Play The Crossroads — a bundled .chronica game with backgrounds and branching paths.
            </Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          isLoaded ? (
            <EmptyState
              icon="book-open"
              title="No stories yet"
              message="Create a new story, or load a .chronica game package to start playing right away."
              actionLabel="New Story"
              onAction={openCreate}
              secondaryActionLabel="Load Game"
              onSecondaryAction={onLoadGame}
            />
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Create / Rename sheet */}
      <Modal visible={!!sheet} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setSheet(null)} activeOpacity={1} />
          <View style={[styles.sheetBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{sheetTitle}</Text>

            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Title</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
              value={titleInput}
              onChangeText={setTitleInput}
              placeholder="My Story"
              placeholderTextColor={colors.mutedForeground}
              autoFocus
              returnKeyType="next"
            />

            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Description (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
              value={descInput}
              onChangeText={setDescInput}
              placeholder="A brief description of your story..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
            />

            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={[styles.sheetBtn, { borderColor: colors.border }]}
                onPress={() => setSheet(null)}
                activeOpacity={0.8}
              >
                <Text style={[styles.sheetBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={handleSubmit}
                disabled={!titleInput.trim()}
                activeOpacity={0.8}
              >
                <Text style={[styles.sheetBtnText, { color: '#fff' }]}>
                  {sheet?.kind === 'create' ? 'Create' : 'Save'}
                </Text>
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
  title: { fontSize: 24, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  studio: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 40,
  },
  loadBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  list: { paddingTop: 12 },
  listEmpty: { flex: 1 },
  demoCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  demoCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  demoTitle: { flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  demoDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheetBox: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: 1, borderBottomWidth: 0,
    padding: 24, paddingTop: 16, gap: 10,
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
