import { buildCompiledGame } from '../engine/compiler/build-compiled-game';
import {
  advanceDialogueIndex,
  canAdvanceDialogue,
  getFragmentDialogueLines,
  isDialogueExhausted,
  syncFragmentTextFromDialogue,
} from '../engine/dialogue';
import { resolveDialoguePresentation } from '../engine/dialogue-presentation';
import { ChronicaRuntime } from '../runtime/chronica-runtime';
import { compileProject } from '../engine/compiler';
import type { Character, Fragment, Project } from '../engine/types';

function makeProject(fragments: Fragment[], overrides: Partial<Project> = {}): Project {
  return {
    schemaVersion: 3,
    gameId: 'a0000001-0000-4000-8000-000000000099',
    id: 'install-1',
    title: 'Dialogue Test',
    description: '',
    startLocation: 'intro',
    initialVariables: {},
    initialMemory: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    assets: [],
    characters: [],
    fragments,
    ...overrides,
  };
}

const elena: Character = {
  uid: 'char-1',
  characterId: 'elena',
  displayName: 'Elena',
  defaultPortrait: 'elena-neutral.png',
};

describe('dialogue helpers', () => {
  it('falls back to legacy fragment.text when dialogue is missing', () => {
    const fragment: Fragment = {
      uid: 'f1',
      title: 'Intro',
      locationId: 'intro',
      priority: 0,
      conditions: [],
      effects: [],
      text: 'Hello world.',
      choices: [],
    };
    expect(getFragmentDialogueLines(fragment)).toEqual([
      { uid: 'f1-legacy', text: 'Hello world.' },
    ]);
  });

  it('syncs flattened text from dialogue lines', () => {
    const text = syncFragmentTextFromDialogue([
      { uid: 'l1', text: 'Line one.' },
      { uid: 'l2', text: 'Line two.' },
    ]);
    expect(text).toBe('Line one.\n\nLine two.');
  });

  it('tracks exhaustion and advance eligibility', () => {
    expect(canAdvanceDialogue(0, 3)).toBe(true);
    expect(isDialogueExhausted(0, 3)).toBe(false);
    expect(advanceDialogueIndex(0, 3)).toBe(1);
    expect(canAdvanceDialogue(2, 3)).toBe(false);
    expect(isDialogueExhausted(2, 3)).toBe(true);
  });
});

describe('dialogue presentation', () => {
  it('resolves speaker name and narration mode', () => {
    const fragment: Fragment = {
      uid: 'f1',
      title: 'Intro',
      locationId: 'intro',
      priority: 0,
      conditions: [],
      effects: [],
      text: '',
      dialogue: [
        { uid: 'l1', speakerId: 'elena', text: 'Hi there.' },
        { uid: 'l2', speakerId: null, text: 'The room is quiet.' },
      ],
      choices: [],
    };

    const spoken = resolveDialoguePresentation(fragment, [elena], [], 0);
    expect(spoken?.speakerName).toBe('Elena');
    expect(spoken?.isNarration).toBe(false);
    expect(spoken?.canAdvance).toBe(true);

    const narration = resolveDialoguePresentation(fragment, [elena], [], 1);
    expect(narration?.isNarration).toBe(true);
    expect(narration?.exhausted).toBe(true);
  });
});

describe('runtime tap-to-advance', () => {
  const fragments: Fragment[] = [
    {
      uid: 'f1',
      title: 'Intro',
      locationId: 'intro',
      priority: 0,
      conditions: [],
      effects: [],
      text: 'One.\n\nTwo.',
      dialogue: [
        { uid: 'l1', speakerId: null, text: 'One.' },
        { uid: 'l2', speakerId: null, text: 'Two.' },
      ],
      choices: [{ uid: 'c1', label: 'Next', action: 'goto:forest', conditions: [] }],
    },
    {
      uid: 'f2',
      title: 'Forest',
      locationId: 'forest',
      priority: 0,
      conditions: [],
      effects: [],
      text: 'Trees.',
      choices: [],
    },
  ];

  it('hides choices until dialogue is exhausted', () => {
    const game = buildCompiledGame(makeProject(fragments));
    const rt = new ChronicaRuntime(game);
    rt.start();

    expect(rt.visibleChoices).toHaveLength(0);
    expect(rt.getDialoguePresentation()?.canAdvance).toBe(true);

    const first = rt.advanceDialogue();
    expect(first).toEqual({ ok: true, advanced: true });
    expect(rt.getDialoguePresentation()?.exhausted).toBe(true);
    expect(rt.visibleChoices).toHaveLength(1);
  });

  it('resets dialogue index when changing location', () => {
    const result = compileProject(makeProject(fragments));
    if (!result.ok) throw new Error('compile failed');
    const rt = new ChronicaRuntime(result.game);
    rt.start();
    rt.advanceDialogue();
    expect(rt.runtimeState?.dialogueLineIndex).toBe(1);

    const choice = rt.visibleChoices[0]!;
    rt.choose(choice);
    expect(rt.runtimeState?.dialogueLineIndex).toBe(0);
    expect(rt.currentFragment?.locationId).toBe('forest');
  });
});
