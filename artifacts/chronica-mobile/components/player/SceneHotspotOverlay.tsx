import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { SceneHotspot } from '@/engine/types';
import { ScenePlayHotspots } from '@/components/player/ScenePlayHotspots';

type SceneHotspotOverlayProps = {
  hotspots: SceneHotspot[];
  onActivate: (hotspot: SceneHotspot) => void;
  showGuidance?: boolean;
  style?: ViewStyle;
};

/** Tap regions over a parent-provided scene stage during play. */
export function SceneHotspotOverlay({
  hotspots,
  onActivate,
  showGuidance = false,
  style,
}: SceneHotspotOverlayProps) {
  if (!hotspots.length) return null;

  return (
    <View style={[StyleSheet.absoluteFillObject, style]} pointerEvents="box-none">
      <ScenePlayHotspots
        hotspots={hotspots}
        onActivate={onActivate}
        showGuidance={showGuidance}
      />
    </View>
  );
}
