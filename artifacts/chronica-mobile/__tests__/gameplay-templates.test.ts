import { parseActionString } from '../engine/actions/parse-action';
import { compileProject } from '../engine/compiler';
import { buildCompiledGame } from '../engine/compiler/build-compiled-game';
import { activateHotspot, startSession } from '../engine/chronica-session';
import { isValidCondition } from '../engine/expression-evaluator';
import { validateGameplayCatalogs } from '../engine/gameplay-authoring';
import {
  buildGameplayTemplate,
  mergeGameplayTemplateCatalogs,
  validateGameplayTemplateResult,
  type GameplayTemplateKind,
} from '../engine/gameplay-templates';
import {
  buildHotspotInteractionFeedback,
  cloneState,
  getActiveObjectives,
  getCollectedInventoryItems,
  getCompletedObjectives,
} from '../engine/gameplay-feedback';
import type { ChronicaState, Project, SceneHotspot } from '../engine/types';

const ACTOR_UID = '00000000-0000-4000-8000-000000000001';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    schemaVersion: 3,
    gameId: 'a0000001-0000-4000-8000-000000000099',
    id: 'p1',
    title: 'Template Tale',
    description: '',
    startLocation: 'room',
    initialVariables: {},
    initialMemory: {},
    createdAt: '',
    updatedAt: '',
    assets: [{ id: 'a1', name: 'lantern.png', type: 'image', uri: 'file://lantern.png', mimeType: 'image/png', size: 1, importedAt: '' }],
    characters: [],
    fragments: [{
      uid: 'f1',
      title: 'Room',
      locationId: 'room',
      priority: 0,
      conditions: [],
      effects: [],
      text: 'A room.',
      choices: [],
    }],
    ...overrides,
  };
}

function buildTemplate(kind: GameplayTemplateKind, label: string, extra: Partial<Parameters<typeof buildGameplayTemplate>[0]> = {}) {
  return buildGameplayTemplate(
    { kind, label, includeObjective: true, ...extra },
    makeProject(),
    { createActorUid: () => ACTOR_UID },
  );
}

function assertActionsParse(action: string) {
  const parsed = parseActionString(action);
  expect(parsed.ok).toBe(true);
}

