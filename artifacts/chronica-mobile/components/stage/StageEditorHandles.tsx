import React, { useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { computeStageObjectBounds } from '@/engine/stage-presentation';
import { DEFAULT_SNAP_GRID, snapValue } from '@/engine/stage-authoring';
import type { StageObject } from '@/engine/types';

const HANDLE = 14;
const MIN_SCALE = 0.25;
const MAX_SCALE = 3;

export function StageEditorHandles({
  object,
  canvasWidth,
  canvasHeight,
  snapEnabled,
  onTransform,
}: {
  object: StageObject;
  canvasWidth: number;
  canvasHeight: number;
  snapEnabled: boolean;
  onTransform: (patch: Partial<Pick<StageObject, 'x' | 'y' | 'scale' | 'rotation'>>) => void;
}) {
  const bounds = useMemo(
    () => computeStageObjectBounds(object, canvasWidth, canvasHeight),
    [object, canvasWidth, canvasHeight],
  );

  const objectRef = useRef(object);
  objectRef.current = object;

  const moveResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !objectRef.current.locked,
      onMoveShouldSetPanResponder: () => !objectRef.current.locked,
      onPanResponderMove: (_, gesture) => {
        const current = objectRef.current;
        if (current.locked || !canvasWidth || !canvasHeight) return;
        let x = current.x + gesture.dx / canvasWidth;
        let y = current.y + gesture.dy / canvasHeight;
        if (snapEnabled) {
          x = snapValue(x, DEFAULT_SNAP_GRID);
          y = snapValue(y, DEFAULT_SNAP_GRID);
        }
        onTransform({ x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) });
      },
    }),
  ).current;

  const scaleStart = useRef({ scale: 1, distance: 1 });
  const scaleResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !objectRef.current.locked,
      onPanResponderGrant: () => {
        scaleStart.current = { scale: objectRef.current.scale ?? 1, distance: 1 };
      },
      onMoveShouldSetPanResponder: () => !objectRef.current.locked,
      onPanResponderMove: (_, gesture) => {
        const current = objectRef.current;
        if (current.locked) return;
        const delta = (gesture.dx + gesture.dy) / Math.max(canvasWidth, canvasHeight);
        const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scaleStart.current.scale + delta * 2));
        onTransform({ scale: Number(next.toFixed(2)) });
      },
    }),
  ).current;

  const rotateStart = useRef({ rotation: 0, angle: 0 });
  const rotateResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !objectRef.current.locked,
      onPanResponderGrant: () => {
        rotateStart.current = { rotation: objectRef.current.rotation ?? 0, angle: 0 };
      },
      onMoveShouldSetPanResponder: () => !objectRef.current.locked,
      onPanResponderMove: (_, gesture) => {
        const current = objectRef.current;
        if (current.locked) return;
        const delta = gesture.dx * 0.4;
        onTransform({ rotation: Math.round(rotateStart.current.rotation + delta) });
      },
    }),
  ).current;

  if (!canvasWidth || !canvasHeight || object.locked) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.box,
        {
          left: bounds.left - 4,
          top: bounds.top - 4,
          width: bounds.width + 8,
          height: bounds.height + 8,
        },
      ]}
    >
      <View {...moveResponder.panHandlers} style={styles.dragSurface} />
      <View style={[styles.corner, styles.cornerTL]} />
      <View style={[styles.corner, styles.cornerTR]} />
      <View style={[styles.corner, styles.cornerBL]} />
      <View {...scaleResponder.panHandlers} style={[styles.corner, styles.cornerBR, styles.scaleHandle]}>
        <Feather name="maximize-2" size={10} color="#fff" />
      </View>
      <View {...rotateResponder.panHandlers} style={styles.rotateHandle}>
        <Feather name="rotate-cw" size={11} color="#fff" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', borderWidth: 1, borderColor: '#6d5bd0', borderStyle: 'dashed' },
  dragSurface: { ...StyleSheet.absoluteFillObject },
  corner: {
    position: 'absolute',
    width: HANDLE,
    height: HANDLE,
    borderRadius: HANDLE / 2,
    backgroundColor: '#6d5bd0',
    borderWidth: 2,
    borderColor: '#fff',
  },
  cornerTL: { left: -HANDLE / 2, top: -HANDLE / 2 },
  cornerTR: { right: -HANDLE / 2, top: -HANDLE / 2 },
  cornerBL: { left: -HANDLE / 2, bottom: -HANDLE / 2 },
  cornerBR: { right: -HANDLE / 2, bottom: -HANDLE / 2, alignItems: 'center', justifyContent: 'center' },
  scaleHandle: { backgroundColor: '#4c3d9a' },
  rotateHandle: {
    position: 'absolute',
    top: -28,
    left: '50%',
    marginLeft: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6d5bd0',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
