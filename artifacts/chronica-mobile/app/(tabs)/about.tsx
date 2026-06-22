import React from 'react';
import { Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAdvancedMode } from '@/context/AdvancedModeContext';

const features = [
  ['book', 'Scene-based story editor'],
  ['git-branch', 'Branching choices with unlock requirements'],
  ['sliders', 'Story variables & memory flags'],
  ['play', 'Playtest mode to check every path'],
  ['image', 'Image asset management'],
  ['download', 'Export & import as JSON'],
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
          <Feather name="book-open" size={36} color="#fff" />
        </View>
        <Text style={[styles.appName, { color: colors.foreground }]}>Chronica Studio</Text>
        <Text style={[styles.studioName, { color: colors.primary }]}>by Lownoise Studio</Text>
        <Text style={[styles.version, { color: colors.mutedForeground }]}>Version 1.0.0</Text>
      </View>

      {/* Advanced Mode toggle */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: advancedMode ? colors.primary + '55' : colors.border }]}>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Advanced Mode</Text>
            <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
              {advancedMode
                ? 'Showing technical labels — Scene IDs, conditions syntax, state inspector, and priority controls.'
                : 'Showing writer-friendly labels. Enable to access Scene IDs, expression syntax, the state inspector, and priority controls.'}
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
          Chronica Studio lets you write, edit, playtest, and share branching stories
          directly from your Android phone.{'\n\n'}
          Build scenes, connect them with choices, and playtest your story immediately — no desktop required.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Features</Text>
        {features.map(([icon, label]) => (
          <View key={icon} style={styles.featureRow}>
            <Feather name={icon as any} size={14} color={colors.primary} />
            <Text style={[styles.featureText, { color: colors.mutedForeground }]}>{label}</Text>
          </View>
        ))}
      </View>

      {advancedMode ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>How the engine works</Text>
          <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
            Each story is built from <Text style={{ color: colors.foreground }}>fragments</Text> — nodes in a graph.
            Every fragment has a <Text style={{ color: colors.foreground }}>location ID</Text>, narrative text,
            optional conditions (when to show it), effects (state changes on entry), and choices (what the player can do next).{'\n\n'}
            Choices carry actions like <Text style={{ color: colors.accent }}>goto:location</Text> to navigate,
            or expressions like <Text style={{ color: colors.accent }}>variables.trust += 1</Text> to modify state.{'\n\n'}
            The engine picks the highest-priority fragment whose conditions all pass for the current location and state.
          </Text>
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>How it works</Text>
          <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
            Your story is made of <Text style={{ color: colors.foreground }}>scenes</Text> — each one is a moment the reader can land on.
            {'\n\n'}
            Add <Text style={{ color: colors.foreground }}>choices</Text> to branch the story. Each choice links to another scene by its ID.
            {'\n\n'}
            Use <Text style={{ color: colors.foreground }}>unlock requirements</Text> to gate choices behind conditions — so choices only appear when the reader has earned them.
            {'\n\n'}
            Hit <Text style={{ color: colors.foreground }}>Playtest</Text> at any time to read through your story exactly as a reader would.
          </Text>
        </View>
      )}

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Credits</Text>
        <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
          Developed by Lownoise Studio{'\n'}
          Engine architecture based on the Chronica Engine{'\n'}
          Built with Expo & React Native
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
  featureText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  footer: { textAlign: 'center', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 8, marginBottom: 8 },
});
