import React, { useEffect, useState } from 'react';
import {
  Alert, Platform, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useProjects } from '@/context/ProjectsContext';
import { VariableValue } from '@/engine/types';

type KVEntry = { key: string; value: string };

function parseKVValue(raw: string): VariableValue {
  const t = raw.trim();
  if (t === 'true') return true;
  if (t === 'false') return false;
  const n = Number(t);
  if (!isNaN(n) && t !== '') return n;
  return t;
}

function kvToRecord(entries: KVEntry[]): Record<string, VariableValue> {
  const r: Record<string, VariableValue> = {};
  for (const { key, value } of entries) {
    if (key.trim()) r[key.trim()] = parseKVValue(value);
  }
  return r;
}

function recordToKV(record: Record<string, VariableValue>): KVEntry[] {
  return Object.entries(record).map(([key, value]) => ({ key, value: JSON.stringify(value) }));
}

function KVEditor({ label, hint, entries, onChange }: {
  label: string; hint: string;
  entries: KVEntry[]; onChange: (e: KVEntry[]) => void;
}) {
  const colors = useColors();
  const add = () => onChange([...entries, { key: '', value: '' }]);
  const remove = (i: number) => onChange(entries.filter((_, idx) => idx !== i));
  const update = (i: number, field: 'key' | 'value', val: string) => {
    const next = [...entries]; next[i] = { ...next[i], [field]: val }; onChange(next);
  };
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>{hint}</Text>
      {entries.map((entry, i) => (
        <View key={i} style={styles.kvRow}>
          <TextInput
            style={[styles.kvInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            value={entry.key} onChangeText={v => update(i, 'key', v)}
            placeholder="variableName" placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none" autoCorrect={false}
          />
          <TextInput
            style={[styles.kvInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            value={entry.value} onChangeText={v => update(i, 'value', v)}
            placeholder="0" placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none" autoCorrect={false}
          />
          <TouchableOpacity onPress={() => remove(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity style={[styles.addKVBtn, { borderColor: colors.border }]} onPress={add} activeOpacity={0.8}>
        <Feather name="plus" size={14} color={colors.primary} />
        <Text style={[styles.addKVText, { color: colors.primary }]}>Add {label.toLowerCase()}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function SettingsScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getProject, updateProject, deleteProject } = useProjects();

  const project = getProject(projectId!);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [startLoc, setStartLoc] = useState('start');
  const [varEntries, setVarEntries] = useState<KVEntry[]>([]);
  const [memEntries, setMemEntries] = useState<KVEntry[]>([]);

  useEffect(() => {
    if (project) {
      setTitle(project.title);
      setDesc(project.description);
      setStartLoc(project.startLocation ?? 'start');
      setVarEntries(recordToKV(project.initialVariables ?? {}));
      setMemEntries(recordToKV(project.initialMemory ?? {}));
    }
  }, [project?.id]);

  if (!project) return null;

  const save = () => {
    updateProject(projectId!, {
      title: title.trim() || project.title,
      description: desc.trim(),
      startLocation: startLoc.trim() || 'start',
      initialVariables: kvToRecord(varEntries),
      initialMemory: kvToRecord(memEntries),
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const confirmDelete = () => {
    Alert.alert('Delete Project', `Delete "${project.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteProject(projectId!); router.dismissAll(); } },
    ]);
  };

  const stats: [string, number][] = [
    ['Fragments', project.fragments.length],
    ['Locations', new Set(project.fragments.map(f => f.locationId)).size],
    ['Assets', project.assets.length],
    ['Total Choices', project.fragments.reduce((s, f) => s + f.choices.length, 0)],
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 24 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.secTitle, { color: colors.foreground }]}>Project Info</Text>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Title</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
          value={title} onChangeText={setTitle} placeholder="Project title" placeholderTextColor={colors.mutedForeground}
        />
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
          value={desc} onChangeText={setDesc} placeholder="Brief description…" placeholderTextColor={colors.mutedForeground}
          multiline numberOfLines={3}
        />
      </View>

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.secTitle, { color: colors.foreground }]}>Default Game State</Text>
        <Text style={[styles.secDesc, { color: colors.mutedForeground }]}>
          The start location and initial values for every new playtest session.
        </Text>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Start Location ID</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
          value={startLoc} onChangeText={setStartLoc} placeholder="start"
          placeholderTextColor={colors.mutedForeground} autoCapitalize="none" autoCorrect={false}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <KVEditor
          label="Variables"
          hint={'Numeric/string/boolean (e.g. trust = 0, mood = "neutral")'}
          entries={varEntries} onChange={setVarEntries}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <KVEditor
          label="Memory flags"
          hint="Boolean flags (e.g. met_guard = false)"
          entries={memEntries} onChange={setMemEntries}
        />
      </View>

      <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={save} activeOpacity={0.8}>
        <Feather name="check" size={16} color="#fff" />
        <Text style={styles.btnText}>Save Settings</Text>
      </TouchableOpacity>

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.secTitle, { color: colors.foreground }]}>Stats</Text>
        {stats.map(([label, val]) => (
          <View key={label} style={styles.statRow}>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
            <Text style={[styles.statVal, { color: colors.foreground }]}>{val}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 10 }]}
        onPress={() => router.push(`/project/${projectId}/export` as any)}
        activeOpacity={0.8}
      >
        <Feather name="download" size={16} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.secTitle, { color: colors.foreground }]}>Export / Import</Text>
          <Text style={[styles.secDesc, { color: colors.mutedForeground }]}>Save as JSON or load from a file</Text>
        </View>
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.destructive + '66' }]}>
        <Text style={[styles.secTitle, { color: colors.destructive }]}>Danger Zone</Text>
        <TouchableOpacity style={[styles.deleteBtn, { borderColor: colors.destructive }]} onPress={confirmDelete} activeOpacity={0.8}>
          <Feather name="trash-2" size={15} color={colors.destructive} />
          <Text style={[styles.deleteBtnText, { color: colors.destructive }]}>Delete Project</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 10 },
  secTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  secDesc: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  hint: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: -6 },
  input: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'Inter_400Regular' },
  textArea: { height: 80, textAlignVertical: 'top' },
  divider: { height: 1 },
  kvRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  kvInput: { flex: 1, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, fontFamily: 'Inter_400Regular' },
  addKVBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', paddingVertical: 8, paddingHorizontal: 12 },
  addKVText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 8, paddingVertical: 14 },
  btnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  statVal: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 8, borderWidth: 1, paddingVertical: 12 },
  deleteBtnText: { fontFamily: 'Inter_500Medium', fontSize: 14 },
});
