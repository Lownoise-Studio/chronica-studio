import React, { useCallback, useMemo, useState } from 'react';
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
import {
  getHotspotDisplayLabel,
  normalizeTapToHotspot,
  resolveSceneTitleFromOptions,
  summarizeHotspotAction,
} from '@/engine/hotspot-helpers';
import type { SceneOption } from '@/engine/editor-helpers';

export type HotspotCanvasMode = 'play' | 'edit';

type HotspotPreviewCanvasProps = {
  backgroundUri?: string;
  hotspots: SceneHotspot[];
  mode: HotspotCanvasMode;
  regionsOnly?: boolean;
  selectedUid?: string | null;
  sceneOptions?: SceneOption[];
  onSelect?: (uid: string) => void;
  onActivate?: (hotspot: SceneHotspot) => void;
  onPlace?: (x: number, y: number) => void;
  style?: ViewStyle;
  emptyMessage?: string;
};

export { normalizeTapToHotspot };

function resolveSceneTitle(sceneOptions: SceneOption[] | undefined, locationId: string): string | undefined {
  if (!sceneOptions?.length) return undefined;
  return resolveSceneTitleFromOptions(locationId, sceneOptions);
}

function HotspotRegion({
  hotspot,
  ordinal,
  selected,
  mode,
  pixelBounds,
  sceneOptions,
  onSelect,
  onActivate,
}: {
  hotspot: SceneHotspot;
  ordinal: number;
  selected: boolean;
  mode: HotspotCanvasMode;
  pixelBounds: { left: number; top: number; width: number; height: number };
  sceneOptions?: SceneOption[];
  onSelect?: (uid: string) => void;
  onActivate?: (hotspot: SceneHotspot) => void;
}) {
  const displayLabel = getHotspotDisplayLabel(hotspot, ordinal);
  const actionSummary = summarizeHotspotAction(hotspot.action, id =>
    resolveSceneTitle(sceneOptions, id),
  );
  const showSummary = pixelBounds.height >= 36;
  const isPlay = mode === 'play';

  return (
    <Pressable
      style={[
        styles.region,
        isPlay ? styles.regionPlay : styles.regionEdit,
        selected && (isPlay ? styles.regionPlaySelected : styles.regionEditSelected),
        pixelBounds,
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
      <View style={[styles.labelStack, showSummary ? styles.labelStackInside : styles.labelStackAbove]} pointerEvents="none">
        <View style={[styles.labelBadge, selected && styles.labelBadgeSelected]}>
          <Text style={styles.labelText} numberOfLines={1}>
            {displayLabel}
          </Text>
          {showSummary && (
            <Text style={styles.summaryText} numberOfLines={1}>
              {actionSummary}
            </Text>
          )}
        </View>
      </View>
      {!showSummary && (
        <View style={styles.summaryPill} pointerEvents="none">
          <Text style={styles.summaryPillText} numberOfLines={1}>
            {actionSummary}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function HotspotPreviewCanvas({
  backgroundUri,
  hotspots,
  mode,
  regionsOnly = false,
  selectedUid = null,
  sceneOptions,
  onSelect,
  onActivate,
  onPlace,
  style,
  emptyMessage = 'Add a background image to place hotspots on the scene.',
}: HotspotPreviewCanvasProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const ordinalByUid = useMemo(() => {
    const map = new Map<string, number>();
    hotspots.forEach((h, i) => map.set(h.uid, i + 1));
    return map;
  }, [hotspots]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  }, []);

  const handleStagePress = (locationX: number, locationY: number) => {
    if (!size.width || !size.height || mode !== 'edit' || !onPlace) return;
    const bounds = normalizeTapToHotspot(locationX, locationY, size.width, size.height);
    onPlace(bounds.x, bounds.y);
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
        const ordinal = ordinalByUid.get(hotspot.uid) ?? 1;
        return (
          <HotspotRegion
            key={hotspot.uid}
            hotspot={hotspot}
            ordinal={ordinal}
            selected={hotspot.uid === selectedUid}
            mode={mode}
            sceneOptions={sceneOptions}
            pixelBounds={{
              left: hotspot.x * size.width,
              top: hotspot.y * size.height,
              width: hotspot.width * size.width,
              height: hotspot.height * size.height,
            }}
            onSelect={onSelect}
            onActivate={onActivate}
          />
        );
      })}

      {mode === 'edit' && !regionsOnly && (
        <View style={styles.hintBar} pointerEvents="none">
          <Text style={styles.hintText}>Tap the image to place a hotspot region</Text>
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
      onPress={e => handleStagePress(e.nativeEvent.locationX, e.nativeEvent.locationY)}
    >
      {stageContent}
    </Pressable>
  );
}

const PURPLE_FILL = 'rgba(139, 92, 246, 0.32)';
const PURPLE_FILL_SELECTED = 'rgba(167, 139, 250, 0.42)';
const PURPLE_BORDER = '#8b5cf6';
const PURPLE_BORDER_SELECTED = '#c4b5fd';
const PLAY_FILL = 'rgba(139, 92, 246, 0.22)';
const PLAY_FILL_SELECTED = 'rgba(167, 139, 250, 0.3)';

const styles = StyleSheet.create({
  stage: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a24',
  },
  emptyStage: {
    overflow: 'hidden',
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
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  region: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 8,
    justifyContent: 'flex-end',
    padding: 4,
  },
  regionEdit: {
    borderColor: PURPLE_BORDER,
    backgroundColor: PURPLE_FILL,
  },
  regionEditSelected: {
    borderColor: PURPLE_BORDER_SELECTED,
    backgroundColor: PURPLE_FILL_SELECTED,
    borderWidth: 2.5,
  },
  regionPlay: {
    borderColor: 'rgba(196, 181, 253, 0.75)',
    backgroundColor: PLAY_FILL,
  },
  regionPlaySelected: {
    borderColor: PURPLE_BORDER_SELECTED,
    backgroundColor: PLAY_FILL_SELECTED,
  },
  labelStack: {
    maxWidth: '100%',
  },
  labelStackAbove: {
    position: 'absolute',
    top: -4,
    left: 0,
    transform: [{ translateY: -22 }],
  },
  labelStackInside: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
  },
  labelBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(15, 10, 30, 0.82)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.55)',
    maxWidth: '100%',
  },
  labelBadgeSelected: {
    borderColor: PURPLE_BORDER_SELECTED,
    backgroundColor: 'rgba(30, 20, 55, 0.92)',
  },
  labelText: {
    color: '#f5f3ff',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  summaryText: {
    color: 'rgba(196, 181, 253, 0.95)',
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  summaryPill: {
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 10, 30, 0.72)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 2,
    maxWidth: '95%',
  },
  summaryPillText: {
    color: 'rgba(196, 181, 253, 0.9)',
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
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
