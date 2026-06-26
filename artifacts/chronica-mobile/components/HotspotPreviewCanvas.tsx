import React, { useCallback, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { SceneHotspot } from '@/engine/types';

export type HotspotCanvasMode = 'play' | 'edit';

type HotspotPreviewCanvasProps = {
  backgroundUri?: string;
  hotspots: SceneHotspot[];
  mode: HotspotCanvasMode;
  /** When true, only draw tap regions (parent provides the background image). */
  regionsOnly?: boolean;
  selectedUid?: string | null;
  onSelect?: (uid: string) => void;
  onActivate?: (hotspot: SceneHotspot) => void;
  onPlace?: (x: number, y: number) => void;
  style?: ViewStyle;
  emptyMessage?: string;
};

const DEFAULT_HOTSPOT_SIZE = 0.18;

export function normalizeTapToHotspot(
  locationX: number,
  locationY: number,
  width: number,
  height: number,
  size = DEFAULT_HOTSPOT_SIZE,
): { x: number; y: number; width: number; height: number } {
  const half = size / 2;
  const x = Math.min(1 - size, Math.max(0, locationX / width - half));
  const y = Math.min(1 - size, Math.max(0, locationY / height - half));
  return { x, y, width: size, height: size };
}

export function HotspotPreviewCanvas({
  backgroundUri,
  hotspots,
  mode,
  regionsOnly = false,
  selectedUid = null,
  onSelect,
  onActivate,
  onPlace,
  style,
  emptyMessage = 'Add a background image to place hotspots on the scene.',
}: HotspotPreviewCanvasProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  }, []);

  const handleStagePress = (locationX: number, locationY: number) => {
    if (!size.width || !size.height) return;

    if (mode === 'edit' && onPlace) {
      const bounds = normalizeTapToHotspot(locationX, locationY, size.width, size.height);
      onPlace(bounds.x, bounds.y);
      return;
    }
  };

  if (!regionsOnly && !backgroundUri) {
    return (
      <View style={[styles.stage, styles.emptyStage, style]}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  const stageContent = (
    <>
      {!regionsOnly && backgroundUri ? (
        <Image source={{ uri: backgroundUri }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
      ) : null}
      {!regionsOnly && <View style={styles.stageTint} pointerEvents="none" />}

      {size.width > 0 && hotspots.map(hotspot => {
        const selected = hotspot.uid === selectedUid;
        const left = hotspot.x * size.width;
        const top = hotspot.y * size.height;
        const width = hotspot.width * size.width;
        const height = hotspot.height * size.height;

        return (
          <Pressable
            key={hotspot.uid}
            style={[
              styles.region,
              selected && styles.regionSelected,
              { left, top, width, height },
            ]}
            onPress={e => {
              e.stopPropagation();
              if (mode === 'edit') {
                onSelect?.(hotspot.uid);
              } else {
                onActivate?.(hotspot);
              }
            }}
          >
            {hotspot.label ? (
              <View style={styles.labelBadge}>
                <Text style={styles.labelText} numberOfLines={1}>
                  {hotspot.label}
                </Text>
              </View>
            ) : (
              <View style={styles.dot} />
            )}
          </Pressable>
        );
      })}

      {mode === 'edit' && !regionsOnly && (
        <View style={styles.hintBar} pointerEvents="none">
          <Text style={styles.hintText}>Tap the image to place a hotspot</Text>
        </View>
      )}
    </>
  );

  if (regionsOnly) {
    return (
      <View style={[StyleSheet.absoluteFillObject, style]} onLayout={onLayout} pointerEvents="box-none">
        {stageContent}
      </View>
    );
  }

  return (
    <Pressable
      style={[styles.stage, style]}
      onLayout={onLayout}
      onPress={e => {
        if (mode !== 'edit' || !onPlace) return;
        handleStagePress(e.nativeEvent.locationX, e.nativeEvent.locationY);
      }}
    >
      {stageContent}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a24',
  },
  emptyStage: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderStyle: 'dashed',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 18,
  },
  stageTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  region: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 8,
    justifyContent: 'flex-end',
    padding: 4,
  },
  regionSelected: {
    borderColor: '#a78bfa',
    backgroundColor: 'rgba(167,139,250,0.28)',
  },
  labelBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: '100%',
  },
  labelText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    alignSelf: 'center',
    margin: 'auto',
  },
  hintBar: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  hintText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
});
