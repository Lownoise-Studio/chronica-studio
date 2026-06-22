import React, { useState, useCallback } from 'react';
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
import { DebugPanel } from '@/components/DebugPanel';
import { EmptyState } from '@/components/EmptyState';
import {
  Fragment, Choice, ChronicaState,
  startSession, choose as engineChoose, serializeState, deserializeState,
} from '@/engine';

export default function PlayScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getProject } = useProjects();

  const project = getProject(projectId!);
  const [gameState, setGameState] = useState<ChronicaState | null>(null);
  const [currentFragment, setCurrentFragment] = useState<Fragment | null>(null);
  const [started, setStarted] = useState(false);

  const startGame = useCallback(() => {
    if (!project?.fragments.length) return;
    const firstLocation = project.fragments[0].locationId;
    const { state, fragment } = startSession(firstLocation, project.fragments);
    setGameState({ ...state });
    setCurrentFragment(fragment);
    setStarted(true);
  }, [project]);

  const loadSave = useCallback(async () => {
    try {
      const json = await AsyncStorage.getItem(`chronica_save_${projectId}`);
      if (!json) { Alert.alert('No Save Found', 'Start a new game first.'); return; }
      const save = JSON.parse(json);
      const state = deserializeState(save.state);
      if (!state || !project) return;
      const frag = project.fragments.find(f => f.locationId === state.location && f.conditions.length === 0)
        ?? project.fragments.find(f => f.locationId === state.location) ?? null;
      setGameState({ ...state });
      setCurrentFragment(frag);
      setStarted(true);
    } catch { Alert.alert('Error', 'Could not load save.'); }
  }, [projectId, project]);

  const saveGame = async () => {
    if (!gameState) return;
    await AsyncStorage.setItem(`chronica_save_${projectId}`, JSON.stringify({
      projectId,
      state: JSON.parse(serializeState(gameState)),
      savedAt: new Date().toISOString(),
    }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Saved', 'Game state saved successfully.');
  };

  const handleChoice = (choice: Choice) => {
    if (!gameState || !project) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const stateCopy: ChronicaState = JSON.parse(serializeState(gameState));
    const nextFrag = engineChoose(choice, stateCopy, project.fragments);
    if (!nextFrag) {
      Alert.alert('Dead End', 'No fragment found. Check your location IDs and conditions.');
      return;
    }
    setGameState({ ...stateCopy });
    setCurrentFragment(nextFrag);
  };

  const getAssetUri = (name?: string) =>
    name ? project?.assets.find(a => a.name === name)?.uri : undefined;

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
        <Feather name="book-open" size={56} color={colors.primary} />
        <Text style={[styles.projectTitle, { color: colors.foreground }]}>{project.title}</Text>
        {!!project.description && (
          <Text style={[styles.projectDesc, { color: colors.mutedForeground }]}>{project.description}</Text>
        )}
        {project.fragments.length === 0 ? (
          <Text style={[styles.noFrags, { color: colors.destructive }]}>
            Add fragments to your project before playing
          </Text>
        ) : (
          <View style={styles.startBtns}>
            <TouchableOpacity style={[styles.startBtn, { backgroundColor: colors.primary }]} onPress={startGame} activeOpacity={0.8}>
              <Feather name="play" size={17} color="#fff" />
              <Text style={styles.startBtnText}>Start Game</Text>
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
        <Text style={[styles.locationBadge, { color: colors.primary }]}>
          {currentFragment?.locationId ?? '—'}
        </Text>
        <TouchableOpacity onPress={saveGame} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="save" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.fill}
        contentContainerStyle={[
          styles.gameContent,
          { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {currentFragment ? (
          <>
            <Text style={[styles.fragmentText, { color: '#f0eef8' }]}>
              {currentFragment.text || '(empty fragment)'}
            </Text>

            {currentFragment.choices.length > 0 ? (
              <View style={styles.choiceList}>
                {currentFragment.choices.map(choice => (
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
                <TouchableOpacity style={[styles.restartBtn, { backgroundColor: colors.primary }]} onPress={startGame}>
                  <Text style={styles.restartBtnText}>Start Over</Text>
                </TouchableOpacity>
              </View>
            )}

            {gameState && (
              <View style={{ marginTop: 8 }}>
                <DebugPanel state={gameState} />
              </View>
            )}
          </>
        ) : (
          <EmptyState icon="alert-circle" title="No fragment found" message="No valid fragment for this location and state" />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  startScreen: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  closeBtn: { position: 'absolute', right: 20 },
  projectTitle: { fontSize: 28, fontFamily: 'Inter_700Bold', textAlign: 'center', letterSpacing: -0.5 },
  projectDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  noFrags: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  startBtns: { gap: 12, width: '100%', marginTop: 8 },
  startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14 },
  startBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  gameHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  locationBadge: { fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 1 },
  gameContent: { padding: 24, gap: 24 },
  fragmentText: { fontSize: 17, fontFamily: 'Inter_400Regular', lineHeight: 28 },
  choiceList: { gap: 10 },
  choiceBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, borderWidth: 1, padding: 14 },
  choiceText: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium' },
  endCard: { alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, padding: 24 },
  endText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  restartBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  restartBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});
