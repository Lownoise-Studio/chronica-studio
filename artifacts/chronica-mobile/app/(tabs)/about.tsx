import React from 'react';
import { Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAdvancedMode } from '@/context/AdvancedModeContext';
import { DeveloperMenu } from '@/components/DeveloperMenu';
import { isStudioApp } from '@/config/app-mode';

const features = [
  ['smartphone', 'Mobile-first game editor'],
  ['git-branch', 'State-driven scenes and choices'],
  ['crosshair', 'Visual hotspot placement'],
  ['users', 'Cast and dialogue system'],
  ['image', 'Image and audio asset library'],
  ['archive', 'ZIP asset pack import'],
  ['package', '.chronica game package export'],
  ['play-circle', 'Chronica Player support'],
  ['check-circle', 'Compile-time validation'],
  ['save', 'Save/resume runtime'],
] as const;

export default function AboutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { advancedMode, toggleAdvancedMode } = useAdvancedMode();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16),
        paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 32,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <View style={[styles.icon, { backgroundColor: colors.primary }]}>
          <Feather name="box" size={36} color="#fff" />
        </View>
        <Text style={[styles.appName, { color: colors.foreground }]}>Chronica Studio</Text>
        <Text style={[styles.studioName, { color: colors.primary }]}>by Lownoise Studio</Text>
        <Text style={[styles.version, { color: colors.mutedForeground }]}>Version 1.0.0</Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: advancedMode ? colors.primary + '55' : colors.border }]}>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Advanced Mode</Text>
            <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
              {advancedMode
                ? 'Showing technical labels — scene IDs, conditions syntax, state inspector, and priority controls.'
                : 'Showing simplified labels. Enable to access scene IDs, expression syntax, the state inspector, and priority controls.'}
            </Text>
          </View>
          <Switch
            value={advancedMode}
            onValueChange={toggleAdvancedMode}
            trackColor={{ false: colors.border, true: colors.primary + 'aa' }}
            thumbColor={advancedMode ? colors.primary : colors.mutedForeground}
          />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>What is this?</Text>
        <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
          Chronica Studio is a mobile-first game engine for building state-driven interactive games on phone and tablet.
          Create scenes, choices, dialogue, characters, hotspots, variables, assets, and branching paths directly from your mobile device.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Features</Text>
        {features.map(([icon, label]) => (
          <View key={label} style={styles.featureRow}>
            <Feather name={icon as any} size={14} color={colors.primary} />
            <Text style={[styles.featureText, { color: colors.mutedForeground }]}>{label}</Text>
          </View>
        ))}
      </View>

      {advancedMode ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>How it works</Text>
          <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
            Your game is built from scenes, state, assets, and interactions.{'\n\n'}
            <Text style={{ color: colors.foreground }}>Fragments</Text> describe moments at a location ID, with dialogue lines, background art, conditions, effects, choices, and hotspots.{'\n\n'}
            <Text style={{ color: colors.foreground }}>Choices and hotspots</Text> trigger actions like{' '}
            <Text style={{ color: colors.accent }}>goto:location</Text> or{' '}
            <Text style={{ color: colors.accent }}>variables.trust += 1</Text>.{'\n\n'}
            <Text style={{ color: colors.foreground }}>Variables and memory</Text> store player progress.{' '}
            <Text style={{ color: colors.foreground }}>Characters and dialogue</Text> shape presentation.{'\n\n'}
            The <Text style={{ color: colors.foreground }}>compiler</Text> validates the project before it can be packaged.
            Exported <Text style={{ color: colors.foreground }}>.chronica</Text> files can be opened in Chronica Player.
          </Text>
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>How it works</Text>
          <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
            Your game is built from scenes, state, assets, and interactions.{'\n\n'}
            <Text style={{ color: colors.foreground }}>Scenes</Text> describe moments in the game.{'\n\n'}
            <Text style={{ color: colors.foreground }}>Choices and hotspots</Text> trigger actions.{'\n\n'}
            <Text style={{ color: colors.foreground }}>Variables and memory</Text> store player progress.{'\n\n'}
            <Text style={{ color: colors.foreground }}>Characters and dialogue</Text> shape presentation.{'\n\n'}
            The compiler validates the project before it can be packaged. Exported .chronica files can be opened in Chronica Player.
          </Text>
        </View>
      )}

      {isStudioApp() && (__DEV__ || advancedMode) && <DeveloperMenu />}

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Credits</Text>
        <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
          Developed by Lownoise Studio{'\n'}
          Built with Expo, React Native, and the Chronica runtime architecture.
        </Text>
      </View>

      <Text style={[styles.footer, { color: colors.mutedForeground }]}>
        © 2026 Lownoise Studio
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { alignItems: 'center', gap: 8, paddingVertical: 32, paddingHorizontal: 24 },
  icon: { width: 80, height: 80, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  appName: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: -0.5, textAlign: 'center' },
  studioName: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  version: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4 },
  card: { marginHorizontal: 16, marginBottom: 12, borderRadius: 12, borderWidth: 1, padding: 16, gap: 10 },
  cardTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  cardBody: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  footer: { textAlign: 'center', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 8, marginBottom: 8 },
});
