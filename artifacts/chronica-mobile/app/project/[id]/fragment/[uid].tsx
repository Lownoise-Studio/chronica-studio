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
import { ArrayEditor, ArrayEditorSuggestion } from '@/components/ArrayEditor';
import { ChoiceEditor } from '@/components/ChoiceEditor';
import { DialogueEditor } from '@/components/DialogueEditor';
import { HotspotEditor } from '@/components/HotspotEditor';
import { StageActorEditor } from '@/components/StageActorEditor';
import { StageComposer } from '@/components/stage/StageComposer';
import { SceneInspectorPanel } from '@/components/stage/SceneInspectorPanel';
import { GameplayScenePreview } from '@/components/GameplayScenePreview';
import { GameplayComponentBrowser } from '@/components/GameplayComponentBrowser';
import { GameplayTemplatePicker } from '@/components/GameplayTemplatePicker';
import { getObjectForHotspot } from '@/engine/stage-presentation';
import { Choice, DialogueLine, SceneHotspot, StageActor, StageComposition } from '@/engine/types';
import { emptyStageComposition } from '@/engine/stage-authoring';
import { applyGameplayComponentToFragment, mergeGameplayComponentPatch } from '@/engine/gameplay-components';
import { applyGameplayTemplateToFragment, mergeGameplayTemplateCatalogs } from '@/engine/gameplay-templates';
import { getFragmentDialogueLines, syncFragmentTextFromDialogue } from '@/engine/dialogue';
import { isValidCondition, isValidEffect } from '@/engine/expression-evaluator';
import {
  buildGameplaySuggestions,
  buildUnlockCondition,
  extractProjectVariables,
  isVariableInConditions,
} from '@/engine/editor-helpers';

