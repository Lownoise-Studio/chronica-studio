import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { DialoguePresentation } from '@/engine/dialogue-presentation';

type DialogueBubbleProps = {
  dialogue: DialoguePresentation;
  colors: {
    foreground: string;
    mutedForeground: string;
    primary: string;
    card: string;
    border: string;
  };
  onAdvance?: () => void;
};

export function DialogueBubble({ dialogue, colors, onAdvance }: DialogueBubbleProps) {
  const speakerLabel = dialogue.isNarration
    ? 'Narration'
    : (dialogue.speakerName || dialogue.speakerId || 'Speaker');

  return (
    <TouchableOpacity
      activeOpacity={dialogue.canAdvance ? 0.85 : 1}
      onPress={dialogue.canAdvance ? onAdvance : undefined}
      style={[styles.wrap, { borderColor: colors.border, backgroundColor: colors.card }]}
    >
      <View style={styles.headerRow}>
        {dialogue.portraitUri ? (
          <Image source={{ uri: dialogue.portraitUri }} style={styles.portrait} />
        ) : (
          <View style={[styles.portraitFallback, { backgroundColor: colors.border }]}>
            <Feather
              name={dialogue.isNarration ? 'book-open' : 'user'}
              size={18}
              color={colors.mutedForeground}
            />
          </View>
        )}
        <View style={styles.headerCopy}>
          <Text style={[styles.speaker, { color: dialogue.isNarration ? colors.mutedForeground : colors.primary }]}>
            {speakerLabel}
          </Text>
          {!!dialogue.expressionId && !dialogue.isNarration && (
            <Text style={[styles.expression, { color: colors.mutedForeground }]}>
              {dialogue.expressionId}
            </Text>
          )}
        </View>
        {dialogue.canAdvance && (
          <View style={styles.tapHint}>
            <Text style={[styles.tapHintText, { color: colors.primary }]}>Tap</Text>
            <Feather name="chevron-right" size={14} color={colors.primary} />
          </View>
        )}
      </View>

      <Text style={[styles.text, { color: colors.foreground }]}>
        {dialogue.text || '(empty line)'}
      </Text>

      {dialogue.lineCount > 1 && (
        <Text style={[styles.progress, { color: colors.mutedForeground }]}>
          {dialogue.lineIndex + 1} / {dialogue.lineCount}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  portrait: { width: 52, height: 52, borderRadius: 10 },
  portraitFallback: {
    width: 52,
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, gap: 2 },
  speaker: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  expression: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  tapHint: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  tapHintText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  text: { fontSize: 16, fontFamily: 'Inter_400Regular', lineHeight: 24 },
  progress: { fontSize: 11, fontFamily: 'Inter_400Regular', alignSelf: 'flex-end' },
});
