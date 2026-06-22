import React, { useEffect, useState } from 'react';
import {
  Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { KeyboardAwareScrollViewCompat } from 'react-native-keyboard-controller';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useProjects } from '@/context/ProjectsContext';
import { ArrayEditor } from '@/components/ArrayEditor';
import { ChoiceEditor } from '@/components/ChoiceEditor';
import { Choice } from '@/engine/types';

export default function FragmentEditorScreen() {
  const { id: projectId, uid } = useLocalSearchParams<{ id: string; uid: string }>();
  const colors = useColors();
  const navigation = useNavigation();
  const { getProject, updateFragment } = useProjects();

  const project = getProject(projectId!);
  const fragment = project?.fragments.find(f => f.uid === uid);

  const [locationId, setLocationId] = useState('');
  const [priority, setPriority] = useState('0');
  const [text, setText] = useState('');
  const [conditions, setConditions] = useState<string[]>([]);
  const [effects, setEffects] = useState<string[]>([]);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [bgImage, setBgImage] = useState('');
  const [bgAudio, setBgAudio] = useState('');

  useEffect(() => {
    if (fragment) {
      setLocationId(fragment.locationId);
      setPriority(String(fragment.priority));
      setText(fragment.text);
      setConditions([...fragment.conditions]);
      setEffects([...fragment.effects]);
      setChoices([...fragment.choices]);
      setBgImage(fragment.backgroundImage ?? '');
      setBgAudio(fragment.backgroundAudio ?? '');
    }
  }, [fragment?.uid]);

  const doSave = () => {
    if (!project || !fragment) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateFragment(project.id, fragment.uid, {
      locationId: locationId.trim() || 'start',
      priority: parseInt(priority, 10) || 0,
      text,
      conditions,
      effects,
      choices,
      backgroundImage: bgImage.trim() || undefined,
      backgroundAudio: bgAudio.trim() || undefined,
    });
    router.back();
  };

  useEffect(() => {
    navigation.setOptions({
      title: 'Edit Fragment',
      headerRight: () => (
        <TouchableOpacity onPress={doSave} style={{ marginRight: Platform.OS === 'ios' ? 0 : 8 }}>
          <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 15 }}>
            Save
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [locationId, priority, text, conditions, effects, choices, bgImage, bgAudio]);

  if (!project || !fragment) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, padding: 16 }]}>
        <Text style={{ color: colors.foreground }}>Fragment not found</Text>
      </View>
    );
  }

  const imageAssets = project.assets.filter(a => a.type === 'image').map(a => a.name);
  const audioAssets = project.assets.filter(a => a.type === 'audio').map(a => a.name);

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      bottomOffset={16}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Location + Priority */}
      <View style={styles.row}>
        <View style={styles.fieldFlex}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>LOCATION ID</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            value={locationId}
            onChangeText={setLocationId}
            placeholder="start"
            placeholderTextColor={colors.mutedForeground}
            autoCorrect={false}
            spellCheck={false}
            autoCapitalize="none"
          />
        </View>
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
      </View>

      {/* Text */}
      <View>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>NARRATIVE TEXT</Text>
        <TextInput
          style={[styles.textArea, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
          value={text}
          onChangeText={setText}
          placeholder="Write the narrative text for this fragment..."
          placeholderTextColor={colors.mutedForeground}
          multiline
          textAlignVertical="top"
        />
      </View>

      <View style={[styles.div, { backgroundColor: colors.border }]} />

      <ArrayEditor
        label="CONDITIONS"
        items={conditions}
        onChange={setConditions}
        placeholder="variables.trust >= 3"
        hint="All must pass for this fragment to appear"
      />

      <View style={[styles.div, { backgroundColor: colors.border }]} />

      <ArrayEditor
        label="EFFECTS"
        items={effects}
        onChange={setEffects}
        placeholder='variables.mood = "somber"'
        hint="Applied when this fragment becomes active"
      />

      <View style={[styles.div, { backgroundColor: colors.border }]} />

      <ChoiceEditor choices={choices} onChange={setChoices} />

      <View style={[styles.div, { backgroundColor: colors.border }]} />

      {/* Asset refs */}
      <Text style={[styles.label, { color: colors.mutedForeground }]}>ASSET REFERENCES</Text>

      <View>
        <Text style={[styles.sublabel, { color: colors.mutedForeground }]}>Background Image</Text>
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
                style={[styles.chip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                onPress={() => setBgImage(n)}
              >
                <Text style={[styles.chipText, { color: colors.foreground }]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      <View>
        <Text style={[styles.sublabel, { color: colors.mutedForeground }]}>Background Audio</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
          value={bgAudio}
          onChangeText={setBgAudio}
          placeholder={audioAssets[0] ?? 'track.mp3'}
          placeholderTextColor={colors.mutedForeground}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {audioAssets.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
            {audioAssets.map(n => (
              <TouchableOpacity
                key={n}
                style={[styles.chip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                onPress={() => setBgAudio(n)}
              >
                <Text style={[styles.chipText, { color: colors.foreground }]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={doSave} activeOpacity={0.8}>
        <Feather name="check" size={17} color="#fff" />
        <Text style={styles.saveBtnText}>Save Fragment</Text>
      </TouchableOpacity>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  row: { flexDirection: 'row', gap: 12 },
  fieldFlex: { flex: 1, gap: 6 },
  fieldNarrow: { width: 80, gap: 6 },
  label: { fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  sublabel: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  input: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'Inter_400Regular' },
  textArea: { borderRadius: 8, borderWidth: 1, padding: 12, fontSize: 14, fontFamily: 'Inter_400Regular', minHeight: 140, lineHeight: 20 },
  div: { height: 1 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, marginRight: 6 },
  chipText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10, paddingVertical: 14, marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
