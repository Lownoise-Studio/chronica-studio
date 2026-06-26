import React, { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useProjects } from '@/context/ProjectsContext';
import { ProjectCard } from '@/components/ProjectCard';
import { EmptyState } from '@/components/EmptyState';
import {
  navigateToPlay,
  showRemoveGameMenu,
  useLoadGameActions,
} from '@/hooks/useLoadGameActions';
import { loadGameFromUri } from '@/storage/load-game';

export default function PlayerHomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { projects, deleteProject, isLoaded, importProject, importProjectPackage } = useProjects();
  const { loadingGame, loadingDemo, handleLoadGame, handleTryDemo } = useLoadGameActions();

  const openGame = useCallback(async () => {
    const nav = await handleLoadGame();
    if (nav) navigateToPlay(router, nav);
  }, [handleLoadGame]);

  const openDemo = useCallback(async () => {
    const nav = await handleTryDemo();
    if (nav) navigateToPlay(router, nav);
  }, [handleTryDemo]);

  const openIncomingUri = useCallback(
    async (uri: string | null) => {
      if (!uri || Platform.OS === 'web') return;
      const path = uri.replace(/^.*:\/\//, '');
      if (!path && !uri.startsWith('content://') && !uri.startsWith('file://')) return;

      try {
        const result = await loadGameFromUri(uri, { importProject, importProjectPackage });
        if (!result.ok) {
          Alert.alert('Could not open game', result.error);
          return;
        }
        navigateToPlay(router, { projectId: result.project.id, autoStart: true });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Could not open file.';
        Alert.alert('Could not open game', msg);
      }
    },
    [importProject, importProjectPackage],
  );

  useEffect(() => {
    Linking.getInitialURL().then(openIncomingUri);
    const sub = Linking.addEventListener('url', ({ url }) => {
      openIncomingUri(url);
    });
    return () => sub.remove();
  }, [openIncomingUri]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16), borderBottomColor: colors.border },
        ]}
      >
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Chronica Player</Text>
          <Text style={[styles.subtitle, { color: colors.primary }]}>by Lownoise Studio</Text>
        </View>
        <TouchableOpacity
          style={[styles.openBtn, { backgroundColor: colors.primary }]}
          onPress={openGame}
          disabled={loadingGame}
          activeOpacity={0.8}
        >
          {loadingGame ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="folder" size={16} color="#fff" />
              <Text style={styles.openBtnText}>Open Game</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={projects}
        keyExtractor={p => p.id}
        renderItem={({ item }) => (
          <ProjectCard
            project={item}
            onPress={() => navigateToPlay(router, { projectId: item.id })}
            onLongPress={() => showRemoveGameMenu(item, deleteProject)}
          />
        )}
        contentContainerStyle={[
          styles.list,
          !projects.length && styles.listEmpty,
          { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 24 },
        ]}
        ListHeaderComponent={
          <>
            <TouchableOpacity
              style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={openGame}
              disabled={loadingGame || loadingDemo}
              activeOpacity={0.85}
            >
              <Feather name="play-circle" size={28} color={colors.primary} />
              <View style={styles.heroCopy}>
                <Text style={[styles.heroTitle, { color: colors.foreground }]}>Open a .chronica game</Text>
                <Text style={[styles.heroDesc, { color: colors.mutedForeground }]}>
                  Pick a game package exported from Chronica Studio and play it on this device.
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.demoCard, { backgroundColor: colors.card, borderColor: colors.primary + '44' }]}
              onPress={openDemo}
              disabled={loadingDemo || loadingGame}
              activeOpacity={0.85}
            >
              <View style={styles.demoHeader}>
                <Feather name="zap" size={18} color={colors.primary} />
                <Text style={[styles.demoTitle, { color: colors.foreground }]}>Try Demo</Text>
                {loadingDemo && <ActivityIndicator size="small" color={colors.primary} />}
              </View>
              <Text style={[styles.demoDesc, { color: colors.mutedForeground }]}>
                Play Engine Showcase — dialogue, portraits, hotspots, and branching state in one bundled .chronica game.
              </Text>
            </TouchableOpacity>

            {projects.length > 0 && (
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Your games</Text>
            )}
          </>
        }
        ListEmptyComponent={
          isLoaded ? (
            <EmptyState
              icon="book-open"
              title="No games yet"
              message="Open a .chronica package or try the demo to start playing."
              actionLabel="Open Game"
              onAction={openGame}
              secondaryActionLabel="Try Demo"
              onSecondaryAction={openDemo}
            />
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  title: { fontSize: 24, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  subtitle: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    minHeight: 40,
  },
  openBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  list: { paddingTop: 12 },
  listEmpty: { flex: 1 },
  heroCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroCopy: { flex: 1, gap: 4 },
  heroTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  heroDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  demoCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  demoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  demoTitle: { flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  demoDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  sectionLabel: {
    marginHorizontal: 20,
    marginBottom: 8,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
