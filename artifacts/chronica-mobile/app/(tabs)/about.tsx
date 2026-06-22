import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

const features = [
  ['book', 'Fragment-based narrative system'],
  ['git-branch', 'Branching choices & conditions'],
  ['sliders', 'State variables & memory'],
  ['save', 'Save & load game sessions'],
  ['folder', 'Asset management (images & audio)'],
  ['cloud', 'Optional cloud sync'],
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
        <Text style={[styles.appName, { color: colors.foreground }]}>Chronica</Text>
        <Text style={[styles.studioName, { color: colors.primary }]}>by Lownoise Studio</Text>
        <Text style={[styles.version, { color: colors.mutedForeground }]}>Version 1.0.0</Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>About</Text>
        <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
          Chronica is a mobile game creation tool for narrative games — interactive fiction, visual novels,
          choice-driven RPGs, and branching dialogue systems.{'\n\n'}
          Design and play story-driven games entirely on your phone. Build fragments, define choices,
          and watch your narrative come alive.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Engine Features</Text>
        {features.map(([icon, label]) => (
          <View key={icon} style={styles.featureRow}>
            <Feather name={icon as any} size={14} color={colors.primary} />
            <Text style={[styles.featureText, { color: colors.mutedForeground }]}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Credits</Text>
        <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
          Developed by Lownoise Studio{'\n'}
          Engine architecture based on Chronica Engine{'\n'}
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
  appName: { fontSize: 32, fontFamily: 'Inter_700Bold', letterSpacing: -1 },
  studioName: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  version: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4 },
  card: { marginHorizontal: 16, marginBottom: 12, borderRadius: 12, borderWidth: 1, padding: 16, gap: 10 },
  cardTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  cardBody: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  footer: { textAlign: 'center', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 8 },
});
