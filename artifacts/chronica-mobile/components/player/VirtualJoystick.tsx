import React, { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, ViewStyle } from 'react-native';

export type JoystickVector = { x: number; y: number };

export interface VirtualJoystickProps {
  /** Called on every frame the stick is active. Vector components are in [-1, 1]. */
  onChange: (vector: JoystickVector) => void;
  /** Called once when the stick is released. */
  onRelease?: () => void;
  size?: number;
  style?: ViewStyle;
}

/**
 * Touch-friendly virtual joystick. The knob follows the finger inside a fixed
 * base; the reported vector is clamped to unit length. Rendered with plain
 * Views so no gesture-handler dependency is required.
 */
export function VirtualJoystick({ onChange, onRelease, size = 128, style }: VirtualJoystickProps) {
  const radius = size / 2;
  const knobSize = size * 0.45;
  const knobRadius = knobSize / 2;
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const onChangeRef = useRef(onChange);
  const onReleaseRef = useRef(onRelease);
  onChangeRef.current = onChange;
  onReleaseRef.current = onRelease;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        const dx = gesture.dx;
        const dy = gesture.dy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const max = radius - knobRadius;
        const clampedDist = Math.min(dist, max);
        const angle = Math.atan2(dy, dx);
        const kx = dist === 0 ? 0 : Math.cos(angle) * clampedDist;
        const ky = dist === 0 ? 0 : Math.sin(angle) * clampedDist;
        setKnob({ x: kx, y: ky });
        onChangeRef.current({
          x: max === 0 ? 0 : kx / max,
          y: max === 0 ? 0 : ky / max,
        });
      },
      onPanResponderRelease: () => {
        setKnob({ x: 0, y: 0 });
        onChangeRef.current({ x: 0, y: 0 });
        onReleaseRef.current?.();
      },
      onPanResponderTerminate: () => {
        setKnob({ x: 0, y: 0 });
        onChangeRef.current({ x: 0, y: 0 });
        onReleaseRef.current?.();
      },
    }),
  ).current;

  return (
    <View
      {...responder.panHandlers}
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: radius,
        },
        style,
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.knob,
          {
            width: knobSize,
            height: knobSize,
            borderRadius: knobRadius,
            transform: [{ translateX: knob.x }, { translateY: knob.y }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  knob: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
