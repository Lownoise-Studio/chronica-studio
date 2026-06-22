import React from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

const features = [
  ['book', 'Fragment-based narrative editor'],
  ['git-branch', 'Branching choices with conditions'],
  ['sliders', 'State variables & memory flags'],
  ['play', 'Playtest mode with debug inspector'],
  ['image', 'Image asset management'],
  ['download', 'Export & import as JSON'],
] as const;

export default function AboutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

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
        <Text style={[styles.appName, { color: colors.foreground }]}>Pocket Story Engine</Text>
        <Text style={[styles.studioName, { color: colors.primary }]}>by Lownoise Studio</Text>
        <Text style={[styles.version, { color: colors.mutedForeground }]}>Version 1.0.0</Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>What is this?</Text>
        <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
          Pocket Story Engine lets you create, edit, playtest, and export branching narrative games
          directly from your Android phone.{'\n\n'}
          Build fragments, connect them with choices, add conditions and variables, then playtest
          your story immediately — no desktop required.
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
  footer: { textAlign: 'center', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 8, marginBottom: 8 },
});
