import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { PlayerViewColors } from '@/components/PlayerView';

export function InteractionFeedbackToast({
  message,
  colors,
  onDismiss,
}: {
  message: string | null;
  colors: PlayerViewColors;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, 2600);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={[styles.toast, { backgroundColor: colors.foreground + 'ee' }]}>
        <Text style={[styles.text, { color: colors.background }]} numberOfLines={3}>
          {message}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 28,
    zIndex: 30,
    alignItems: 'center',
  },
  toast: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: 420,
  },
  text: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    lineHeight: 18,
  },
});
