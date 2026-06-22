import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Alert, ImageBackground, Platform, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useProjects } from '@/context/ProjectsContext';
import { useAdvancedMode } from '@/context/AdvancedModeContext';
import { DebugPanel } from '@/components/DebugPanel';
import { EmptyState } from '@/components/EmptyState';
import {
  Fragment, Choice, ChronicaState,
  startSession, choose as engineChoose,
  serializeState, deserializeState, getVisibleChoices,
  getActiveFragment,
} from '@/engine';

type HistoryEntry = { locationId: string; title: string };

async function playAudioFromUri(uri: string): Promise<{ unload: () => void } | null> {
  try {
    const { Audio } = await import('expo-av');
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { isLooping: true, shouldPlay: true }
    );
    return { unload: () => sound.unloadAsync().catch(() => {}) };
  } catch { return null; }
}

export default function PlayScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getProject } = useProjects();
  const { advancedMode } = useAdvancedMode();

  const project = getProject(projectId!);
  const [gameState, setGameState] = useState<ChronicaState | null>(null);
  const [currentFragment, setCurrentFragment] = useState<Fragment | null>(null);
  const [visibleChoices, setVisibleChoices] = useState<Choice[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [started, setStarted] = useState(false);
  const audioHandleRef = useRef<{ unload: () => void } | null>(null);

  const getAssetUri = useCallback(
    (name?: string) => name ? project?.assets.find(a => a.name === name)?.uri : undefined,
    [project]
  );

  useEffect(() => {
    const uri = getAssetUri(currentFragment?.backgroundAudio);
    if (audioHandleRef.current) {
      audioHandleRef.current.unload();
      audioHandleRef.current = null;
    }
    if (uri) {
      playAudioFromUri(uri).then(h => { audioHandleRef.current = h; });
    }
    return () => { audioHandleRef.current?.unload(); audioHandleRef.current = null; };
  }, [currentFragment?.uid, currentFragment?.backgroundAudio]);

  const applyResult = useCallback((
    state: ChronicaState,
    frag: Fragment | null,
    choices: Choice[],
    addToHistory = false
  ) => {
    setGameState({ ...state });
    setCurrentFragment(frag);
    setVisibleChoices(choices);
    if (addToHistory && frag) {
      setHistory(h => [...h, { locationId: frag.locationId, title: frag.title || frag.locationId }]);
    }
  }, []);

  const startGame = useCallback(() => {
    if (!project?.fragments.length) return;
    const startLoc = project.startLocation?.trim() || project.fragments[0].locationId;
    const result = startSession(startLoc, project.fragments, project.initialVariables ?? {}, project.initialMemory ?? {});
    setHistory(result.fragment ? [{ locationId: result.fragment.locationId, title: result.fragment.title || result.fragment.locationId }] : []);
    applyResult(result.state, result.fragment, result.visibleChoices);
    setStarted(true);
  }, [project, applyResult]);

  const resetGame = () => {
    Alert.alert('Restart', 'Start the story over from the beginning?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restart', onPress: startGame },
    ]);
  };

  const loadSave = useCallback(async () => {
    try {
      const json = await AsyncStorage.getItem(`pse_save_${projectId}`);
      if (!json) { Alert.alert('No Save Found', 'Start a new playtest first.'); return; }
      const save = JSON.parse(json);
      const state = deserializeState(save.state);
      if (!state || !project) return;
      const frag = getActiveFragment(state.location, state, project.fragments);
      const choices = frag ? getVisibleChoices(frag, state) : [];
      setHistory(save.history ?? []);
      applyResult(state, frag, choices);
      setStarted(true);
    } catch { Alert.alert('Error', 'Could not load save.'); }
  }, [projectId, project, applyResult]);

  const saveGame = async () => {
    if (!gameState) return;
    await AsyncStorage.setItem(`pse_save_${projectId}`, JSON.stringify({
      projectId,
      state: JSON.parse(serializeState(gameState)),
      history,
      savedAt: new Date().toISOString(),
    }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Saved', 'Progress saved.');
  };

  const handleChoice = (choice: Choice) => {
    if (!gameState || !project) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = engineChoose(choice, gameState, project.fragments);
    if (!result.fragment) {
      Alert.alert(
        'Dead End',
        advancedMode
          ? `No fragment found for this destination.\nCheck your location IDs and conditions.`
          : `This choice has no destination yet. Check the scene link.`
      );
      return;
    }
    applyResult(gameState, result.fragment, result.visibleChoices, true);
  };

  const bgUri = getAssetUri(currentFragment?.backgroundImage);

  if (!project) {
    return (
      <View style={[styles.fill, { backgroundColor: colors.background }]}>
        <EmptyState icon="alert-circle" title="Project not found" />
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
            <TouchableOpacity style={[styles.startBtn, { backgroundColor: colors.primary }]} onPress={startGame} activeOpacity={0.8}>
              <Feather name="play" size={17} color="#fff" />
              <Text style={styles.startBtnText}>Start Playtest</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.startBtn, { backgroundColor: colors.secondary }]} onPress={loadSave} activeOpacity={0.8}>
              <Feather name="download" size={17} color={colors.foreground} />
              <Text style={[styles.startBtnText, { color: colors.foreground }]}>Load Save</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      {bgUri ? (
        <ImageBackground source={{ uri: bgUri }} style={StyleSheet.absoluteFill}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.72)' }]} />
        </ImageBackground>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
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
          styles.gameContent,
          { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {currentFragment ? (
          <>
            {currentFragment.title && currentFragment.title !== currentFragment.locationId && (
              <Text style={[styles.fragmentTitle, { color: colors.accent }]}>{currentFragment.title}</Text>
            )}
            <Text style={[styles.fragmentText, { color: '#f0eef8' }]}>
              {currentFragment.text || '(this scene has no text yet)'}
            </Text>

            {visibleChoices.length > 0 ? (
              <View style={styles.choiceList}>
                {visibleChoices.map(choice => (
                  <TouchableOpacity
                    key={choice.uid}
                    style={[styles.choiceBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
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
              <View style={[styles.endCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Feather name="flag" size={20} color={colors.primary} />
                <Text style={[styles.endText, { color: colors.mutedForeground }]}>End of this path</Text>
                <Text style={[styles.endSub, { color: colors.mutedForeground }]}>
                  Visited {history.length} scene{history.length !== 1 ? 's' : ''}
                </Text>
                <TouchableOpacity style={[styles.restartBtn, { backgroundColor: colors.primary }]} onPress={startGame}>
                  <Text style={styles.restartBtnText}>Restart</Text>
                </TouchableOpacity>
              </View>
            )}

            {advancedMode && gameState && (
              <View style={{ marginTop: 8 }}>
                <DebugPanel
                  state={gameState}
                  onStateChange={updated => {
                    setGameState({ ...updated });
                    if (currentFragment) setVisibleChoices(getVisibleChoices(currentFragment, updated));
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
                : `No scene found. Check that your starting scene is set up correctly.`
            }
          />
        )}
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
