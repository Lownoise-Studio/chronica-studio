import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useProjects } from '@/context/ProjectsContext';
import { useAdvancedMode } from '@/context/AdvancedModeContext';
import { syncGameplayCatalogsToInitialState, validateGameplayCatalogs } from '@/engine/gameplay-authoring';
import { mergeGameplayTemplateCatalogs } from '@/engine/gameplay-templates';
import { mergeGameplayComponentPatch } from '@/engine/gameplay-components';
import { GameplayTemplatePicker } from '@/components/GameplayTemplatePicker';
import { GameplayComponentBrowser } from '@/components/GameplayComponentBrowser';
import type {
  GameObjective,
  GameplayVariable,
  InventoryItem,
  NpcStateProfile,
  ObjectivePresentation,
  StageActorGameplayState,
  WorldStateCategory,
  WorldStateFlag,
} from '@/engine/types';

function slugify(value: string): string {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return slug || 'entry';
}

function uniqueId(base: string, existing: Set<string>): string {
  let candidate = base;
  let suffix = 2;
  while (existing.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  return candidate;
}

const OBJECTIVE_STATUSES: ObjectivePresentation[] = ['active', 'completed', 'failed', 'hidden'];
const WORLD_CATEGORIES: WorldStateCategory[] = ['door', 'bridge', 'light', 'enemy', 'npc', 'custom'];
const NPC_STATES: StageActorGameplayState[] = ['idle', 'following', 'hidden', 'hostile', 'friendly', 'disabled'];

function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T | undefined;
  onChange: (next: T) => void;
}) {
  const colors = useColors();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
      {options.map(option => {
        const selected = value === option;
        return (
          <TouchableOpacity
            key={option}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? colors.primary + '22' : colors.muted,
                borderColor: selected ? colors.primary : colors.border,
              },
            ]}
            onPress={() => onChange(option)}
          >
            <Text style={[styles.chipText, { color: selected ? colors.primary : colors.foreground }]}>{option}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export default function GameplayScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { advancedMode } = useAdvancedMode();
  const { getProject, updateProject } = useProjects();
  const project = getProject(projectId!);

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [objectives, setObjectives] = useState<GameObjective[]>([]);
  const [worldState, setWorldState] = useState<WorldStateFlag[]>([]);
  const [gameplayVariables, setGameplayVariables] = useState<GameplayVariable[]>([]);
  const [npcProfiles, setNpcProfiles] = useState<NpcStateProfile[]>([]);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [componentBrowserOpen, setComponentBrowserOpen] = useState(false);

  useEffect(() => {
    if (!project) return;
    setInventory(project.inventory ?? []);
    setObjectives(project.objectives ?? []);
    setWorldState(project.worldState ?? []);
    setGameplayVariables(project.gameplayVariables ?? []);
    setNpcProfiles(project.npcProfiles ?? []);
  }, [project?.id, project?.updatedAt]);

  const imageAssets = useMemo(
    () => (project?.assets ?? []).filter(a => a.type === 'image').map(a => a.name),
    [project?.assets],
  );

  const catalogIssues = useMemo(() => {
    if (!project) return [];
    return validateGameplayCatalogs({
      ...project,
      inventory,
      objectives,
      worldState,
      gameplayVariables,
      npcProfiles,
    });
  }, [project, inventory, objectives, worldState, gameplayVariables, npcProfiles]);

  const save = () => {
    if (!project) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const draft = {
      ...project,
      inventory,
      objectives,
      worldState,
      gameplayVariables,
      npcProfiles,
    };
    const synced = syncGameplayCatalogsToInitialState(draft);
    updateProject(project.id, {
      inventory,
      objectives,
      worldState,
      gameplayVariables,
      npcProfiles,
      initialVariables: synced.initialVariables,
      initialMemory: synced.initialMemory,
    });
    router.back();
  };

  if (!project) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, padding: 16 }]}>
        <Text style={{ color: colors.foreground }}>Project not found</Text>
      </View>
    );
  }

  const addInventoryItem = () => {
    const ids = new Set(inventory.map(i => i.id));
    const label = `Item ${inventory.length + 1}`;
    const id = uniqueId(slugify(label), ids);
    setInventory([
      ...inventory,
      {
        id,
        label,
        assetName: imageAssets[0] ?? '',
        stateKey: `variables.has_${id}`,
        stateKind: 'variable',
      },
    ]);
  };

  const addObjective = () => {
    const ids = new Set(objectives.map(o => o.id));
    const title = `Objective ${objectives.length + 1}`;
    const id = uniqueId(slugify(title), ids);
    setObjectives([
      ...objectives,
      { id, title, presentation: 'active', completeWhen: `memory.${id}_done == true` },
    ]);
  };

  const addWorldFlag = () => {
    const ids = new Set(worldState.map(w => w.id));
    const label = `World flag ${worldState.length + 1}`;
    const id = uniqueId(slugify(label), ids);
    setWorldState([
      ...worldState,
      {
        id,
        label,
        category: 'custom',
        stateKey: `memory.${id}`,
        stateKind: 'memory',
        initialValue: false,
      },
    ]);
  };

  const addGameplayVariable = () => {
    const ids = new Set(gameplayVariables.map(v => v.id));
    const label = `Variable ${gameplayVariables.length + 1}`;
    const id = uniqueId(slugify(label), ids);
    const key = uniqueId(slugify(label), new Set(gameplayVariables.map(v => v.key)));
    setGameplayVariables([
      ...gameplayVariables,
      { id, key, label, kind: 'boolean', initialValue: false },
    ]);
  };

  const addNpcProfile = () => {
    const ids = new Set(npcProfiles.map(n => n.id));
    const label = `NPC ${npcProfiles.length + 1}`;
    const id = uniqueId(slugify(label), ids);
    setNpcProfiles([
      ...npcProfiles,
      {
        id,
        label,
        defaultState: 'idle',
        stateVariable: `variables.${id}_state`,
        metFlag: `memory.met_${id}`,
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: Platform.OS === 'web' ? 16 : 0 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.foreground }]}>Gameplay</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setComponentBrowserOpen(true)} style={[styles.templateBtn, { borderColor: colors.border }]}>
            <Feather name="layers" size={14} color={colors.primary} />
            <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>Components</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTemplatePickerOpen(true)} style={[styles.templateBtn, { borderColor: colors.border }]}>
            <Feather name="zap" size={14} color={colors.primary} />
            <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>Template</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={save}>
            <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 15 }}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={[styles.lead, { color: colors.mutedForeground }]}>
        Define inventory, objectives, world flags, variables, and NPC states. Gameplay still runs through
        existing variables, memory, conditions, and actions — no scripting required.
      </Text>

      {catalogIssues.length > 0 && (
        <TouchableOpacity
          style={[styles.issueBanner, { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '55' }]}
          onPress={() => Alert.alert('Gameplay catalog issues', catalogIssues.map(i => `• ${i.catalog}/${i.id}: ${i.message}`).join('\n'))}
        >
          <Feather name="alert-circle" size={14} color={colors.destructive} />
          <Text style={[styles.issueText, { color: colors.destructive }]}>
            {catalogIssues.length} catalog issue{catalogIssues.length !== 1 ? 's' : ''}
          </Text>
        </TouchableOpacity>
      )}

      <Section title="Inventory" onAdd={addInventoryItem}>
        {inventory.length === 0 ? (
          <EmptyHint text="Items link to assets and map to variables.has_* or memory.* flags." />
        ) : inventory.map((item, index) => (
          <CatalogCard key={item.id} onRemove={() => setInventory(inventory.filter((_, i) => i !== index))}>
            <Field label="Label" value={item.label} onChange={label => {
              const next = [...inventory]; next[index] = { ...item, label }; setInventory(next);
            }} />
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Asset</Text>
            <ChipRow
              options={imageAssets.length ? imageAssets : ['(add images first)']}
              value={item.assetName}
              onChange={assetName => {
                const next = [...inventory]; next[index] = { ...item, assetName }; setInventory(next);
              }}
            />
            {advancedMode && (
              <Field label="State key" value={item.stateKey} onChange={stateKey => {
                const next = [...inventory]; next[index] = { ...item, stateKey }; setInventory(next);
              }} mono />
            )}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Stored in</Text>
            <ChipRow
              options={['variable', 'memory'] as const}
              value={item.stateKind}
              onChange={stateKind => {
                const next = [...inventory]; next[index] = { ...item, stateKind }; setInventory(next);
              }}
            />
            <ToggleRow
              label="Consumable"
              value={!!item.consumable}
              onChange={consumable => {
                const next = [...inventory]; next[index] = { ...item, consumable }; setInventory(next);
              }}
            />
          </CatalogCard>
        ))}
      </Section>

      <Section title="Objectives" onAdd={addObjective}>
        {objectives.length === 0 ? (
          <EmptyHint text="Objectives expose completeWhen / failWhen conditions you can reuse in scenes." />
        ) : objectives.map((objective, index) => (
          <CatalogCard key={objective.id} onRemove={() => setObjectives(objectives.filter((_, i) => i !== index))}>
            <Field label="Title" value={objective.title} onChange={title => {
              const next = [...objectives]; next[index] = { ...objective, title }; setObjectives(next);
            }} />
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Presentation</Text>
            <ChipRow
              options={OBJECTIVE_STATUSES}
              value={objective.presentation}
              onChange={presentation => {
                const next = [...objectives]; next[index] = { ...objective, presentation }; setObjectives(next);
              }}
            />
            <Field label="Complete when" value={objective.completeWhen} onChange={completeWhen => {
              const next = [...objectives]; next[index] = { ...objective, completeWhen }; setObjectives(next);
            }} mono={advancedMode} />
            {advancedMode && (
              <>
                <Field label="Fail when" value={objective.failWhen ?? ''} onChange={failWhen => {
                  const next = [...objectives]; next[index] = { ...objective, failWhen }; setObjectives(next);
                }} mono />
                <Field label="Reveal when" value={objective.revealWhen ?? ''} onChange={revealWhen => {
                  const next = [...objectives]; next[index] = { ...objective, revealWhen }; setObjectives(next);
                }} mono />
              </>
            )}
          </CatalogCard>
        ))}
      </Section>

      <Section title="World state" onAdd={addWorldFlag}>
        {worldState.length === 0 ? (
          <EmptyHint text="Doors, lights, bridges, and other persistent flags scenes can react to." />
        ) : worldState.map((flag, index) => (
          <CatalogCard key={flag.id} onRemove={() => setWorldState(worldState.filter((_, i) => i !== index))}>
            <Field label="Label" value={flag.label} onChange={label => {
              const next = [...worldState]; next[index] = { ...flag, label }; setWorldState(next);
            }} />
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Category</Text>
            <ChipRow
              options={WORLD_CATEGORIES}
              value={flag.category}
              onChange={category => {
                const next = [...worldState]; next[index] = { ...flag, category }; setWorldState(next);
              }}
            />
            {advancedMode && (
              <Field label="State key" value={flag.stateKey} onChange={stateKey => {
                const next = [...worldState]; next[index] = { ...flag, stateKey }; setWorldState(next);
              }} mono />
            )}
          </CatalogCard>
        ))}
      </Section>

      <Section title="Gameplay variables" onAdd={addGameplayVariable}>
        {gameplayVariables.length === 0 ? (
          <EmptyHint text="Designer-friendly counters and flags — synced to initial variables on save." />
        ) : gameplayVariables.map((variable, index) => (
          <CatalogCard key={variable.id} onRemove={() => setGameplayVariables(gameplayVariables.filter((_, i) => i !== index))}>
            <Field label="Label" value={variable.label} onChange={label => {
              const next = [...gameplayVariables]; next[index] = { ...variable, label }; setGameplayVariables(next);
            }} />
            <Field label="Key" value={variable.key} onChange={key => {
              const next = [...gameplayVariables]; next[index] = { ...variable, key }; setGameplayVariables(next);
            }} mono />
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Kind</Text>
            <ChipRow
              options={['boolean', 'number', 'string', 'counter'] as const}
              value={variable.kind}
              onChange={kind => {
                const next = [...gameplayVariables];
                const initialValue = kind === 'number' || kind === 'counter' ? 0 : kind === 'string' ? '' : false;
                next[index] = { ...variable, kind, initialValue };
                setGameplayVariables(next);
              }}
            />
            <Field
              label="Initial value"
              value={String(variable.initialValue)}
              onChange={raw => {
                const next = [...gameplayVariables];
                let initialValue: boolean | number | string = raw;
                if (raw === 'true') initialValue = true;
                else if (raw === 'false') initialValue = false;
                else if (!isNaN(Number(raw)) && raw.trim() !== '') initialValue = Number(raw);
                next[index] = { ...variable, initialValue };
                setGameplayVariables(next);
              }}
              mono={advancedMode}
            />
          </CatalogCard>
        ))}
      </Section>

      <Section title="NPC profiles" onAdd={addNpcProfile}>
        {npcProfiles.length === 0 ? (
          <EmptyHint text="Link cast members to default posture and suggested state paths for stage actors." />
        ) : npcProfiles.map((profile, index) => (
          <CatalogCard key={profile.id} onRemove={() => setNpcProfiles(npcProfiles.filter((_, i) => i !== index))}>
            <Field label="Label" value={profile.label} onChange={label => {
              const next = [...npcProfiles]; next[index] = { ...profile, label }; setNpcProfiles(next);
            }} />
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Default state</Text>
            <ChipRow
              options={NPC_STATES}
              value={profile.defaultState}
              onChange={defaultState => {
                const next = [...npcProfiles]; next[index] = { ...profile, defaultState }; setNpcProfiles(next);
              }}
            />
            {advancedMode && (
              <>
                <Field label="State variable" value={profile.stateVariable ?? ''} onChange={stateVariable => {
                  const next = [...npcProfiles]; next[index] = { ...profile, stateVariable }; setNpcProfiles(next);
                }} mono />
                <Field label="Met flag" value={profile.metFlag ?? ''} onChange={metFlag => {
                  const next = [...npcProfiles]; next[index] = { ...profile, metFlag }; setNpcProfiles(next);
                }} mono />
              </>
            )}
          </CatalogCard>
        ))}
      </Section>

      <Section title="Gameplay Components" onAdd={() => setComponentBrowserOpen(true)}>
        <EmptyHint text="Insert reusable prefabs — treasure chests, doors, NPCs, collectibles, switches, and checkpoints. Generated catalogs remain fully editable." />
      </Section>

      <GameplayComponentBrowser
        visible={componentBrowserOpen}
        project={{
          ...project,
          inventory,
          objectives,
          worldState,
          gameplayVariables,
          npcProfiles,
          fragments: project.fragments,
        }}
        onClose={() => setComponentBrowserOpen(false)}
        onInsert={({ result }) => {
          const merged = mergeGameplayComponentPatch(
            { ...project, inventory, objectives, worldState, gameplayVariables, npcProfiles },
            result.patch,
          );
          setInventory(merged.inventory ?? []);
          setObjectives(merged.objectives ?? []);
          setWorldState(merged.worldState ?? []);
          setGameplayVariables(merged.gameplayVariables ?? []);
          setNpcProfiles(merged.npcProfiles ?? []);
        }}
      />

      <GameplayTemplatePicker
        visible={templatePickerOpen}
        project={{
          ...project,
          inventory,
          objectives,
          worldState,
          gameplayVariables,
          npcProfiles,
          fragments: project.fragments,
        }}
        onClose={() => setTemplatePickerOpen(false)}
        onApply={({ result }) => {
          const merged = mergeGameplayTemplateCatalogs(
            { ...project, inventory, objectives, worldState, gameplayVariables, npcProfiles },
            result.catalog,
          );
          setInventory(merged.inventory ?? []);
          setObjectives(merged.objectives ?? []);
          setWorldState(merged.worldState ?? []);
          setGameplayVariables(merged.gameplayVariables ?? []);
          setNpcProfiles(merged.npcProfiles ?? []);
        }}
      />
    </ScrollView>
  );
}

