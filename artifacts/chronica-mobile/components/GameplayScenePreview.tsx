import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { getSceneGameplayPreview } from '@/engine/gameplay-feedback';
import type { Fragment, Project } from '@/engine/types';

export function GameplayScenePreview({
  project,
  fragment,
}: {
  project: Pick<Project, 'inventory' | 'objectives' | 'worldState'>;
  fragment: Fragment;
}) {
  const colors = useColors();
  const preview = getSceneGameplayPreview(fragment, project);
  const hasAny = preview.inventory.length > 0 || preview.objectives.length > 0 || preview.worldState.length > 0;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>Scene gameplay preview</Text>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        Catalog entries referenced in this scene&apos;s conditions, effects, and actions.
      </Text>

      {!hasAny ? (
        <Text style={[styles.empty, { color: colors.mutedForeground }]}>No gameplay catalog references in this scene yet.</Text>
      ) : (
        <>
          <PreviewSection label="Inventory" items={preview.inventory.map(i => i.label)} colors={colors} />
          <PreviewSection label="Objectives" items={preview.objectives.map(o => o.title)} colors={colors} />
          <PreviewSection label="World flags" items={preview.worldState.map(w => w.label)} colors={colors} />
        </>
      )}
    </View>
  );
}

function PreviewSection({
  label,
  items,
  colors,
}: {
  label: string;
  items: string[];
  colors: ReturnType<typeof useColors>;
}) {
  if (!items.length) return null;
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{label}</Text>
      {items.map(item => (
        <Text key={item} style={[styles.item, { color: colors.foreground }]}>• {item}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 8 },
  title: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  hint: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  empty: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  section: { gap: 2 },
  sectionLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.6 },
  item: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
