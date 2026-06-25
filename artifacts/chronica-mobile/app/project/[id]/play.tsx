import React, { useState, useEffect, useRef } from 'react';
import {
  Alert, Platform, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useProjects } from '@/context/ProjectsContext';
import { useAdvancedMode } from '@/context/AdvancedModeContext';
import { useChronicaRuntime } from '@/hooks/useChronicaRuntime';
import { DebugPanel } from '@/components/DebugPanel';
import { EmptyState } from '@/components/EmptyState';
import { Choice } from '@/engine';
import { loadRuntimeSave, persistRuntimeSave } from '@/runtime';
import {
  BACKGROUND_OVERLAY_OPACITY,
  CONTENT_PANEL_BG,
  getBackgroundOverlayColor,
  getChoiceSurfaceColor,
  getEndCardSurfaceColor,
  getStoryTextColor,
  shouldShowSceneBackground,
} from '@/engine/player-presentation';

async function playAudioFromUri(uri: string): Promise<{ unload: () => void } | null> {
  try {
    const { Audio } = await import('expo-av');
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { isLooping: true, shouldPlay: true },
    );
    return { unload: () => sound.unloadAsync().catch(() => {}) };
  } catch {
    return null;
  }
}

export default function PlayScreen() {
  const { id: projectId, loaded } = useLocalSearchParams<{ id: string; loaded?: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getProject } = useProjects();
  const { advancedMode } = useAdvancedMode();

  const project = getProject(projectId!);
  const {
    compileOk,
    compileDiagnostics,
    started,
    state: gameState,
    fragment: currentFragment,
    visibleChoices,
    history,
    backgroundUri: bgUri,
    audioUri,
    start,
    resume,
    choose,
    setRuntimeState,
    toSave,
  } = useChronicaRuntime(project);

  const [showHistory, setShowHistory] = useState(false);
  const [showLoadedBanner, setShowLoadedBanner] = useState(loaded === '1');
  const [bgLoadFailed, setBgLoadFailed] = useState(false);
  const audioHandleRef = useRef<{ unload: () => void } | null>(null);

  useEffect(() => {
    setBgLoadFailed(false);
  }, [currentFragment?.uid, bgUri]);

  useEffect(() => {
    if (audioHandleRef.current) {
      audioHandleRef.current.unload();
      audioHandleRef.current = null;
    }
    if (audioUri) {
      playAudioFromUri(audioUri).then(h => { audioHandleRef.current = h; });
    }
    return () => {
      audioHandleRef.current?.unload();
      audioHandleRef.current = null;
    };
  }, [currentFragment?.uid, audioUri]);

  useEffect(() => {
    if (loaded !== '1' || started || !project?.fragments.length) return;
    start();
  }, [loaded, started, project, start]);

  useEffect(() => {
    if (!showLoadedBanner) return;
    const timer = setTimeout(() => setShowLoadedBanner(false), 3000);
    return () => clearTimeout(timer);
  }, [showLoadedBanner]);

  const resetGame = () => {
    Alert.alert('Restart', 'Start the story over from the beginning?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restart', onPress: start },
    ]);
  };

  const loadSave = async () => {
    const save = await loadRuntimeSave(projectId!);
    if (!save) {
      Alert.alert('No Save Found', 'Start a new playtest first.');
      return;
    }
    if (!resume(save)) {
      Alert.alert('Error', 'Could not load save.');
    }
  };

  const saveGame = async () => {
    const payload = toSave(projectId!);
    if (!payload) return;
    await persistRuntimeSave(payload);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Saved', 'Progress saved.');
  };

  const handleChoice = (choice: Choice) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = choose(choice);
    if (!result.ok && result.reason === 'dead-end') {
      Alert.alert(
        'Dead End',
        advancedMode
          ? 'No fragment found for this destination.\nCheck your location IDs and conditions.'
          : 'This choice has no destination yet. Check the scene link.',
      );
    }
  };

  const showBackground = shouldShowSceneBackground(bgUri, bgLoadFailed);
  const storyTextColor = getStoryTextColor(showBackground, colors.foreground);
  const choiceSurfaceColor = getChoiceSurfaceColor(showBackground, colors.secondary);
  const endCardSurfaceColor = getEndCardSurfaceColor(showBackground, colors.secondary);

  if (!project) {
    return (
      <View style={[styles.fill, { backgroundColor: colors.background }]}>
        <EmptyState icon="alert-circle" title="Project not found" />
      </View>
    );
  }

  if (!compileOk) {
    return (
      <View style={[styles.fill, { backgroundColor: colors.background }]}>
        <TouchableOpacity style={[styles.closeBtn, { top: insets.top + 16 }]} onPress={() => router.back()}>
          <Feather name="x" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
        <EmptyState
          icon="alert-triangle"
          title="Cannot play this project"
          message={`Fix ${compileDiagnostics.length} issue${compileDiagnostics.length !== 1 ? 's' : ''} in the editor before playtesting.\n\n${compileDiagnostics.slice(0, 3).map(e => `• ${e.message}`).join('\n')}`}
        />
      </View>
    );
  }

  if (!started) {
    return (
      <View style={[styles.fill, styles.startScreen, { backgroundColor: colors.background }]}>
        <TouchableOpacity style={[styles.closeBtn, { top: insets.top + 16 }]} onPress={() => router.back()}>
          <Feather name="x" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
        <Feather name="play-circle" size={56} color={colors.primary} />
        <Text style={[styles.projectTitle, { color: colors.foreground }]}>{project.title}</Text>
        {!!project.description && (
          <Text style={[styles.projectDesc, { color: colors.mutedForeground }]}>{project.description}</Text>
        )}
        <Text style={[styles.modeBadge, { color: colors.accent }]}>Playtest Mode</Text>
        {project.fragments.length === 0 ? (
          <Text style={[styles.noFrags, { color: colors.destructive }]}>
            Add scenes to your project before playtesting
          </Text>
        ) : (
          <View style={styles.startBtns}>
            <TouchableOpacity style={[styles.startBtn, { backgroundColor: colors.primary }]} onPress={start} activeOpacity={0.8}>
              <Feather name="play" size={17} color="#fff" />
              <Text style={styles.startBtnText}>Start Playtest</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.startBtn, { backgroundColor: colors.secondary }]} onPress={loadSave} activeOpacity={0.8}>
              <Feather name="download" size={17} color={colors.foreground} />
              <Text style={[styles.startBtnText, { color: colors.foreground }]}>Resume</Text>
            </TouchableOpacity>
          </View>
        )}
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

      <View style={[styles.gameHeader, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16) }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
          <TouchableOpacity onPress={resetGame} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="rotate-ccw" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={saveGame} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
                    onPress={() => handleChoice(choice)}
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
                <TouchableOpacity style={[styles.restartBtn, { backgroundColor: colors.primary }]} onPress={start}>
                  <Text style={styles.restartBtnText}>Restart</Text>
                </TouchableOpacity>
              </View>
            )}

            {advancedMode && gameState && currentFragment && (
              <View style={{ marginTop: 8 }}>
                <DebugPanel
                  state={gameState}
                  onStateChange={updated => {
                    setRuntimeState(updated);
                  }}
                />
              </View>
            )}
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
  startScreen: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  closeBtn: { position: 'absolute', right: 20 },
  projectTitle: { fontSize: 26, fontFamily: 'Inter_700Bold', textAlign: 'center', letterSpacing: -0.5 },
  projectDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  modeBadge: { fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 1 },
  noFrags: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  startBtns: { gap: 12, width: '100%', marginTop: 8 },
  startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14 },
  startBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 16 },
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
