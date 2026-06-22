import React, { useEffect, useMemo, useState } from 'react';
import {
  Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useProjects } from '@/context/ProjectsContext';
import { useAdvancedMode } from '@/context/AdvancedModeContext';
import { ArrayEditor } from '@/components/ArrayEditor';
import { ChoiceEditor } from '@/components/ChoiceEditor';
import { Choice } from '@/engine/types';
import { isValidCondition, isValidEffect } from '@/engine/expression-evaluator';

export default function FragmentEditorScreen() {
  const { id: projectId, uid } = useLocalSearchParams<{ id: string; uid: string }>();
  const colors = useColors();
  const navigation = useNavigation();
  const { getProject, updateFragment } = useProjects();
  const { advancedMode } = useAdvancedMode();

  const project = getProject(projectId!);
  const fragment = project?.fragments.find(f => f.uid === uid);

  const [title, setTitle] = useState('');
  const [locationId, setLocationId] = useState('');
  const [priority, setPriority] = useState('0');
  const [text, setText] = useState('');
  const [conditions, setConditions] = useState<string[]>([]);
  const [effects, setEffects] = useState<string[]>([]);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [bgImage, setBgImage] = useState('');

  useEffect(() => {
    if (fragment) {
      setTitle(fragment.title ?? '');
      setLocationId(fragment.locationId);
      setPriority(String(fragment.priority));
      setText(fragment.text);
      setConditions([...fragment.conditions]);
      setEffects([...fragment.effects]);
      setChoices([...fragment.choices]);
      setBgImage(fragment.backgroundImage ?? '');
    }
  }, [fragment?.uid]);

  const knownLocations = useMemo(
    () => new Set(project?.fragments.map(f => f.locationId) ?? []),
    [project?.fragments.length]
  );

  const conditionErrors = conditions.filter(c => c.trim() && !isValidCondition(c));
  const effectErrors = effects.filter(e => e.trim() && !isValidEffect(e));

  const doSave = () => {
    if (!project || !fragment) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateFragment(project.id, fragment.uid, {
      title: title.trim() || locationId.trim() || 'Scene',
      locationId: locationId.trim() || 'new-scene',
      priority: parseInt(priority, 10) || 0,
      text,
      conditions,
      effects,
      choices,
      backgroundImage: bgImage.trim() || undefined,
    });
    router.back();
  };

  useEffect(() => {
    navigation.setOptions({
      title: title.trim() ? `Edit: ${title.trim()}` : 'Edit Scene',
      headerRight: () => (
        <TouchableOpacity onPress={doSave} style={{ marginRight: Platform.OS === 'ios' ? 0 : 8 }}>
          <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 15 }}>Save</Text>
        </TouchableOpacity>
      ),
    });
  }, [title, locationId, priority, text, conditions, effects, choices, bgImage]);

  if (!project || !fragment) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, padding: 16 }]}>
        <Text style={{ color: colors.foreground }}>Scene not found</Text>
      </View>
    );
  }

  const imageAssets = project.assets.filter(a => a.type === 'image').map(a => a.name);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Scene Name */}
      <View>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>SCENE NAME</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Forest Entrance"
          placeholderTextColor={colors.mutedForeground}
        />
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          A name you can recognise in your scene list
        </Text>
      </View>

      {/* Scene ID (Advanced) + Priority */}
      <View style={styles.row}>
        {advancedMode && (
          <View style={styles.fieldFlex}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>SCENE ID</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
              value={locationId}
              onChangeText={setLocationId}
              placeholder="forest-entrance"
              placeholderTextColor={colors.mutedForeground}
              autoCorrect={false}
              spellCheck={false}
              autoCapitalize="none"
            />
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Other scenes link to this ID
            </Text>
          </View>
        )}
        {advancedMode && (
          <View style={styles.fieldNarrow}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>PRIORITY</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
              value={priority}
              onChangeText={setPriority}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.mutedForeground}
            />
          </View>
        )}
      </View>

      {/* Story Text */}
      <View>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>STORY TEXT</Text>
        <TextInput
          style={[styles.textArea, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
          value={text}
          onChangeText={setText}
          placeholder="Write what the reader sees at this moment in the story…"
          placeholderTextColor={colors.mutedForeground}
          multiline
          textAlignVertical="top"
        />
      </View>

      <View style={[styles.div, { backgroundColor: colors.border }]} />

      {/* Unlock Requirements / Conditions */}
      <ArrayEditor
        label={advancedMode ? 'CONDITIONS' : 'UNLOCK REQUIREMENTS'}
        items={conditions}
        onChange={setConditions}
        placeholder={advancedMode ? 'variables.trust >= 3' : 'e.g. variables.trust >= 3'}
        hint={
          advancedMode
            ? 'All must pass for this fragment to appear at its location'
            : 'All must be met before this scene can appear'
        }
      />
      {conditionErrors.length > 0 && (
        <Text style={[styles.errorText, { color: colors.destructive }]}>
          {conditionErrors.length} invalid {advancedMode ? 'condition' : 'requirement'}{conditionErrors.length > 1 ? 's' : ''}
        </Text>
      )}

      {advancedMode && (
        <>
          <View style={[styles.div, { backgroundColor: colors.border }]} />
          <ArrayEditor
            label="ENTRY EFFECTS"
            items={effects}
            onChange={setEffects}
            placeholder='variables.mood = "somber"'
            hint="Applied when this scene becomes active"
          />
          {effectErrors.length > 0 && (
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              {effectErrors.length} invalid effect{effectErrors.length > 1 ? 's' : ''}
            </Text>
          )}
        </>
      )}

      <View style={[styles.div, { backgroundColor: colors.border }]} />

      <ChoiceEditor
        choices={choices}
        onChange={setChoices}
        knownLocations={knownLocations}
      />

      <View style={[styles.div, { backgroundColor: colors.border }]} />

      {/* Background image */}
      <Text style={[styles.label, { color: colors.mutedForeground }]}>BACKGROUND IMAGE</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
        value={bgImage}
        onChangeText={setBgImage}
        placeholder={imageAssets[0] ?? 'filename.png'}
        placeholderTextColor={colors.mutedForeground}
        autoCorrect={false}
        autoCapitalize="none"
      />
      {imageAssets.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
          {imageAssets.map(n => (
            <TouchableOpacity
              key={n}
              style={[styles.chip, { backgroundColor: colors.secondary, borderColor: bgImage === n ? colors.primary : colors.border }]}
              onPress={() => setBgImage(n)}
            >
              <Text style={[styles.chipText, { color: bgImage === n ? colors.primary : colors.foreground }]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: colors.primary }]}
        onPress={doSave}
        activeOpacity={0.8}
      >
        <Feather name="check" size={17} color="#fff" />
        <Text style={styles.saveBtnText}>Save Scene</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  row: { flexDirection: 'row', gap: 12 },
  fieldFlex: { flex: 1, gap: 4 },
  fieldNarrow: { width: 80, gap: 4 },
  label: { fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  hint: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 4 },
  errorText: { fontSize: 11, fontFamily: 'Inter_500Medium', marginTop: -8 },
  input: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'Inter_400Regular' },
  textArea: { borderRadius: 8, borderWidth: 1, padding: 12, fontSize: 14, fontFamily: 'Inter_400Regular', minHeight: 140, lineHeight: 20 },
  div: { height: 1 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, marginRight: 6 },
  chipText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10, paddingVertical: 14, marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