export default function FragmentEditorScreen() {
  const { id: projectId, uid } = useLocalSearchParams<{ id: string; uid: string }>();
  const colors = useColors();
  const navigation = useNavigation();
  const { getProject, updateFragment, updateProject } = useProjects();
  const { advancedMode } = useAdvancedMode();

  const project = getProject(projectId!);
  const fragment = project?.fragments.find(f => f.uid === uid);

  const [title, setTitle] = useState('');
  const [locationId, setLocationId] = useState('');
  const [priority, setPriority] = useState('0');
  const [dialogue, setDialogue] = useState<DialogueLine[]>([]);
  const [conditions, setConditions] = useState<string[]>([]);
  const [effects, setEffects] = useState<string[]>([]);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [hotspots, setHotspots] = useState<SceneHotspot[]>([]);
  const [stageActors, setStageActors] = useState<StageActor[]>([]);
  const [bgImage, setBgImage] = useState('');
  const [stageAuthoring, setStageAuthoring] = useState<StageComposition>(emptyStageComposition());
  const [focusedHotspotUid, setFocusedHotspotUid] = useState<string | null>(null);
  const [focusedStageObjectUid, setFocusedStageObjectUid] = useState<string | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [componentBrowserOpen, setComponentBrowserOpen] = useState(false);

  useEffect(() => {
    if (fragment) {
      setTitle(fragment.title ?? '');
      setLocationId(fragment.locationId);
      setPriority(String(fragment.priority));
      setDialogue(getFragmentDialogueLines(fragment));
      setConditions([...fragment.conditions]);
      setEffects([...fragment.effects]);
      setChoices([...fragment.choices]);
      setHotspots([...(fragment.hotspots ?? [])]);
      setStageActors([...(fragment.stageActors ?? [])]);
      setBgImage(fragment.backgroundImage ?? '');
      setStageAuthoring(fragment.stageAuthoring ?? emptyStageComposition());
    }
  }, [fragment?.uid]);

  const variableSuggestions = useMemo((): ArrayEditorSuggestion[] => {
    if (!project) return [];
    const catalog = buildGameplaySuggestions(project).map(s => ({
      label: s.label,
      value: s.value,
      disabled: false,
    }));
    const variables = extractProjectVariables(project).map(v => ({
      label: v.name,
      value: buildUnlockCondition(v.name, v.type, v.rawValue),
      disabled: isVariableInConditions(v.name, conditions),
    }));
    const merged = new Map<string, ArrayEditorSuggestion>();
    for (const item of [...catalog, ...variables]) merged.set(item.value, item);
    return Array.from(merged.values());
  }, [project, conditions]);

  const conditionErrors = conditions.filter(c => c.trim() && !isValidCondition(c));
  const effectErrors = effects.filter(e => e.trim() && !isValidEffect(e));

  const doSave = () => {
    if (!project || !fragment) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateFragment(project.id, fragment.uid, {
      title: title.trim() || locationId.trim() || 'Scene',
      locationId: locationId.trim() || 'new-scene',
      priority: parseInt(priority, 10) || 0,
      dialogue,
      text: syncFragmentTextFromDialogue(dialogue),
      conditions,
      effects,
      choices,
      hotspots,
      stageActors: stageActors.length ? stageActors : undefined,
      backgroundImage: bgImage.trim() || undefined,
      stageAuthoring: JSON.stringify(stageAuthoring) !== JSON.stringify(emptyStageComposition())
        ? stageAuthoring
        : undefined,
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
  }, [title, locationId, priority, dialogue, conditions, effects, choices, hotspots, stageActors, bgImage, stageAuthoring]);

  if (!project || !fragment) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, padding: 16 }]}>
        <Text style={{ color: colors.foreground }}>Scene not found</Text>
      </View>
    );
  }

  const imageAssets = project.assets.filter(a => a.type === 'image').map(a => a.name);

  const linkedStageObject = focusedHotspotUid
    ? getObjectForHotspot(stageAuthoring, focusedHotspotUid)
    : undefined;
  const linkedHotspot = focusedStageObjectUid
    ? hotspots.find(h => {
      const object = stageAuthoring.objects.find(o => o.uid === focusedStageObjectUid);
      const ref = object?.hotspotRef ?? object?.interactionRef;
      return ref && h.uid === ref;
    })
    : undefined;

  const inspectorFragment = {
    ...fragment,
    hotspots,
    stageActors,
    stageAuthoring,
    choices,
    conditions,
    effects,
    dialogue,
    text: syncFragmentTextFromDialogue(dialogue),
    backgroundImage: bgImage,
  };

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

      {/* Dialogue */}
      <DialogueEditor
        lines={dialogue}
        characters={project.characters ?? []}
        onChange={setDialogue}
      />

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
        suggestions={variableSuggestions}
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
        fragments={project.fragments}
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

      <View style={[styles.div, { backgroundColor: colors.border }]} />

      <StageComposer
        composition={stageAuthoring}
        onChange={setStageAuthoring}
        backgroundImage={bgImage}
        assets={project.assets}
        hotspots={hotspots}
        stageActors={stageActors}
        selectedObjectUid={focusedStageObjectUid}
        highlightedHotspotUid={focusedHotspotUid}
        onSelectObject={uid => {
          setFocusedStageObjectUid(uid);
          if (!uid) return;
          const object = stageAuthoring.objects.find(o => o.uid === uid);
          const ref = object?.hotspotRef ?? object?.interactionRef;
          if (ref) setFocusedHotspotUid(ref);
        }}
        onSelectHotspot={setFocusedHotspotUid}
        conditionSuggestions={variableSuggestions}
      />

      <View style={[styles.div, { backgroundColor: colors.border }]} />

      <StageActorEditor
        stageActors={stageActors}
        onChange={setStageActors}
        assets={project.assets}
        characters={project.characters ?? []}
        npcProfiles={project.npcProfiles ?? []}
        conditionSuggestions={variableSuggestions}
      />

      <View style={[styles.div, { backgroundColor: colors.border }]} />

      <TouchableOpacity
        style={[styles.templateBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
        onPress={() => setComponentBrowserOpen(true)}
      >
        <Feather name="layers" size={15} color={colors.primary} />
        <Text style={[styles.templateBtnText, { color: colors.primary }]}>Add gameplay component</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.templateBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
        onPress={() => setTemplatePickerOpen(true)}
      >
        <Feather name="zap" size={15} color={colors.primary} />
        <Text style={[styles.templateBtnText, { color: colors.primary }]}>Add gameplay template</Text>
      </TouchableOpacity>

      <HotspotEditor
        hotspots={hotspots}
        onChange={setHotspots}
        fragments={project.fragments}
        backgroundImage={bgImage}
        assets={project.assets}
        inventory={project.inventory ?? []}
        selectedUid={focusedHotspotUid}
        onSelectedUidChange={uid => {
          setFocusedHotspotUid(uid);
          if (!uid) return;
          const object = getObjectForHotspot(stageAuthoring, uid);
          if (object) setFocusedStageObjectUid(object.uid);
        }}
        linkedStageObjectLabel={linkedStageObject?.label || linkedStageObject?.asset}
      />

      <View style={[styles.div, { backgroundColor: colors.border }]} />

      <GameplayScenePreview project={project} fragment={inspectorFragment} />

      <SceneInspectorPanel
        fragment={inspectorFragment}
        project={project}
        focusedStageObjectUid={focusedStageObjectUid}
        focusedHotspotUid={focusedHotspotUid}
        linkedHotspotLabel={linkedHotspot?.label}
        linkedStageObjectLabel={linkedStageObject?.label || linkedStageObject?.asset}
      />

      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: colors.primary }]}
        onPress={doSave}
        activeOpacity={0.8}
      >
        <Feather name="check" size={17} color="#fff" />
        <Text style={styles.saveBtnText}>Save Scene</Text>
      </TouchableOpacity>

      {project && (
        <GameplayComponentBrowser
          visible={componentBrowserOpen}
          project={project}
          includeScenePatches
          onClose={() => setComponentBrowserOpen(false)}
          onInsert={({ result }) => {
            const merged = mergeGameplayComponentPatch(project, result.patch);
            updateProject(project.id, merged);
            const patched = applyGameplayComponentToFragment(
              { ...fragment!, hotspots, stageActors },
              result.patch,
            );
            if (patched.hotspots) setHotspots(patched.hotspots);
            if (patched.stageActors) setStageActors(patched.stageActors);
            if (result.patch.suggestedConditions?.length) {
              setConditions(prev => [...prev, ...result.patch.suggestedConditions!.filter(c => !prev.includes(c))]);
            }
            if (result.patch.suggestedEffects?.length) {
              setEffects(prev => [...prev, ...result.patch.suggestedEffects!.filter(e => !prev.includes(e))]);
            }
          }}
        />
      )}

      {project && (
        <GameplayTemplatePicker
          visible={templatePickerOpen}
          project={project}
          includeScenePatches
          onClose={() => setTemplatePickerOpen(false)}
          onApply={({ result }) => {
            const merged = mergeGameplayTemplateCatalogs(project, result.catalog);
            updateProject(project.id, merged);
            if (result.fragment) {
              const patched = applyGameplayTemplateToFragment(
                { ...fragment!, hotspots, stageActors },
                result.fragment,
              );
              if (patched.hotspots) setHotspots(patched.hotspots);
              if (patched.stageActors) setStageActors(patched.stageActors);
              if (result.fragment.suggestedConditions?.length) {
                setConditions(prev => [...prev, ...result.fragment!.suggestedConditions!.filter(c => !prev.includes(c))]);
              }
            }
          }}
        />
      )}
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
  templateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingVertical: 12 },
  templateBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10, paddingVertical: 14, marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
