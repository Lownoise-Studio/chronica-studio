import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { SceneHotspot } from '@/engine/types';

type ScenePlayHotspotsProps = {
  hotspots: SceneHotspot[];
  onActivate: (hotspot: SceneHotspot) => void;
  /** When true, show a subtle pulse on interactable regions after narration. */
  showGuidance?: boolean;
  style?: ViewStyle;
};

function InvisibleHotspotRegion({
  hotspot,
  pixelBounds,
  showGuidance,
  onActivate,
}: {
  hotspot: SceneHotspot;
  pixelBounds: { left: number; top: number; width: number; height: number };
  showGuidance: boolean;
  onActivate: (hotspot: SceneHotspot) => void;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!showGuidance) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [showGuidance, pulse]);

  const shimmerOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.08, 0.28],
  });

  return (
    <Pressable
      style={[styles.hitRegion, pixelBounds]}
      onPress={() => onActivate(hotspot)}
      accessibilityRole="button"
      accessibilityLabel={hotspot.label || 'Scene interaction'}
    >
      {showGuidance && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, styles.guidanceShimmer, { opacity: shimmerOpacity }]}
        />
      )}
    </Pressable>
  );
}

/** Invisible tap targets for adventure play — no editor chrome. */
export function ScenePlayHotspots({
  hotspots,
  onActivate,
  showGuidance = false,
  style,
}: ScenePlayHotspotsProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setSize({ width, height });
    }
  }, []);

  if (!hotspots.length) return null;

  return (
    <View
      style={[StyleSheet.absoluteFillObject, style]}
      onLayout={onLayout}
      pointerEvents="box-none"
    >
      {size.width > 0 && hotspots.map(hotspot => (
        <InvisibleHotspotRegion
          key={hotspot.uid}
          hotspot={hotspot}
          showGuidance={showGuidance}
          onActivate={onActivate}
          pixelBounds={{
            left: hotspot.x * size.width,
            top: hotspot.y * size.height,
            width: hotspot.width * size.width,
            height: hotspot.height * size.height,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hitRegion: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  guidanceShimmer: {
    backgroundColor: 'rgba(255, 248, 220, 0.55)',
    borderRadius: 6,
  },
});
