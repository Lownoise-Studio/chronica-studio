import React, { useMemo } from 'react';
import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAdvancedMode } from '@/context/AdvancedModeContext';
import { Fragment, Project } from '@/engine/types';
import {
  buildStoryGraph,
  getOutgoingEdges,
  groupGraphNodes,
  resolveLocationTitle,
  type StoryGraphEdge,
  type StoryGraphNode,
} from '@/engine/story-graph';

function EdgeRow({ edge, destinationTitle }: { edge: StoryGraphEdge; destinationTitle: string }) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.edgeRow,
        {
          backgroundColor: edge.broken ? colors.destructive + '14' : colors.muted,
          borderColor: edge.broken ? colors.destructive + '66' : colors.border,
        },
      ]}
    >
      <Feather
        name={edge.broken ? 'alert-circle' : 'arrow-right'}
        size={12}
        color={edge.broken ? colors.destructive : colors.primary}
      />
      <View style={styles.edgeBody}>
        <Text
          style={[styles.edgeDest, { color: edge.broken ? colors.destructive : colors.foreground }]}
          numberOfLines={1}
        >
          {edge.broken ? `Missing: ${edge.toLocationId}` : destinationTitle}
        </Text>
        <Text style={[styles.edgeChoice, { color: colors.mutedForeground }]} numberOfLines={1}>
          via "{edge.choiceLabel}"
        </Text>
      </View>
      {edge.hasChoiceConditions && (
        <View style={[styles.edgeBadge, { backgroundColor: colors.secondary }]}>
          <Feather name="filter" size={10} color={colors.mutedForeground} />
        </View>
      )}
    </View>
  );
}

function GraphNodeCard({
  node,
  edges,
  fragments,
  onPress,
}: {
  node: StoryGraphNode;
  edges: StoryGraphEdge[];
  fragments: Fragment[];
  onPress: () => void;
}) {
  const colors = useColors();
  const { advancedMode } = useAdvancedMode();
  const outgoing = getOutgoingEdges(edges, node.fragmentUid);

  return (
    <TouchableOpacity
      style={[
        styles.nodeCard,
        {
          backgroundColor: colors.card,
          borderColor: node.hasBrokenOutgoing
            ? colors.destructive + '88'
            : node.isStart
              ? colors.primary + '66'
              : colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.nodeHeader}>
        <Text style={[styles.nodeTitle, { color: colors.foreground }]} numberOfLines={2}>
          {node.title}
        </Text>
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </View>

      {advancedMode && (
        <Text style={[styles.nodeId, { color: colors.mutedForeground }]} numberOfLines={1}>
          {node.locationId}
        </Text>
      )}

      <View style={styles.badgeRow}>
        {node.isStart && (
          <View style={[styles.badge, { backgroundColor: colors.primary + '22' }]}>
            <Feather name="flag" size={10} color={colors.primary} />
            <Text style={[styles.badgeText, { color: colors.primary }]}>Start</Text>
          </View>
        )}
        {node.hasUnlockRequirements && (
          <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
            <Feather name="lock" size={10} color={colors.accent} />
            <Text style={[styles.badgeText, { color: colors.accent }]}>
              {node.unlockCount} unlock req{node.unlockCount !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
        {node.incomingCount === 0 && !node.isStart && (
          <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
            <Feather name="git-branch" size={10} color={colors.mutedForeground} />
            <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>No incoming</Text>
          </View>
        )}
        {node.hasBrokenOutgoing && (
          <View style={[styles.badge, { backgroundColor: colors.destructive + '22' }]}>
            <Feather name="alert-triangle" size={10} color={colors.destructive} />
            <Text style={[styles.badgeText, { color: colors.destructive }]}>Broken link</Text>
          </View>
        )}
      </View>

      {outgoing.length > 0 ? (
        <View style={styles.edgeList}>
          {outgoing.map(edge => (
            <EdgeRow
              key={edge.id}
              edge={edge}
              destinationTitle={resolveLocationTitle(fragments, edge.toLocationId)}
            />
          ))}
        </View>
      ) : (
        <Text style={[styles.noEdges, { color: colors.mutedForeground }]}>No choices yet</Text>
      )}
    </TouchableOpacity>
  );
}

export function StoryGraphView({
  project,
  onNodePress,
  contentPaddingBottom = 24,
}: {
  project: Project;
  onNodePress: (fragmentUid: string) => void;
  contentPaddingBottom?: number;
}) {
  const colors = useColors();
  const graph = useMemo(() => buildStoryGraph(project), [project]);
  const sections = useMemo(() => groupGraphNodes(graph.nodes), [graph.nodes]);

  const brokenCount = graph.edges.filter(e => e.broken).length;
  const lockedCount = graph.nodes.filter(n => n.hasUnlockRequirements).length;

  if (project.fragments.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.background }]}>
        <Feather name="git-merge" size={32} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No scenes to map</Text>
        <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
          Add scenes to see how your story connects.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: contentPaddingBottom }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.legend, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.legendTitle, { color: colors.foreground }]}>Story map</Text>
        <Text style={[styles.legendHint, { color: colors.mutedForeground }]}>
          Read-only view — tap a scene to edit it.
        </Text>
        <View style={styles.legendRow}>
          <Text style={[styles.legendStat, { color: colors.mutedForeground }]}>
            {graph.nodes.length} scene{graph.nodes.length !== 1 ? 's' : ''}
          </Text>
          <Text style={[styles.legendStat, { color: colors.mutedForeground }]}>
            {graph.edges.length} link{graph.edges.length !== 1 ? 's' : ''}
          </Text>
          {lockedCount > 0 && (
            <Text style={[styles.legendStat, { color: colors.accent }]}>
              {lockedCount} locked
            </Text>
          )}
          {brokenCount > 0 && (
            <Text style={[styles.legendStat, { color: colors.destructive }]}>
              {brokenCount} broken
            </Text>
          )}
        </View>
      </View>

      {sections.map(section => (
        <View key={section.title} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            {section.title}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sectionRow}
          >
            {section.nodes.map(node => (
              <GraphNodeCard
                key={node.fragmentUid}
                node={node}
                edges={graph.edges}
                fragments={project.fragments}
                onPress={() => onNodePress(node.fragmentUid)}
              />
            ))}
          </ScrollView>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 20 },
  legend: { borderRadius: 10, borderWidth: 1, padding: 14, gap: 6 },
  legendTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  legendHint: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  legendStat: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  section: { gap: 10 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 4,
  },
  sectionRow: { gap: 12, paddingVertical: 2 },
  nodeCard: {
    width: 260,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  nodeHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  nodeTitle: { flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold', lineHeight: 20 },
  nodeId: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeText: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  edgeList: { gap: 6, marginTop: 2 },
  edgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  edgeBody: { flex: 1, gap: 1 },
  edgeDest: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  edgeChoice: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  edgeBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noEdges: { fontSize: 11, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  emptyHint: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
