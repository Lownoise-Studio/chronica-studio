import {
  buildContractResult,
  contractError,
  type ContractValidationResult,
} from './contract-types';
import type { Fragment } from './types';
import type { PlayableRoomGeneratorOptions } from './playable-room-generator';
import { generatePlayableRoomFromAssets } from './playable-room-generator';
import type { Project } from './types';

export interface GeneratedRoomSnapshot {
  fragmentUid: string;
  locationId: string;
  backgroundImage?: string;
  backgroundAudio?: string;
  stageObjectUids: string[];
  interactableUids: string[];
  colliderUids: string[];
  adventure: Fragment['adventure'];
}

/** Stable snapshot of generator output for determinism comparisons. */
export function snapshotGeneratedRoom(fragment: Fragment): GeneratedRoomSnapshot {
  return {
    fragmentUid: fragment.uid,
    locationId: fragment.locationId,
    backgroundImage: fragment.backgroundImage,
    backgroundAudio: fragment.backgroundAudio,
    stageObjectUids: [...(fragment.stageAuthoring?.objects?.map(object => object.uid) ?? [])].sort(),
    interactableUids: [...(fragment.adventure?.interactables?.map(item => item.uid) ?? [])].sort(),
    colliderUids: [...(fragment.adventure?.colliders?.map(item => item.uid) ?? [])].sort(),
    adventure: fragment.adventure
      ? JSON.parse(JSON.stringify(fragment.adventure))
      : undefined,
  };
}

export function compareGeneratedRoomSnapshots(
  left: GeneratedRoomSnapshot,
  right: GeneratedRoomSnapshot,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** Verify repeated room generation with identical inputs produces identical output. */
export function validateRoomGeneratorDeterminism(
  project: Project,
  options: PlayableRoomGeneratorOptions = {},
): ContractValidationResult {
  const deterministicOptions: PlayableRoomGeneratorOptions = {
    ...options,
    createUid: options.createUid ?? (() => '00000000-0000-4000-8000-000000000010'),
    createActorUid: options.createActorUid ?? (() => '00000000-0000-4000-8000-000000000011'),
  };

  const first = generatePlayableRoomFromAssets(project, deterministicOptions);
  const second = generatePlayableRoomFromAssets(project, deterministicOptions);

  const left = snapshotGeneratedRoom(first.plan.patch!.fragment);
  const right = snapshotGeneratedRoom(second.plan.patch!.fragment);

  if (compareGeneratedRoomSnapshots(left, right)) {
    return buildContractResult([]);
  }

  return buildContractResult([
    contractError(
      'room-generator',
      'nondeterministic-output',
      'Repeated room generation with identical inputs produced different ids, colliders, or interactables.',
      left.fragmentUid,
    ),
  ]);
}
