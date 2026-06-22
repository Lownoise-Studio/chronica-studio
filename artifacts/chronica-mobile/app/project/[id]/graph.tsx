import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProjects } from '@/context/ProjectsContext';
import { StoryGraphView } from '@/components/StoryGraphView';
import { EmptyState } from '@/components/EmptyState';
import { useColors } from '@/hooks/useColors';

export default function StoryGraphScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { getProject } = useProjects();

  const project = getProject(id!);

  useEffect(() => {
    navigation.setOptions({ title: 'Story Graph' });
  }, []);

  if (!project) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState icon="alert-circle" title="Story not found" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StoryGraphView
        project={project}
        onNodePress={uid => router.push(`/project/${project.id}/fragment/${uid}` as any)}
        contentPaddingBottom={insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 24}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
