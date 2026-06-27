import React from 'react';
import { LayoutChangeEvent, StyleSheet, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import type { StageActorPresentation } from '@/engine/stage-actors';

type SceneStageActorsProps = {
  actors: StageActorPresentation[];
  style?: ViewStyle;
};

function SceneStageActorsInner({ actors, style }: SceneStageActorsProps) {
  const [layout, setLayout] = React.useState({ width: 0, height: 0 });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setLayout({ width, height });
    }
  };

  if (!actors.length) return null;

  return (
    <View
      style={[StyleSheet.absoluteFillObject, style]}
      pointerEvents="none"
      onLayout={onLayout}
    >
      {layout.width > 0 && layout.height > 0 && actors.map(actor => {
        if (!actor.spriteUri) return null;
        const width = layout.width * actor.width * actor.scale;
        const height = width;
        const left = layout.width * actor.x - width / 2;
        const top = layout.height * actor.y - height;

        return (
          <Image
            key={`${actor.uid}:${actor.assetName}:${actor.expressionId ?? 'default'}`}
            source={{ uri: actor.spriteUri }}
            style={{
              position: 'absolute',
              left,
              top,
              width,
              height,
              zIndex: actor.zIndex,
            }}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        );
      })}
    </View>
  );
}

export const SceneStageActors = React.memo(SceneStageActorsInner);
