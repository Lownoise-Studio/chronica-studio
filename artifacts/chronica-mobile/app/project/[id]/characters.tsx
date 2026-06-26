import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useProjects } from '@/context/ProjectsContext';
import { useAdvancedMode } from '@/context/AdvancedModeContext';
import { EmptyState } from '@/components/EmptyState';
import { createId } from '@/engine/identity';
import type { Character, CharacterExpression } from '@/engine/types';

function slugify(value: string): string {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'character';
}

function uniqueCharacterId(base: string, existing: Set<string>): string {
  let candidate = base;
  let suffix = 2;
  while (existing.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export default function CharactersScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const navigation = useNavigation();
  const { advancedMode } = useAdvancedMode();
  const { getProject, updateProject } = useProjects();

  const project = getProject(projectId!);
  const characters = project?.characters ?? [];
  const imageAssets = useMemo(
    () => (project?.assets ?? []).filter(a => a.type === 'image').map(a => a.name),
    [project?.assets],
  );

  const [selectedUid, setSelectedUid] = useState<string | null>(characters[0]?.uid ?? null);

  useEffect(() => {
    if (project) navigation.setOptions({ title: 'Cast' });
  }, [project?.title]);

  useEffect(() => {
    if (!characters.length) {
      setSelectedUid(null);
      return;
    }
    if (!selectedUid || !characters.some(c => c.uid === selectedUid)) {
      setSelectedUid(characters[0]!.uid);
    }
  }, [characters, selectedUid]);

  const selected = characters.find(c => c.uid === selectedUid);

  const persistCharacters = (next: Character[]) => {
    if (!project) return;
    updateProject(project.id, { characters: next });
  };

  const addCharacter = () => {
    if (!project) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const existingIds = new Set(characters.map(c => c.characterId));
    const displayName = `Character ${characters.length + 1}`;
    const characterId = uniqueCharacterId(slugify(displayName), existingIds);
    const next: Character = {
      uid: createId(),
      characterId,
      displayName,
    };
    persistCharacters([...characters, next]);
    setSelectedUid(next.uid);
  };

  const updateCharacter = (uid: string, patch: Partial<Character>) => {
    persistCharacters(characters.map(c => (c.uid === uid ? { ...c, ...patch } : c)));
  };

  const deleteCharacter = (character: Character) => {
    Alert.alert('Delete Character', `Remove "${character.displayName}" from the cast?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          persistCharacters(characters.filter(c => c.uid !== character.uid));
        },
      },
    ]);
  };

  const addExpression = (uid: string) => {
    const character = characters.find(c => c.uid === uid);
    if (!character) return;
    const expressions = [...(character.expressions ?? [])];
    const id = `expr-${expressions.length + 1}`;
    expressions.push({ id, label: `Expression ${expressions.length + 1}`, portrait: '' });
    updateCharacter(uid, { expressions });
  };

  const updateExpression = (uid: string, index: number, patch: Partial<CharacterExpression>) => {
    const character = characters.find(c => c.uid === uid);
    if (!character) return;
    const expressions = [...(character.expressions ?? [])];
    expressions[index] = { ...expressions[index]!, ...patch };
    updateCharacter(uid, { expressions });
  };

  const removeExpression = (uid: string, index: number) => {
    const character = characters.find(c => c.uid === uid);
    if (!character) return;
    updateCharacter(uid, {
      expressions: (character.expressions ?? []).filter((_, i) => i !== index),
    });
  };

  if (!project) {
    return (
      <View style={[styles.fill, { backgroundColor: colors.background }]}>
        <EmptyState icon="alert-circle" title="Story not found" />
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.castRow, { borderBottomColor: colors.border }]}
      >
        {characters.map(character => {
          const active = character.uid === selectedUid;
          return (
            <TouchableOpacity
              key={character.uid}
              style={[styles.castChip, {
                backgroundColor: active ? colors.primary + '22' : colors.secondary,
                borderColor: active ? colors.primary : colors.border,
              }]}
              onPress={() => setSelectedUid(character.uid)}
            >
              <Text style={[styles.castChipText, { color: active ? colors.primary : colors.foreground }]}>
                {character.displayName}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity style={[styles.addChip, { borderColor: colors.border }]} onPress={addCharacter}>
          <Feather name="plus" size={14} color={colors.primary} />
          <Text style={[styles.addChipText, { color: colors.primary }]}>Add</Text>
        </TouchableOpacity>
      </ScrollView>

      {!selected ? (
        <EmptyState
          icon="users"
          title="No characters yet"
          message="Create cast members with portraits and expressions for dialogue."
          actionLabel="Add Character"
          onAction={addCharacter}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.editor}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.editorHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Character</Text>
            <TouchableOpacity onPress={() => deleteCharacter(selected)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="trash-2" size={16} color={colors.destructive} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { color: colors.mutedForeground }]}>DISPLAY NAME</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            value={selected.displayName}
            onChangeText={displayName => updateCharacter(selected.uid, { displayName })}
            placeholder="Elena"
            placeholderTextColor={colors.mutedForeground}
          />

          {advancedMode && (
            <>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>CHARACTER ID</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                value={selected.characterId}
                onChangeText={characterId => updateCharacter(selected.uid, { characterId: slugify(characterId) })}
                placeholder="elena"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                Referenced by dialogue lines as speakerId
              </Text>
            </>
          )}

          <Text style={[styles.label, { color: colors.mutedForeground }]}>DEFAULT PORTRAIT</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            value={selected.defaultPortrait ?? ''}
            onChangeText={defaultPortrait => updateCharacter(selected.uid, { defaultPortrait })}
            placeholder={imageAssets[0] ?? 'portrait.png'}
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {imageAssets.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.assetRow}>
              {imageAssets.map(name => {
                const active = selected.defaultPortrait === name;
                return (
                  <TouchableOpacity
                    key={name}
                    style={[styles.assetChip, {
                      backgroundColor: active ? colors.primary + '22' : colors.secondary,
                      borderColor: active ? colors.primary : colors.border,
                    }]}
                    onPress={() => updateCharacter(selected.uid, { defaultPortrait: name })}
                  >
                    <Text style={[styles.assetChipText, { color: active ? colors.primary : colors.foreground }]}>{name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
          {!!selected.defaultPortrait && imageAssets.includes(selected.defaultPortrait) && (
            <Image
              source={{ uri: project.assets.find(a => a.name === selected.defaultPortrait)?.uri }}
              style={styles.preview}
            />
          )}

          <View style={[styles.div, { backgroundColor: colors.border }]} />

          <View style={styles.editorHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Expressions</Text>
            <TouchableOpacity onPress={() => addExpression(selected.uid)}>
              <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>Add</Text>
            </TouchableOpacity>
          </View>

          {(selected.expressions ?? []).length === 0 ? (
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Optional mood portraits (happy, angry, etc.)
            </Text>
          ) : (
            (selected.expressions ?? []).map((expression, index) => (
              <View key={expression.id} style={[styles.expressionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.editorHeader}>
                  <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>Expression {index + 1}</Text>
                  <TouchableOpacity onPress={() => removeExpression(selected.uid, index)}>
                    <Feather name="trash-2" size={14} color={colors.destructive} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>ID</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                  value={expression.id}
                  onChangeText={id => updateExpression(selected.uid, index, { id: slugify(id) })}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={[styles.label, { color: colors.mutedForeground }]}>LABEL</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                  value={expression.label ?? ''}
                  onChangeText={label => updateExpression(selected.uid, index, { label })}
                />
                <Text style={[styles.label, { color: colors.mutedForeground }]}>PORTRAIT</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                  value={expression.portrait}
                  onChangeText={portrait => updateExpression(selected.uid, index, { portrait })}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {imageAssets.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.assetRow}>
                    {imageAssets.map(name => {
                      const active = expression.portrait === name;
                      return (
                        <TouchableOpacity
                          key={name}
                          style={[styles.assetChip, {
                            backgroundColor: active ? colors.primary + '22' : colors.secondary,
                            borderColor: active ? colors.primary : colors.border,
                          }]}
                          onPress={() => updateExpression(selected.uid, index, { portrait: name })}
                        >
                          <Text style={[styles.assetChipText, { color: active ? colors.primary : colors.foreground }]}>{name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            ))
          )}

          {Platform.OS === 'web' ? <View style={{ height: 24 }} /> : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  castRow: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  castChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  castChipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addChipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  editor: { padding: 16, gap: 10, paddingBottom: 40 },
  editorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  cardTitle: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.8 },
  label: { fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4 },
  hint: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  input: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'Inter_400Regular' },
  assetRow: { gap: 8, paddingVertical: 4 },
  assetChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  assetChipText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  preview: { width: 96, height: 96, borderRadius: 12, marginTop: 4 },
  div: { height: 1, marginVertical: 8 },
  expressionCard: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 },
});
