import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { HotspotPreviewCanvas } from '@/components/HotspotPreviewCanvas';
import { SceneHotspot } from '@/engine/types';
import type { SceneOption } from '@/engine/editor-helpers';

type SceneHotspotOverlayProps = {
  hotspots: SceneHotspot[];
  sceneOptions?: SceneOption[];
  onActivate: (hotspot: SceneHotspot) => void;
  style?: ViewStyle;
};

/** Tap regions over a parent-provided scene stage during playtest. */
export function SceneHotspotOverlay({
  hotspots,
  sceneOptions,
  onActivate,
  style,
}: SceneHotspotOverlayProps) {
  if (!hotspots.length) return null;

  return (
    <View style={[StyleSheet.absoluteFillObject, style]} pointerEvents="box-none">
      <HotspotPreviewCanvas
        hotspots={hotspots}
        mode="play"
        regionsOnly
        sceneOptions={sceneOptions}
        onActivate={onActivate}
      />
    </View>
  );
}
