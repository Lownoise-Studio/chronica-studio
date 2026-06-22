import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Project } from '@/engine/types';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ProjectCard({
  project,
  onPress,
  onLongPress,
}: {
  project: Project;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const colors = useColors();
  const locs = new Set(project.fragments.map(f => f.locationId)).size;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.8}
    >
      <View style={[styles.accent, { backgroundColor: colors.primary }]} />
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
          {project.title}
        </Text>
        {!!project.description && (
          <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={2}>
            {project.description}
          </Text>
        )}
        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <Feather name="file-text" size={11} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {project.fragments.length} fragment{project.fragments.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="map-pin" size={11} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {locs} location{locs !== 1 ? 's' : ''}
            </Text>
          </View>
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {timeAgo(project.updatedAt)}
          </Text>
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 5,
    overflow: 'hidden',
  },
  accent: { width: 3, alignSelf: 'stretch' },
  body: { flex: 1, padding: 14, gap: 4 },
  title: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  desc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
});