describe('gameplay templates', () => {
  const templateCases: Array<{ kind: GameplayTemplateKind; label: string; extra?: Partial<Parameters<typeof buildGameplayTemplate>[0]> }> = [
    { kind: 'collect-item', label: 'Lantern' },
    { kind: 'locked-door', label: 'Harbor gate', extra: { secondaryLabel: 'Rusty key' } },
    { kind: 'find-clue', label: 'Wet note', extra: { secondaryLabel: 'The ink is still wet.' } },
    { kind: 'talk-to-npc', label: 'Keeper' },
    { kind: 'simple-quest', label: 'Light the harbor', extra: { secondaryLabel: 'Lantern' } },
  ];

  test.each(templateCases)('$kind creates valid catalog entries', ({ kind, label, extra }) => {
    const project = makeProject();
    const result = buildTemplate(kind, label, extra);
    const validation = validateGameplayTemplateResult(project, result);
    expect(validation.ok).toBe(true);

    const merged = mergeGameplayTemplateCatalogs(project, result.catalog);
    const issues = validateGameplayCatalogs({ ...project, ...merged });
    expect(issues).toEqual([]);
  });

  test('collect-item actions and conditions use existing grammar', () => {
    const result = buildTemplate('collect-item', 'Lantern');
    const hotspot = result.fragment!.hotspot!;
    for (const condition of hotspot.conditions) {
      if (condition.trim()) expect(isValidCondition(condition)).toBe(true);
    }
    assertActionsParse(hotspot.action);
  });

  test('locked-door hotspot requires key and unlocks door flag', () => {
    const result = buildTemplate('locked-door', 'Cellar door', { secondaryLabel: 'Brass key' });
    const hotspot = result.fragment!.hotspot!;
    expect(hotspot.interactionKind).toBe('use-item');
    expect(hotspot.requiredItemId).toBeTruthy();
    expect(hotspot.action).toContain('_unlocked = true');
    for (const condition of hotspot.conditions) {
      expect(isValidCondition(condition)).toBe(true);
    }
    assertActionsParse(hotspot.action);
  });

  test('generated collect hotspot works with existing runtime', () => {
    const project = makeProject();
    const result = buildTemplate('collect-item', 'Lantern');
    const merged = mergeGameplayTemplateCatalogs(project, result.catalog);
    const hotspot = result.fragment!.hotspot as SceneHotspot;
    const withScene: Project = {
      ...project,
      ...merged,
      fragments: [{
        ...project.fragments[0],
        hotspots: [hotspot],
      }],
    };

    const compiled = compileProject(withScene);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const game = buildCompiledGame(withScene);
    const session = startSession(game);
    expect(session.state.variables.has_lantern).toBeFalsy();

    activateHotspot(hotspot, session.state, game);
    expect(session.state.variables.has_lantern).toBe(true);
  });

  test('generated objective appears in objective tracker', () => {
    const project = makeProject();
    const result = buildTemplate('collect-item', 'Lantern');
    const merged = mergeGameplayTemplateCatalogs(project, result.catalog);
    const full = { ...project, ...merged };

    const before: ChronicaState = {
      location: 'room',
      instability: 0,
      reality_layer: 0,
      memory: merged.initialMemory ?? {},
      variables: merged.initialVariables ?? {},
      dialogueLineIndex: 0,
    };
    expect(getActiveObjectives(full, before).some(o => o.title.includes('Lantern'))).toBe(true);

    const after: ChronicaState = {
      ...before,
      variables: { ...before.variables, has_lantern: true },
    };
    expect(getCompletedObjectives(full, after).some(o => o.title.includes('Lantern'))).toBe(true);
  });

  test('generated inventory item appears in inventory HUD data', () => {
    const project = makeProject();
    const result = buildTemplate('collect-item', 'Lantern');
    const merged = mergeGameplayTemplateCatalogs(project, result.catalog);
    const full = { ...project, ...merged };

    const emptyState: ChronicaState = {
      location: 'room',
      instability: 0,
      reality_layer: 0,
      memory: {},
      variables: {},
      dialogueLineIndex: 0,
    };
    expect(getCollectedInventoryItems(full, emptyState)).toEqual([]);

    const collectedState: ChronicaState = {
      ...emptyState,
      variables: { has_lantern: true },
    };
    const collected = getCollectedInventoryItems(full, collectedState);
    expect(collected.some(i => i.label === 'Lantern')).toBe(true);
  });

  test('collect-item hotspot produces pickup feedback message', () => {
    const project = makeProject();
    const result = buildTemplate('collect-item', 'Lantern');
    const merged = mergeGameplayTemplateCatalogs(project, result.catalog);
    const full = { ...project, ...merged };
    const hotspot = result.fragment!.hotspot!;

    const before: ChronicaState = {
      location: 'room',
      instability: 0,
      reality_layer: 0,
      memory: {},
      variables: {},
      dialogueLineIndex: 0,
    };
    const after: ChronicaState = {
      ...before,
      variables: { has_lantern: true },
    };
    expect(buildHotspotInteractionFeedback(full, hotspot, before, after)).toBe('Picked up Lantern');
  });

  test('talk-to-npc template links stage actor and met flag helpers', () => {
    const result = buildTemplate('talk-to-npc', 'Keeper');
    expect(result.catalog.npcProfiles?.[0].metFlag).toBe('memory.met_keeper');
    expect(result.fragment?.stageActor?.stateVariable).toBe('variables.keeper_state');
    expect(result.fragment?.suggestedConditions?.[0]).toBe('memory.met_keeper == true');
    assertActionsParse(result.fragment!.hotspot!.action);
  });

  test('find-clue template can suggest NPC dialogue condition', () => {
    const project = makeProject({
      npcProfiles: [{
        id: 'keeper',
        label: 'Keeper',
        defaultState: 'idle',
        stateVariable: 'variables.keeper_state',
        metFlag: 'memory.met_keeper',
      }],
    });
    const result = buildGameplayTemplate(
      { kind: 'find-clue', label: 'Ledger', secondaryLabel: 'Names are crossed out.', includeObjective: true, npcMetProfileId: 'keeper' },
      project,
    );
    expect(result.fragment?.suggestedConditions).toEqual(['memory.met_keeper == true']);
    assertActionsParse(result.fragment!.hotspot!.action);
  });

  test('simple quest template exposes completion action helper', () => {
    const result = buildTemplate('simple-quest', 'Find the lantern', { secondaryLabel: 'Lantern' });
    expect(result.catalog.objectives?.[0].completeWhen).toContain('variables.has_lantern == true');
    expect(result.fragment?.suggestedEffects?.[0]).toContain('_completed = true');
    for (const effect of result.fragment?.suggestedEffects ?? []) {
      assertActionsParse(effect);
    }
  });

  test('applying templates does not change compiler contract shape', () => {
    const project = makeProject();
    const baseline = compileProject(project);
    expect(baseline.ok).toBe(true);
    if (!baseline.ok) return;

    const result = buildTemplate('locked-door', 'Gate', { secondaryLabel: 'Key' });
    const merged = mergeGameplayTemplateCatalogs(project, result.catalog);
    const withTemplate = compileProject({
      ...project,
      ...merged,
      fragments: [{ ...project.fragments[0], hotspots: [result.fragment!.hotspot!] }],
    });
    expect(withTemplate.ok).toBe(true);
    if (!withTemplate.ok) return;

    expect(Object.keys(withTemplate.game.choiceActions)).toEqual(Object.keys(baseline.game.choiceActions));
    expect(withTemplate.game.hotspotActions[result.fragment!.hotspot!.uid]).toBeDefined();
    expect(withTemplate.game.version).toBe(baseline.game.version);
  });
});
