import React from 'react';
import {
  Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Choice, ChronicaState, Fragment, SceneHotspot } from '@/engine/types';
import { HistoryEntry } from '@/runtime';
import { EmptyState } from '@/components/EmptyState';
import { DialogueBubble } from '@/components/DialogueBubble';
import { SceneHotspotOverlay } from '@/components/player/SceneHotspotOverlay';
import { SceneStageActors } from '@/components/player/SceneStageActors';
import { getHotspotDisplayLabel } from '@/engine/hotspot-helpers';
import type { StageActorPresentation } from '@/engine/stage-actors';
import {
  ADVENTURE_SHEET_FLEX,
  ADVENTURE_STAGE_FLEX,
  BACKGROUND_OVERLAY_OPACITY,
  CONTENT_PANEL_BG,
  getBackgroundOverlayColor,
  getChoiceSurfaceColor,
  getDialogueBubbleVariant,
  getEndCardSurfaceColor,
  getStoryTextColor,
  shouldShowHotspotAccessibilityList,
  shouldShowHotspotGuidancePulse,
  shouldShowSceneBackground,
} from '@/engine/player-presentation';
import { useSceneAudio } from '@/components/player/useSceneAudio';
import type { DialoguePresentation } from '@/engine/dialogue-presentation';

export type PlayerViewColors = {
  background: string;
  foreground: string;
  primary: string;
  secondary: string;
  mutedForeground: string;
  accent: string;
  border: string;
  card: string;
};

export type PlayerViewProps = {
  colors: PlayerViewColors;
  advancedMode: boolean;
  fragment: Fragment | null;
  visibleChoices: Choice[];
  visibleHotspots?: SceneHotspot[];
  stageActors?: StageActorPresentation[];
  history: HistoryEntry[];
  gameState: ChronicaState | null;
  backgroundUri: string | undefined;
  audioUri: string | undefined;
  onBack: () => void;
  onRestart: () => void;
  onSave: () => void;
  onChoose: (choice: Choice) => void;
  onActivateHotspot?: (hotspot: SceneHotspot) => void;
  dialogue?: DialoguePresentation | null;
  onAdvanceDialogue?: () => void;
  debugPanel?: React.ReactNode;
};

