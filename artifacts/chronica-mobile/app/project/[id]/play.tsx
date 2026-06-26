import React, { useState, useEffect } from 'react';
import {
  Alert, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
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
import { PlayerView } from '@/components/PlayerView';
import { Choice, SceneHotspot } from '@/engine';
import { loadRuntimeSave, persistRuntimeSave, resumeRejectionMessage } from '@/runtime';

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
    visibleHotspots,
    history,
    backgroundUri: bgUri,
    audioUri,
    assetWarnings,
    start,
    tryResume,
    choose,
    activateHotspot,
    setRuntimeState,
    toSave,
  } = useChronicaRuntime(project);

  const [showLoadedBanner, setShowLoadedBanner] = useState(loaded === '1');

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
    const result = tryResume(save);
    if (result.ok) return;

    const message = resumeRejectionMessage(result.reason);
    if (result.reason === 'stale-content') {
      Alert.alert('Save Outdated', `${message} Start a new playtest?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start Fresh', onPress: start },
      ]);
      return;
    }

    Alert.alert('Could Not Resume', message);
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

  const handleHotspot = (hotspot: SceneHotspot) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = activateHotspot(hotspot);
    if (!result.ok && result.reason === 'dead-end') {
      Alert.alert(
        'Invalid Hotspot',
        advancedMode
          ? 'Hotspot action did not resolve to a valid scene.\nCheck action steps and conditions.'
          : 'This hotspot has no valid action yet. Check the scene link.',
      );
    }
  };

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
    <PlayerView
      colors={colors}
      advancedMode={advancedMode}
      fragment={currentFragment}
      visibleChoices={visibleChoices}
      visibleHotspots={visibleHotspots}
      history={history}
      gameState={gameState}
      backgroundUri={bgUri}
      audioUri={audioUri}
      showLoadedBanner={showLoadedBanner}
      onBack={() => router.back()}
      onRestart={resetGame}
      onSave={saveGame}
      onChoose={handleChoice}
      onActivateHotspot={handleHotspot}
      debugPanel={
        advancedMode && gameState && currentFragment ? (
          <View style={{ marginTop: 8, gap: 8 }}>
            {assetWarnings.length > 0 && (
              <View style={{ gap: 4 }}>
                {assetWarnings.map((warning, i) => (
                  <Text key={i} style={{ color: colors.destructive, fontSize: 11, fontFamily: 'Inter_400Regular' }}>
                    {warning}
                  </Text>
                ))}
              </View>
            )}
            <DebugPanel
              state={gameState}
              onStateChange={updated => {
                setRuntimeState(updated);
              }}
            />
          </View>
        ) : undefined
      }
    />
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
});
