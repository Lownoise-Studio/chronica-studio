import React from 'react';
import { StyleSheet, View } from 'react-native';
import { StagePreviewRenderer } from '@/components/stage/StagePreviewRenderer';
import { presentationOverlayPointerEvents } from '@/engine/stage-presentation';
import type { ChronicaState, ProjectAsset, StageComposition } from '@/engine/types';

/** Playtest-only decorative overlay — pointerEvents none so hotspots keep hit testing. */
export function StagePresentationOverlay({
  composition,
  assets,
  previewState,
  width,
  height,
}: {
  composition: StageComposition | undefined;
  assets: readonly ProjectAsset[];
  previewState?: ChronicaState | null;
  width: number;
  height: number;
}) {
  if (!width || !height) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={presentationOverlayPointerEvents()}>
      <StagePreviewRenderer
        composition={composition}
        assets={assets}
        canvasWidth={width}
        canvasHeight={height}
        previewState={previewState}
        mode="playtest"
        showHotspotLinks={false}
      />
    </View>
  );
}
