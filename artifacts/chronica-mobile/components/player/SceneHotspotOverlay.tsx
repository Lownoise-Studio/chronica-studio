import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SceneHotspot } from '@/engine/types';

type SceneHotspotOverlayProps = {
  hotspots: SceneHotspot[];
  onActivate: (hotspot: SceneHotspot) => void;
};

export function SceneHotspotOverlay({ hotspots, onActivate }: SceneHotspotOverlayProps) {
  if (!hotspots.length) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {hotspots.map(hotspot => (
        <Pressable
          key={hotspot.uid}
          style={[
            styles.region,
            {
              left: `${hotspot.x * 100}%`,
              top: `${hotspot.y * 100}%`,
              width: `${hotspot.width * 100}%`,
              height: `${hotspot.height * 100}%`,
            },
          ]}
          onPress={() => onActivate(hotspot)}
          accessibilityRole="button"
          accessibilityLabel={hotspot.label || 'Hotspot'}
        >
          {hotspot.label ? (
            <View style={styles.labelBadge}>
              <Text style={styles.labelText} numberOfLines={1}>
                {hotspot.label}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  region: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 6,
    justifyContent: 'flex-end',
    padding: 4,
  },
  labelBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: '100%',
  },
  labelText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
  },
});