function Section({ title, onAdd, children }: { title: string; onAdd: () => void; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
        <TouchableOpacity onPress={onAdd} style={[styles.addBtn, { borderColor: colors.border }]}>
          <Feather name="plus" size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>
      {children}
    </View>
  );
}

function CatalogCard({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity style={styles.cardRemove} onPress={onRemove}>
        <Feather name="trash-2" size={14} color={colors.destructive} />
      </TouchableOpacity>
      {children}
    </View>
  );
}

function Field({
  label, value, onChange, mono,
}: {
  label: string; value: string; onChange: (v: string) => void; mono?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          {
            color: colors.foreground,
            borderColor: colors.border,
            fontFamily: mono ? 'Inter_400Regular' : 'Inter_400Regular',
          },
        ]}
        value={value}
        onChangeText={onChange}
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const colors = useColors();
  return (
    <TouchableOpacity style={styles.toggleRow} onPress={() => onChange(!value)}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Feather name={value ? 'check-square' : 'square'} size={16} color={value ? colors.primary : colors.mutedForeground} />
    </TouchableOpacity>
  );
}

function EmptyHint({ text }: { text: string }) {
  const colors = useColors();
  return <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 8 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  templateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  title: { fontSize: 20, fontFamily: 'Inter_600SemiBold' },
  lead: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_400Regular', marginBottom: 16 },
  issueBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 12 },
  issueText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  section: { marginBottom: 20, gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  addBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 8 },
  cardRemove: { alignSelf: 'flex-end' },
  field: { gap: 4 },
  fieldLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.6 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  chipsRow: { gap: 6, paddingVertical: 2 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  emptyHint: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
});
