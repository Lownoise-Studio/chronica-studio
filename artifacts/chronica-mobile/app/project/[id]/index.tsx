import React, { useEffect, useMemo } from 'react';
import {
  Alert, Platform, SectionList, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useProjects } from '@/context/ProjectsContext';
import { FragmentListItem } from '@/components/FragmentListItem';
import { EmptyState } from '@/components/EmptyState';
import { Fragment } from '@/engine/types';

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { getProject, addFragment, deleteFragment } = useProjects();

  const project = getProject(id!);

  useEffect(() => {
    if (project) {
      navigation.setOptions({ title: project.title });
    }
  }, [project?.title]);

  const sections = useMemo(() => {
    if (!project) return [];
    const groups: Record<string, Fragment[]> = {};
    for (const f of project.fragments) {
      const key = f.locationId || '(no location)';
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    }
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, data]) => ({
        title,
        data: [...data].sort((a, b) => b.priority - a.priority),
      }));
  }, [project]);

  if (!project) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState icon="alert-circle" title="Project not found" />
      </View>
    );
  }

  const handleAddFragment = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const f = addFragment(project.id, {
      locationId: 'start',
      priority: 0,
      conditions: [],
      effects: [],
      text: '',
      choices: [],
    });
    router.push(`/project/${project.id}/fragment/${f.uid}` as any);
  };

  const handleDeleteFragment = (uid: string, locId: string) => {
    Alert.alert('Delete Fragment', `Delete fragment at "${locId}"?`, [
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
          <Text style={styles.playBtnText}>Play</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.secondary }]}
          onPress={() => router.push(`/project/${project.id}/assets` as any)}
          activeOpacity={0.8}
        >
          <Feather name="folder" size={18} color={colors.foreground} />
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
          [project.fragments.length, 'Fragments'],
          [new Set(project.fragments.map(f => f.locationId)).size, 'Locations'],
          [project.assets.length, 'Assets'],
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

      {sections.length === 0 ? (
        <EmptyState
          icon="file-text"
          title="No fragments yet"
          message="Add your first fragment to start writing"
          actionLabel="Add Fragment"
          onAction={handleAddFragment}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.uid}
          renderItem={({ item }) => (
            <FragmentListItem
              fragment={item}
              onPress={() => router.push(`/project/${project.id}/fragment/${item.uid}` as any)}
              onDelete={() => handleDeleteFragment(item.uid, item.locationId)}
            />
          )}
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                {section.title}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  playBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    paddingVertical: 10,
  },
  playBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  iconBtn: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statVal: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  statDiv: { width: 1, marginVertical: 4 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
    paddingTop: 16,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
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
