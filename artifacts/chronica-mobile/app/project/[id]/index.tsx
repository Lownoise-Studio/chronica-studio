import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Platform, SectionList, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useProjects } from '@/context/ProjectsContext';
import { useAdvancedMode } from '@/context/AdvancedModeContext';
import { FragmentListItem } from '@/components/FragmentListItem';
import { EmptyState } from '@/components/EmptyState';
import { Fragment } from '@/engine/types';

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { getProject, addFragment, deleteFragment, getValidationErrors } = useProjects();
  const { advancedMode } = useAdvancedMode();
  const [search, setSearch] = useState('');

  const project = getProject(id!);

  useEffect(() => {
    if (project) navigation.setOptions({ title: project.title });
  }, [project?.title]);

  const sections = useMemo(() => {
    if (!project) return [];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? project.fragments.filter(
          f =>
            f.locationId.toLowerCase().includes(q) ||
            f.title.toLowerCase().includes(q) ||
            f.text.toLowerCase().includes(q)
        )
      : project.fragments;
    const groups: Record<string, Fragment[]> = {};
    for (const f of filtered) {
      const key = advancedMode
        ? (f.locationId || '(no id)')
        : (f.locationId || '(no id)');
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    }
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, data]) => ({
        title,
        data: [...data].sort((a, b) => b.priority - a.priority),
      }));
  }, [project, search, advancedMode]);

  const validationErrors = useMemo(() => getValidationErrors(id!), [project]);
  const errorCount = validationErrors.length;

  if (!project) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState icon="alert-circle" title="Story not found" />
      </View>
    );
  }

  const handleAddFragment = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const f = addFragment(project.id, {
      title: '',
      locationId: 'new-scene',
      priority: 0,
      conditions: [],
      effects: [],
      text: '',
      choices: [],
    });
    router.push(`/project/${project.id}/fragment/${f.uid}` as any);
  };

  const handleDeleteFragment = (uid: string, frag: Fragment) => {
    const name = frag.title || frag.locationId;
    Alert.alert('Delete Scene', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          deleteFragment(project.id, uid);
        },
      },
    ]);
  };

  const totalScenes = project.fragments.length;
  const totalPlaces = new Set(project.fragments.map(f => f.locationId)).size;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Action bar */}
      <View style={[styles.bar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.playBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push(`/project/${project.id}/play` as any)}
          activeOpacity={0.8}
        >
          <Feather name="play" size={15} color="#fff" />
          <Text style={styles.playBtnText}>Playtest</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.secondary }]}
          onPress={() => router.push(`/project/${project.id}/assets` as any)}
          activeOpacity={0.8}
        >
          <Feather name="image" size={18} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.secondary }]}
          onPress={() => router.push(`/project/${project.id}/export` as any)}
          activeOpacity={0.8}
        >
          <Feather name="download" size={18} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.secondary }]}
          onPress={() => router.push(`/project/${project.id}/settings` as any)}
          activeOpacity={0.8}
        >
          <Feather name="settings" size={18} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={[styles.stats, { borderBottomColor: colors.border }]}>
        {([
          [totalScenes, 'Scenes'],
          [totalPlaces, advancedMode ? 'Locations' : 'Places'],
          [project.assets.length, advancedMode ? 'Assets' : 'Images'],
        ] as [number, string][]).map(([val, label], i) => (
          <React.Fragment key={label}>
            {i > 0 && <View style={[styles.statDiv, { backgroundColor: colors.border }]} />}
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: colors.foreground }]}>{val}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      {/* Validation warning */}
      {errorCount > 0 && (
        <TouchableOpacity
          style={[styles.warnBanner, { backgroundColor: colors.destructive + '22', borderBottomColor: colors.destructive + '55' }]}
          onPress={() => {
            const msgs = validationErrors.slice(0, 5).map(e => `• ${e.message}`).join('\n');
            Alert.alert(`${errorCount} issue${errorCount > 1 ? 's' : ''} found`, msgs);
          }}
          activeOpacity={0.8}
        >
          <Feather name="alert-triangle" size={13} color={colors.destructive} />
          <Text style={[styles.warnText, { color: colors.destructive }]}>
            {errorCount} issue{errorCount !== 1 ? 's' : ''} — tap to review
          </Text>
        </TouchableOpacity>
      )}

      {/* Search bar */}
      <View style={[styles.searchRow, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search scenes…"
          placeholderTextColor={colors.mutedForeground}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
        {search.length > 0 && Platform.OS !== 'ios' && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {sections.length === 0 ? (
        search.length > 0 ? (
          <EmptyState icon="search" title="No results" message={`No scenes match "${search}"`} />
        ) : (
          <EmptyState
            icon="file-text"
            title="No scenes yet"
            message="Add your first scene to begin your story"
            actionLabel="Add Scene"
            onAction={handleAddFragment}
          />
        )
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.uid}
          renderItem={({ item }) => (
            <FragmentListItem
              fragment={item}
              hasError={validationErrors.some(e => e.fragmentUid === item.uid)}
              onPress={() => router.push(`/project/${project.id}/fragment/${item.uid}` as any)}
              onDelete={() => handleDeleteFragment(item.uid, item)}
            />
          )}
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                {section.title}
              </Text>
              <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>
                {section.data.length}
              </Text>
            </View>
          )}
          contentContainerStyle={{
            paddingTop: 8,
            paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 80,
          }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity
        style={[
          styles.fab,
          { backgroundColor: colors.primary, bottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 20 },
        ]}
        onPress={handleAddFragment}
        activeOpacity={0.8}
      >
        <Feather name="plus" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  playBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 8, paddingVertical: 10,
  },
  playBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  iconBtn: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statVal: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  statDiv: { width: 1, marginVertical: 4 },
  warnBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1,
  },
  warnText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', paddingVertical: 0 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 8, paddingTop: 16,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  sectionTitle: { flex: 1, fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionCount: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  fab: {
    position: 'absolute', right: 20,
    width: 54, height: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
});
