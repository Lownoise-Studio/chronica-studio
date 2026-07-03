import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import {
  AdventureInteractable,
  ChronicaState,
  Fragment,
  ProjectAsset,
} from '@/engine/types';
import {
  DEFAULT_ADVENTURE_ASPECT,
  DEFAULT_INTERACTABLE_RADIUS,
  DEFAULT_INTERACTABLE_WIDTH,
  DEFAULT_PLAYER_WIDTH,
  findInteractableInRange,
  getPlayerPosition,
} from '@/engine/adventure';
import { resolveAssetUri } from '@/engine/asset-resolver';
import { VirtualJoystick, JoystickVector } from './VirtualJoystick';

const INTERACTABLE_ICON: Record<AdventureInteractable['kind'], keyof typeof Feather.glyphMap> = {
  npc: 'user',
  pickup: 'package',
  door: 'log-in',
  trigger: 'zap',
};

export interface AdventureRuntimeViewColors {
  background: string;
  foreground: string;
  primary: string;
  border: string;
  card: string;
  mutedForeground: string;
}

export interface AdventureRuntimeViewProps {
  fragment: Fragment;
  state: ChronicaState;
  interactables: AdventureInteractable[];
  assets: readonly ProjectAsset[];
  colors: AdventureRuntimeViewColors;
  backgroundUri: string | undefined;
  onMove: (dxNorm: number, dyNorm: number, seconds: number) => void;
  onInteract: (interactable: AdventureInteractable) => void;
  onFootstep?: () => void;
  overlay?: React.ReactNode;
  onLayout?: (dimensions: { width: number; height: number }) => void;
}

const FOOTSTEP_INTERVAL_MS = 320;

/**
 * Top-down playable stage. Renders the room background, colliders (in debug),
 * interactables, and the player sprite. Supplies keyboard + virtual-joystick
 * controls and an interact button that fires whenever an interactable is in
 * range.
 */
