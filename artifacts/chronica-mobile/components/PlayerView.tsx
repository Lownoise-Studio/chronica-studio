import React from 'react';
import {
  Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Choice, ChronicaState, Fragment } from '@/engine/types';
import { HistoryEntry } from '@/runtime';
import { EmptyState } from '@/components/EmptyState';
import {
  BACKGROUND_OVERLAY_OPACITY,
  CONTENT_PANEL_BG,
  getBackgroundOverlayColor,
  getChoiceSurfaceColor,
  getEndCardSurfaceColor,
  getStoryTextColor,
  shouldShowSceneBackground,
} from '@/engine/player-presentation';
import { useSceneAudio } from '@/components/player/useSceneAudio';

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
  history: HistoryEntry[];
  gameState: ChronicaState | null;
  backgroundUri: string | undefined;
  audioUri: string | undefined;
  showLoadedBanner?: boolean;
  onBack: () => void;
  onRestart: () => void;
  onSave: () => void;
  onChoose: (choice: Choice) => void;
  debugPanel?: React.ReactNode;
};

export function PlayerView({
  colors,
  advancedMode,
  fragment: currentFragment,
  visibleChoices,
  history,
  gameState,
  backgroundUri: bgUri,
  audioUri,
  showLoadedBanner = false,
  onBack,
  onRestart,
  onSave,
  onChoose,
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
  const storyTextColor = getStoryTextColor(showBackground, colors.foreground);
  const choiceSurfaceColor = getChoiceSurfaceColor(showBackground, colors.secondary);
  const endCardSurfaceColor = getEndCardSurfaceColor(showBackground, colors.secondary);

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

      <View style={[styles.gameHeader, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16) }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="x" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowHistory(!showHistory)} style={styles.locationRow}>
          <Text style={[styles.locationBadge, { color: colors.primary }]}>
            {advancedMode
              ? (currentFragment?.locationId ?? '—')
              : (currentFragment?.title || currentFragment?.locationId || '—')}
          </Text>
          <Feather name="clock" size={12} color={colors.mutedForeground} />
          <Text style={[styles.historyCount, { color: colors.mutedForeground }]}>{history.length}</Text>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={onRestart} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="rotate-ccw" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onSave} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="save" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {showLoadedBanner && (
        <View style={[styles.loadedBanner, { backgroundColor: colors.primary + 'ee' }]}>
          <Feather name="check-circle" size={14} color="#fff" />
          <Text style={styles.loadedBannerText}>Game loaded</Text>
        </View>
      )}

      {showHistory && history.length > 0 && (
        <View style={[styles.historyPanel, { backgroundColor: colors.card + 'ee', borderColor: colors.border }]}>
          <Text style={[styles.historyLabel, { color: colors.mutedForeground }]}>PATH HISTORY</Text>
          <ScrollView style={{ maxHeight: 120 }} showsVerticalScrollIndicator={false}>
            {history.map((h, i) => (
              <View key={i} style={styles.historyRow}>
                <Text style={[styles.historyNum, { color: colors.mutedForeground }]}>{i + 1}</Text>
                {advancedMode ? (
                  <>
                    <Text style={[styles.historyLoc, { color: colors.primary }]}>{h.locationId}</Text>
                    {h.title && h.title !== h.locationId && (
                      <Text style={[styles.historyTitle, { color: colors.mutedForeground }]}>{h.title}</Text>
                    )}
                  </>
                ) : (
                  <Text style={[styles.historyLoc, { color: colors.primary }]}>
                    {h.title || h.locationId}
                  </Text>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      )}

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
          {currentFragment ? (
            <>
              {currentFragment.title && currentFragment.title !== currentFragment.locationId && (
                <Text style={[styles.fragmentTitle, { color: colors.accent }]}>{currentFragment.title}</Text>
              )}
              <Text style={[styles.fragmentText, { color: storyTextColor }]}>
                {currentFragment.text || '(this scene has no text yet)'}
              </Text>

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
              ) : (
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
              )}

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
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  gameHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationBadge: { fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 1 },
  historyCount: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  headerActions: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  loadedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 8,
    paddingVertical: 10,
    borderRadius: 10,
  },
  loadedBannerText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  historyPanel: {
    marginHorizontal: 20, marginBottom: 8,
    borderRadius: 10, borderWidth: 1, padding: 10,
  },
  historyLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  historyNum: { fontSize: 10, fontFamily: 'Inter_400Regular', width: 18 },
  historyLoc: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  historyTitle: { fontSize: 11, fontFamily: 'Inter_400Regular', flex: 1 },
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
  choiceList: { gap: 10 },
  choiceBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, borderWidth: 1, padding: 14 },
  choiceText: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium' },
  endCard: { alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, padding: 24 },
  endText: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  endSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  restartBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, marginTop: 4 },
  restartBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});
