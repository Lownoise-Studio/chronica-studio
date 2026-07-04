import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { resolveStageObjectPresentationUri } from '@/engine/asset-resolver';
import {
  computeHotspotCenter,
  computeStageObjectBounds,
  getHotspotForObject,
  getRenderableStageObjects,
  resolveLightingTint,
  resolveStageObjectHotspotRef,
} from '@/engine/stage-presentation';
import { LIGHTING_PRESET_TINTS } from '@/engine/stage-authoring';
import type { ChronicaState, LightingPreset, ProjectAsset, SceneHotspot, StageComposition, StageObject } from '@/engine/types';

export function StagePreviewRenderer({
  composition,
  assets,
  canvasWidth,
  canvasHeight,
  hotspots = [],
  previewState,
  mode = 'editor',
  selectedObjectUid,
  highlightedHotspotUid,
  showHotspotLinks = true,
  onObjectPress,
}: {
  composition: StageComposition | undefined;
  assets: readonly ProjectAsset[];
  canvasWidth: number;
  canvasHeight: number;
  hotspots?: readonly SceneHotspot[];
  previewState?: ChronicaState | null;
  mode?: 'editor' | 'playtest';
  selectedObjectUid?: string | null;
  highlightedHotspotUid?: string | null;
  showHotspotLinks?: boolean;
  onObjectPress?: (object: StageObject) => void;
}) {
  const renderables = useMemo(
    () => getRenderableStageObjects(composition, {
      includeEditorHidden: mode === 'editor',
      previewState,
    }),
    [composition, mode, previewState],
  );

  const tint = resolveLightingTint(composition);
  const lightingPreset = composition?.lightingPreset as LightingPreset | undefined;

  if (!canvasWidth || !canvasHeight) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={mode === 'playtest' ? 'none' : 'box-none'}>
      {(tint || lightingPreset) && (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: tint ?? LIGHTING_PRESET_TINTS.day }]}
          pointerEvents="none"
        />
      )}

      {showHotspotLinks && selectedObjectUid && mode === 'editor' && renderables.map(entry => {
        if (entry.object.uid !== selectedObjectUid) return null;
        const hotspot = getHotspotForObject(entry.object, hotspots);
        if (!hotspot) return null;
        const objectCenter = {
          x: entry.object.x * canvasWidth,
          y: entry.object.y * canvasHeight,
        };
        const hotspotCenter = computeHotspotCenter(hotspot, canvasWidth, canvasHeight);
        const dx = hotspotCenter.x - objectCenter.x;
        const dy = hotspotCenter.y - objectCenter.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        return (
          <View
            key={`link-${entry.object.uid}`}
            pointerEvents="none"
            style={[
              styles.linkLine,
              {
                left: objectCenter.x,
                top: objectCenter.y,
                width: length,
                transform: [{ rotate: `${angle}deg` }],
                borderColor: '#6d5bd0aa',
              },
            ]}
          />
        );
      })}

      {hotspots.map(hotspot => {
        const linked = highlightedHotspotUid === hotspot.uid
          || (selectedObjectUid && resolveStageObjectHotspotRef(
            renderables.find(r => r.object.uid === selectedObjectUid)?.object ?? { uid: '', asset: '', x: 0, y: 0, layer: 'props' },
          ) === hotspot.uid);
        if (!linked || !showHotspotLinks) return null;
        return (
          <View
            key={`hotspot-highlight-${hotspot.uid}`}
            pointerEvents="none"
            style={[
              styles.hotspotHighlight,
              {
                left: hotspot.x * canvasWidth,
                top: hotspot.y * canvasHeight,
                width: hotspot.width * canvasWidth,
                height: hotspot.height * canvasHeight,
              },
            ]}
          />
        );
      })}

      {renderables.map(entry => {
        const { object, presentationStyle } = entry;
        const bounds = computeStageObjectBounds(object, canvasWidth, canvasHeight);
        const isSelected = selectedObjectUid === object.uid;
        const linkedHotspotUid = resolveStageObjectHotspotRef(object);
        const presentation = resolveStageObjectPresentationUri(assets, object.asset);
        const content = (
          <>
            {presentation?.kind === 'image' ? (
              <Image
                source={{ uri: presentation.uri }}
                style={styles.objectImage}
                contentFit="contain"
              />
            ) : presentation?.kind === 'model' ? (
              <View style={styles.modelPlaceholder}>
                {presentation.previewUri ? (
                  <Image source={{ uri: presentation.previewUri }} style={styles.objectImage} contentFit="contain" />
                ) : (
                  <Feather name="box" size={18} color="#b8b0d8" />
                )}
                <Text style={styles.modelLabel} numberOfLines={1}>{presentation.label}</Text>
              </View>
            ) : object.asset ? (
              <View style={styles.objectFallback}>
                <Feather name="image" size={14} color="#888" />
              </View>
            ) : (
              <View style={styles.objectFallback}>
                <Feather name="image" size={14} color="#888" />
              </View>
            )}
            {linkedHotspotUid && mode === 'editor' && (
              <View style={styles.linkBadge}>
                <Feather name="link" size={10} color="#fff" />
              </View>
            )}
          </>
        );

        const objectStyle = {
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height,
          opacity: presentationStyle.opacity * (object.locked && mode === 'editor' ? 0.65 : 1),
          transform: [
            { rotate: `${object.rotation ?? 0}deg` },
            { scale: presentationStyle.scale },
            { translateX: presentationStyle.translateX * canvasWidth },
            { translateY: presentationStyle.translateY * canvasHeight },
          ],
          borderColor: isSelected ? '#6d5bd0' : linkedHotspotUid ? '#6d5bd088' : '#ffffff44',
        };

        if (mode === 'playtest' || !onObjectPress) {
          return (
            <View key={object.uid} pointerEvents="none" style={[styles.object, objectStyle]}>
              {content}
            </View>
          );
        }

        return (
          <View
            key={object.uid}
            style={[styles.object, objectStyle]}
            onStartShouldSetResponder={() => true}
            onResponderRelease={() => onObjectPress(object)}
          >
            {content}
          </View>
        );
      })}

      {mode === 'editor' && composition?.objects.some(o => o.hidden) && (
        <View pointerEvents="none" style={styles.hiddenHint}>
          <Text style={styles.hiddenHintText}>Hidden objects omitted from playtest overlay</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  object: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#ffffff22',
  },
  objectImage: { width: '100%', height: '100%' },
  objectFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00000033' },
  modelPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1530aa', padding: 4, gap: 2 },
  modelLabel: { color: '#ddd6ff', fontSize: 9, fontFamily: 'Inter_500Medium', maxWidth: '100%' },
  linkBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#6d5bd0cc',
    borderRadius: 999,
    padding: 2,
  },
  linkLine: {
    position: 'absolute',
    height: 0,
    borderTopWidth: 2,
    borderStyle: 'dashed',
    transformOrigin: 'left center',
  },
  hotspotHighlight: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#6d5bd0',
    borderRadius: 6,
    backgroundColor: '#6d5bd022',
  },
  hiddenHint: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: '#00000066',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  hiddenHintText: { color: '#fff', fontSize: 10, fontFamily: 'Inter_500Medium' },
});