export function AdventureRuntimeView({
  fragment,
  state,
  interactables,
  assets,
  colors,
  backgroundUri,
  onMove,
  onInteract,
  onFootstep,
  overlay,
  onLayout,
}: AdventureRuntimeViewProps) {
  const adventure = fragment.adventure!;
  const playerWidth = adventure.playerWidth ?? DEFAULT_PLAYER_WIDTH;
  const playerAsset = adventure.playerSprite
    ? resolveAssetUri(assets, adventure.playerSprite)
    : undefined;
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [joystickVec, setJoystickVec] = useState<JoystickVector>({ x: 0, y: 0 });
  const keysRef = useRef<Set<string>>(new Set());
  const lastTickRef = useRef<number | null>(null);
  const lastFootstepRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  const player = useMemo(() => getPlayerPosition(state), [state]);
  const inRange = useMemo(
    () => findInteractableInRange(interactables, player.x, player.y),
    [interactables, player.x, player.y],
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const down = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      keysRef.current.add(e.key.toLowerCase());
      if ((e.key === 'e' || e.key === 'E' || e.key === ' ' || e.key === 'Enter') && inRange) {
        onInteract(inRange);
      }
    };
    const up = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };
    const blur = () => keysRef.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [inRange, onInteract]);

  const tick = useCallback((time: number) => {
    const last = lastTickRef.current ?? time;
    const seconds = Math.min(0.05, (time - last) / 1000);
    lastTickRef.current = time;

    let dx = joystickVec.x;
    let dy = joystickVec.y;

    if (Platform.OS === 'web') {
      const keys = keysRef.current;
      if (keys.has('arrowleft') || keys.has('a')) dx -= 1;
      if (keys.has('arrowright') || keys.has('d')) dx += 1;
      if (keys.has('arrowup') || keys.has('w')) dy -= 1;
      if (keys.has('arrowdown') || keys.has('s')) dy += 1;
    }

    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag > 1) {
      dx /= mag;
      dy /= mag;
    }

    if (mag > 0.05 && seconds > 0) {
      onMove(dx, dy, seconds);
      const now = Date.now();
      if (onFootstep && now - lastFootstepRef.current > FOOTSTEP_INTERVAL_MS) {
        lastFootstepRef.current = now;
        onFootstep();
      }
    } else {
      lastFootstepRef.current = 0;
    }

    if (typeof requestAnimationFrame === 'function') {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [joystickVec, onMove, onFootstep]);

  useEffect(() => {
    if (typeof requestAnimationFrame !== 'function') return;
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafRef.current);
      }
      lastTickRef.current = null;
    };
  }, [tick]);

  const aspect = adventure.aspectRatio ?? DEFAULT_ADVENTURE_ASPECT;

  const stageStyle: ViewStyle = {
    aspectRatio: aspect,
    maxWidth: '100%',
    maxHeight: '100%',
    backgroundColor: '#0a0a0f',
    overflow: 'hidden',
  };

  const spriteFrom = (name: string | undefined) =>
    name ? resolveAssetUri(assets, name) : undefined;

  const playerSize = stageSize.width * playerWidth;
  const playerX = stageSize.width * player.x;
  const playerY = stageSize.height * player.y;

  return (
    <View style={styles.wrapper}>
      <View
        style={[styles.stageWrap]}
        onLayout={e => {
          const { width, height } = e.nativeEvent.layout;
          setStageSize({ width, height });
          onLayout?.({ width, height });
        }}
      >
        <View style={stageStyle}>
          {backgroundUri ? (
            <Image
              source={{ uri: backgroundUri }}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#111827' }]} />
          )}

          {interactables.map(interactable => {
            const width = (interactable.width ?? DEFAULT_INTERACTABLE_WIDTH) * stageSize.width;
            const radius = (interactable.radius ?? DEFAULT_INTERACTABLE_RADIUS) * stageSize.width;
            const cx = interactable.x * stageSize.width;
            const cy = interactable.y * stageSize.height;
            const spriteUri = spriteFrom(interactable.sprite);
            const isActive = inRange?.uid === interactable.uid;
            return (
              <View
                key={interactable.uid}
                pointerEvents="none"
                style={[
                  styles.interactableWrap,
                  {
                    left: cx - width / 2,
                    top: cy - width,
                    width,
                    height: width,
                  },
                ]}
              >
                <View
                  style={[
                    styles.interactableGlow,
                    {
                      width: radius * 2,
                      height: radius * 2,
                      borderRadius: radius,
                      left: width / 2 - radius,
                      top: width - radius,
                      borderColor: isActive ? '#ffe28a' : 'rgba(255,255,255,0.14)',
                      backgroundColor: isActive ? 'rgba(255, 226, 138, 0.16)' : 'transparent',
                    },
                  ]}
                />
                {spriteUri ? (
                  <Image
                    source={{ uri: spriteUri }}
                    style={styles.interactableSprite}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <View style={styles.interactableFallback}>
                    <Feather
                      name={INTERACTABLE_ICON[interactable.kind] ?? 'help-circle'}
                      size={Math.max(14, width * 0.5)}
                      color="#f8fafc"
                    />
                  </View>
                )}
                <Text
                  numberOfLines={1}
                  style={[
                    styles.interactableLabel,
                    isActive && { color: '#ffe28a', fontFamily: 'Inter_600SemiBold' },
                  ]}
                >
                  {interactable.label}
                </Text>
              </View>
            );
          })}

          <View
            pointerEvents="none"
            style={[
              styles.player,
              {
                left: playerX - playerSize / 2,
                top: playerY - playerSize,
                width: playerSize,
                height: playerSize,
              },
            ]}
          >
            {playerAsset ? (
              <Image
                source={{ uri: playerAsset }}
                style={StyleSheet.absoluteFillObject}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={styles.playerFallback}>
                <View style={styles.playerFallbackHead} />
                <View style={styles.playerFallbackBody} />
              </View>
            )}
          </View>

          <View pointerEvents="none" style={styles.stageOverlay}>
            {overlay}
          </View>
        </View>
      </View>

      <View style={styles.controls} pointerEvents="box-none">
        <VirtualJoystick
          onChange={setJoystickVec}
          onRelease={() => setJoystickVec({ x: 0, y: 0 })}
          size={128}
          style={styles.joystick}
        />
        <View style={styles.rightControls} pointerEvents="box-none">
          <TouchableOpacity
            style={[
              styles.interactBtn,
              { backgroundColor: inRange ? '#ffe28a' : 'rgba(255,255,255,0.18)' },
              !inRange && { opacity: 0.55 },
            ]}
            disabled={!inRange}
            onPress={() => inRange && onInteract(inRange)}
            activeOpacity={0.85}
          >
            <Feather
              name={inRange ? (INTERACTABLE_ICON[inRange.kind] ?? 'zap') : 'zap-off'}
              size={22}
              color={inRange ? '#1f2937' : '#f8fafc'}
            />
            <Text
              style={[
                styles.interactLabel,
                { color: inRange ? '#1f2937' : '#f8fafc' },
              ]}
              numberOfLines={1}
            >
              {inRange ? inRange.label : 'Nothing here'}
            </Text>
          </TouchableOpacity>
          {Platform.OS === 'web' && (
            <Text style={styles.hint} numberOfLines={2}>
              WASD / arrows to move · E to interact
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#050508',
  },
  stageWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  stageOverlay: {
    ...StyleSheet.absoluteFillObject,
    padding: 12,
    justifyContent: 'flex-end',
  },
  interactableWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  interactableGlow: {
    position: 'absolute',
    borderWidth: 2,
  },
  interactableSprite: {
    width: '100%',
    height: '100%',
  },
  interactableFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  interactableLabel: {
    position: 'absolute',
    top: '100%',
    marginTop: 2,
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: '#e2e8f0',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  player: {
    position: 'absolute',
  },
  playerFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  playerFallbackHead: {
    width: '55%',
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: '#f5d590',
    borderWidth: 2,
    borderColor: '#332a1a',
    marginBottom: 2,
  },
  playerFallbackBody: {
    width: '70%',
    height: '40%',
    borderRadius: 8,
    backgroundColor: '#4a5b8a',
    borderWidth: 2,
    borderColor: '#1e293b',
  },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  joystick: {
    marginBottom: 6,
  },
  rightControls: {
    alignItems: 'flex-end',
    gap: 8,
    flexShrink: 1,
  },
  interactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    minWidth: 140,
    maxWidth: 220,
    justifyContent: 'center',
  },
  interactLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  hint: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(226, 232, 240, 0.75)',
    textAlign: 'right',
  },
});
