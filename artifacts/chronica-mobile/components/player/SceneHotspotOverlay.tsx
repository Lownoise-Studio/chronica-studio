import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { HotspotPreviewCanvas } from '@/components/HotspotPreviewCanvas';
import { SceneHotspot } from '@/engine/types';

type SceneHotspotOverlayProps = {
  hotspots: SceneHotspot[];
  onActivate: (hotspot: SceneHotspot) => void;
  style?: ViewStyle;
};

/** Tap regions over a parent-provided scene stage. */
export function SceneHotspotOverlay({ hotspots, onActivate, style }: SceneHotspotOverlayProps) {
  if (!hotspots.length) return null;

  return (
    <View style={[StyleSheet.absoluteFillObject, style]} pointerEvents="box-none">
      <HotspotPreviewCanvas
        hotspots={hotspots}
        mode="play"
        regionsOnly
        onActivate={onActivate}
      />
    </View>
  );
}