export function PlayerView({
  colors,
  advancedMode,
  fragment: currentFragment,
  visibleChoices,
  visibleHotspots = [],
  stageActors = [],
  history,
  gameState,
  backgroundUri: bgUri,
  audioUri,
  onBack,
  onRestart,
  onSave,
  onChoose,
  onActivateHotspot,
  dialogue,
  onAdvanceDialogue,
  debugPanel,
}: PlayerViewProps) {
  const insets = useSafeAreaInsets();
  const [showHistory, setShowHistory] = React.useState(false);
  const [bgLoadFailed, setBgLoadFailed] = React.useState(false);

  React.useEffect(() => {
    setBgLoadFailed(false);
  }, [currentFragment?.uid, bgUri]);

  useSceneAudio(audioUri, currentFragment?.uid);

  const showBackground = shouldShowSceneBackground(bgUri, bgLoadFailed);
  const hasStageContent = (currentFragment?.hotspots?.length ?? 0) > 0
    || (currentFragment?.stageActors?.length ?? 0) > 0
    || stageActors.length > 0;
  const useAdventureLayout = showBackground && hasStageContent;
  const storyTextColor = getStoryTextColor(showBackground && !useAdventureLayout, colors.foreground);
  const choiceSurfaceColor = getChoiceSurfaceColor(showBackground && !useAdventureLayout, colors.secondary);
  const endCardSurfaceColor = getEndCardSurfaceColor(showBackground && !useAdventureLayout, colors.secondary);
  const dialogueDone = !dialogue || dialogue.exhausted;
  const showHotspotList = shouldShowHotspotAccessibilityList(
    advancedMode,
    useAdventureLayout,
    dialogueDone,
    visibleHotspots.length,
  );
  const showHotspotGuidance = shouldShowHotspotGuidancePulse(
    advancedMode,
    dialogueDone,
    visibleHotspots.length,
  );
  const dialogueVariant = dialogue
    ? getDialogueBubbleVariant(useAdventureLayout, dialogue.isNarration)
    : 'card';

  const headerTop = insets.top + (Platform.OS === 'web' ? 67 : 12);

  const header = (
    <View style={[
      styles.gameHeader,
      useAdventureLayout && styles.gameHeaderOverlay,
      { paddingTop: headerTop },
    ]}>
      <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Feather name="x" size={20} color={useAdventureLayout ? '#f0eef8' : colors.mutedForeground} />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setShowHistory(!showHistory)} style={styles.locationRow}>
        <Text style={[
          styles.locationBadge,
          { color: useAdventureLayout ? '#f0eef8' : colors.primary },
        ]}>
          {advancedMode
            ? (currentFragment?.locationId ?? '—')
            : (currentFragment?.title || currentFragment?.locationId || '—')}
        </Text>
        {!useAdventureLayout && (
          <>
            <Feather name="clock" size={12} color={colors.mutedForeground} />
            <Text style={[styles.historyCount, { color: colors.mutedForeground }]}>{history.length}</Text>
          </>
        )}
      </TouchableOpacity>
      <View style={styles.headerActions}>
        <TouchableOpacity onPress={onRestart} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="rotate-ccw" size={18} color={useAdventureLayout ? '#d8d4e8' : colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onSave} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="save" size={18} color={useAdventureLayout ? '#d8d4e8' : colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const historyPanel = showHistory && history.length > 0 ? (
    <View style={[
      styles.historyPanel,
      useAdventureLayout && styles.historyPanelOverlay,
      { backgroundColor: colors.card + 'ee', borderColor: colors.border },
    ]}>
      <Text style={[styles.historyLabel, { color: colors.mutedForeground }]}>PATH HISTORY</Text>
      <ScrollView style={{ maxHeight: 120 }} showsVerticalScrollIndicator={false}>
        {history.map((h, i) => (
          <View key={i} style={styles.historyRow}>
            <Text style={[styles.historyNum, { color: colors.mutedForeground }]}>{i + 1}</Text>
            <Text style={[styles.historyLoc, { color: colors.primary }]}>
              {advancedMode ? h.locationId : (h.title || h.locationId)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  ) : null;

  const storyBody = (
    <>
      {currentFragment ? (
        <>
          {!useAdventureLayout && currentFragment.title && currentFragment.title !== currentFragment.locationId && (
            <Text style={[styles.fragmentTitle, { color: colors.accent }]}>{currentFragment.title}</Text>
          )}
          {dialogue ? (
            <DialogueBubble
              dialogue={dialogue}
              variant={dialogueVariant}
              colors={colors}
              onAdvance={onAdvanceDialogue}
            />
          ) : (
            <Text style={[styles.fragmentText, { color: useAdventureLayout ? colors.foreground : storyTextColor }]}>
              {currentFragment.text || '(this scene has no text yet)'}
            </Text>
          )}

          {showHotspotList && onActivateHotspot && (
            <View style={styles.hotspotChipList}>
              <Text style={[styles.hotspotHint, { color: colors.mutedForeground }]}>
                Accessibility — tap a labeled action:
              </Text>
              {visibleHotspots.map((hotspot, i) => (
                <TouchableOpacity
                  key={hotspot.uid}
                  style={[styles.hotspotChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                  onPress={() => onActivateHotspot(hotspot)}
                  activeOpacity={0.8}
                >
                  <Feather name="crosshair" size={14} color={colors.primary} />
                  <Text style={[styles.hotspotChipText, { color: colors.foreground }]}>
                    {getHotspotDisplayLabel(hotspot, i + 1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {visibleChoices.length > 0 ? (
            <View style={styles.choiceList}>
              {visibleChoices.map(choice => (
                <TouchableOpacity
                  key={choice.uid}
                  style={[
                    styles.choiceBtn,
                    {
                      backgroundColor: choiceSurfaceColor,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => onChoose(choice)}
                  activeOpacity={0.8}
                >
                  <Feather name="chevron-right" size={14} color={colors.primary} />
                  <Text style={[styles.choiceText, { color: colors.foreground }]}>
                    {choice.label || '(unlabeled)'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : dialogueDone && visibleHotspots.length === 0 ? (
            <View
              style={[
                styles.endCard,
                {
                  backgroundColor: endCardSurfaceColor,
                  borderColor: colors.border,
                },
              ]}
            >
              <Feather name="flag" size={20} color={colors.primary} />
              <Text style={[styles.endText, { color: colors.mutedForeground }]}>End of this path</Text>
              <Text style={[styles.endSub, { color: colors.mutedForeground }]}>
                Visited {history.length} scene{history.length !== 1 ? 's' : ''}
              </Text>
              <TouchableOpacity
                style={[styles.restartBtn, { backgroundColor: colors.primary }]}
                onPress={onRestart}
              >
                <Text style={styles.restartBtnText}>Restart</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {debugPanel}
        </>
      ) : (
        <EmptyState
          icon="alert-circle"
          title="Scene not found"
          message={
            advancedMode
              ? `No fragment matches location "${gameState?.location}"`
              : 'No scene found. Check that your starting scene is set up correctly.'
          }
        />
      )}
    </>
  );

  if (useAdventureLayout && bgUri) {
    return (
      <View style={[styles.fill, { backgroundColor: colors.background }]}>
        <View style={styles.adventureRoot}>
          <View style={[styles.adventureStage, { flex: ADVENTURE_STAGE_FLEX }]}>
            <Image
              key={`${currentFragment?.uid ?? 'scene'}:${bgUri}`}
              source={{ uri: bgUri }}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              onError={() => setBgLoadFailed(true)}
            />
            <View pointerEvents="none" style={styles.adventureStageScrim} />
            {stageActors.length > 0 && (
              <SceneStageActors actors={stageActors} />
            )}
            {visibleHotspots.length > 0 && onActivateHotspot && (
              <SceneHotspotOverlay
                hotspots={visibleHotspots}
                onActivate={onActivateHotspot}
                showGuidance={showHotspotGuidance}
              />
            )}
            <View style={styles.adventureHeaderStack} pointerEvents="box-none">
              {header}
              {historyPanel}
            </View>
          </View>

          <ScrollView
            style={[styles.adventureSheet, { flex: ADVENTURE_SHEET_FLEX, backgroundColor: colors.background }]}
            contentContainerStyle={[
              styles.adventureSheetContent,
              { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 12 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.adventurePanel}>
              {storyBody}
            </View>
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      {showBackground ? (
        <Image
          key={`${currentFragment?.uid ?? 'scene'}:${bgUri}`}
          source={{ uri: bgUri }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          onError={() => setBgLoadFailed(true)}
        />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.background }]} />
      )}
      {showBackground && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: getBackgroundOverlayColor(BACKGROUND_OVERLAY_OPACITY) },
          ]}
        />
      )}

      {header}
      {historyPanel}

      <ScrollView
        style={styles.fill}
        contentContainerStyle={[
          showBackground ? styles.gameContentWithBg : styles.gameContent,
          { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={
            showBackground
              ? [styles.readingPanel, { backgroundColor: CONTENT_PANEL_BG, borderColor: colors.border }]
              : styles.readingPanelPlain
          }
        >
          {storyBody}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  adventureRoot: { flex: 1 },
  adventureStage: {
    overflow: 'hidden',
    backgroundColor: '#0a0a0f',
  },
  adventureStageScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  adventureHeaderStack: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  gameHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10,
  },
  gameHeaderOverlay: {
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationBadge: { fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 1 },
  historyCount: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  headerActions: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  historyPanel: {
    marginHorizontal: 16, marginBottom: 8,
    borderRadius: 10, borderWidth: 1, padding: 10,
  },
  historyPanelOverlay: {
    marginTop: 4,
  },
  historyLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  historyNum: { fontSize: 10, fontFamily: 'Inter_400Regular', width: 18 },
  historyLoc: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  adventureSheet: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  adventureSheetContent: { paddingHorizontal: 16, paddingTop: 12 },
  adventurePanel: { gap: 14 },
  gameContent: { padding: 24, gap: 20 },
  gameContentWithBg: { paddingHorizontal: 14, paddingTop: 8, gap: 0 },
  readingPanel: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    gap: 20,
  },
  readingPanelPlain: { gap: 20 },
  fragmentTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5 },
  fragmentText: { fontSize: 17, fontFamily: 'Inter_400Regular', lineHeight: 28 },
  hotspotChipList: { gap: 8 },
  hotspotHint: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  hotspotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  hotspotChipText: { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  choiceList: { gap: 10 },
  choiceBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, borderWidth: 1, padding: 14 },
  choiceText: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium' },
  endCard: { alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, padding: 24 },
  endText: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  endSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  restartBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, marginTop: 4 },
  restartBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});
