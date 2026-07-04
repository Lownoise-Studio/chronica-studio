import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { buildSceneInspectorSections } from '@/engine/stage-authoring';
import { getHotspotForObject, getObjectForHotspot, resolveStageObjectHotspotRef } from '@/engine/stage-presentation';
import type { Fragment, Project } from '@/engine/types';

export function SceneInspectorPanel({
  fragment,
  project,
  focusedStageObjectUid,
  focusedHotspotUid,
  linkedHotspotLabel,
  linkedStageObjectLabel,
}: {
  fragment: Fragment;
  project: Pick<Project, 'inventory' | 'objectives' | 'worldState' | 'npcProfiles' | 'gameplayVariables'>;
  focusedStageObjectUid?: string | null;
  focusedHotspotUid?: string | null;
  linkedHotspotLabel?: string;
  linkedStageObjectLabel?: string;
}) {
  const colors = useColors();
  const sections = useMemo(() => buildSceneInspectorSections(fragment, project), [fragment, project]);

  const focusedObject = focusedStageObjectUid
    ? fragment.stageAuthoring?.objects.find(o => o.uid === focusedStageObjectUid)
    : undefined;
  const focusedHotspot = focusedHotspotUid
    ? fragment.hotspots?.find(h => h.uid === focusedHotspotUid)
    : undefined;
  const resolvedHotspotLabel = linkedHotspotLabel
    ?? (focusedObject ? getHotspotForObject(focusedObject, fragment.hotspots ?? [])?.label : undefined);
  const resolvedObjectLabel = linkedStageObjectLabel
    ?? (focusedHotspotUid ? getObjectForHotspot(fragment.stageAuthoring, focusedHotspotUid)?.label : undefined);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>Scene inspector</Text>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        Overview of visual objects, gameplay elements, and catalog references in this scene.
      </Text>
      {(focusedObject || focusedHotspot) && (
        <View style={[styles.linkCard, { borderColor: colors.border, backgroundColor: colors.muted }]}>
          {focusedObject && (
            <Text style={[styles.item, { color: colors.foreground }]}>
              Selected object: {focusedObject.label || focusedObject.asset}
              {resolveStageObjectHotspotRef(focusedObject) && resolvedHotspotLabel
                ? ` → hotspot "${resolvedHotspotLabel}"`
                : ''}
            </Text>
          )}
          {focusedHotspot && (
            <Text style={[styles.item, { color: colors.foreground }]}>
              Selected hotspot: {focusedHotspot.label || focusedHotspot.uid}
              {resolvedObjectLabel ? ` → stage object "${resolvedObjectLabel}"` : ''}
            </Text>
          )}
        </View>
      )}
      {sections.map(section => (
        <View key={section.title} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{section.title}</Text>
          {section.items.map(item => (
            <Text key={`${section.title}-${item}`} style={[styles.item, { color: colors.foreground }]}>• {item}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 10 },
  linkCard: { borderWidth: 1, borderRadius: 8, padding: 8, gap: 4 },
  title: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  hint: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  section: { gap: 2 },
  sectionTitle: { fontSize: 10, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.6 },
  item: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
});
