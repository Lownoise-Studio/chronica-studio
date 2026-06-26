import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useProjects } from '@/context/ProjectsContext';
import { useAdvancedMode } from '@/context/AdvancedModeContext';

type DevAction = {
  key: 'onboarding' | 'demos' | 'library' | 'app';
  icon: string;
  label: string;
  description: string;
  destructive?: boolean;
};

const ACTIONS: DevAction[] = [
  {
    key: 'onboarding',
    icon: 'book-open',
    label: 'Reset onboarding',
    description: 'Show the welcome slides again on the library screen.',
  },
  {
    key: 'demos',
    icon: 'package',
    label: 'Reset demo projects',
    description: 'Remove the seeded sample and imported showcase games.',
    destructive: true,
  },
  {
    key: 'library',
    icon: 'trash-2',
    label: 'Clear library',
    description: 'Delete every project, playtest save, and asset folder on this device.',
    destructive: true,
  },
  {
    key: 'app',
    icon: 'rotate-ccw',
    label: 'Reset app state',
    description: 'Clear the library, onboarding, advanced mode, and all runtime saves.',
    destructive: true,
  },
];

export function DeveloperMenu() {
  const colors = useColors();
  const { resetOnboarding, removeDemoProjects, clearLibrary, resetAppState } = useProjects();
  const { resetAdvancedMode } = useAdvancedMode();
  const [busyKey, setBusyKey] = useState<DevAction['key'] | null>(null);

  const runAction = async (action: DevAction) => {
    setBusyKey(action.key);
    try {
      switch (action.key) {
        case 'onboarding':
          await resetOnboarding();
          break;
        case 'demos':
          await removeDemoProjects();
          break;
        case 'library':
          await clearLibrary();
          break;
        case 'app':
          await resetAppState();
          await resetAdvancedMode();
          break;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Done', `${action.label} completed.`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Something went wrong.';
      Alert.alert('Reset failed', message);
    } finally {
      setBusyKey(null);
    }
  };

  const confirmAction = (action: DevAction) => {
    if (!action.destructive) {
      void runAction(action);
      return;
    }

    Alert.alert(action.label, action.description, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action.label,
        style: 'destructive',
        onPress: () => { void runAction(action); },
      },
    ]);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Feather name="tool" size={16} color={colors.primary} />
        <Text style={[styles.title, { color: colors.foreground }]}>Developer</Text>
      </View>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Quick resets while building and playtesting.
      </Text>

      {ACTIONS.map(action => {
        const busy = busyKey === action.key;
        return (
          <TouchableOpacity
            key={action.key}
            style={[
              styles.row,
              {
                backgroundColor: colors.secondary,
                borderColor: action.destructive ? colors.destructive + '44' : colors.border,
              },
            ]}
            onPress={() => confirmAction(action)}
            disabled={busyKey !== null}
            activeOpacity={0.8}
          >
            <View style={[styles.iconWrap, { backgroundColor: colors.background }]}>
              {busy ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather
                  name={action.icon as any}
                  size={15}
                  color={action.destructive ? colors.destructive : colors.primary}
                />
              )}
            </View>
            <View style={styles.copy}>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>{action.label}</Text>
              <Text style={[styles.rowBody, { color: colors.mutedForeground }]}>{action.description}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 12, borderRadius: 12, borderWidth: 1, padding: 16, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  subtitle: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  rowBody: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
});
