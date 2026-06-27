import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { DialoguePresentation } from '@/engine/dialogue-presentation';
import type { DialogueBubbleVariant } from '@/engine/player-presentation';

type DialogueBubbleProps = {
  dialogue: DialoguePresentation;
  variant?: DialogueBubbleVariant;
  colors: {
    foreground: string;
    mutedForeground: string;
    primary: string;
    card: string;
    border: string;
  };
  onAdvance?: () => void;
};

function DialogueBubbleInner({
  dialogue,
  variant = 'card',
  colors,
  onAdvance,
}: DialogueBubbleProps) {
  const isCaption = variant === 'caption';

  if (isCaption) {
    return (
      <TouchableOpacity
        activeOpacity={dialogue.canAdvance ? 0.92 : 1}
        onPress={dialogue.canAdvance ? onAdvance : undefined}
        style={styles.captionWrap}
      >
        <Text style={[styles.captionText, { color: colors.foreground }]}>
          {dialogue.text || '(empty line)'}
        </Text>
        {dialogue.canAdvance && (
          <View style={styles.captionContinue}>
            <View style={[styles.continueDot, { backgroundColor: colors.primary }]} />
          </View>
        )}
      </TouchableOpacity>
    );
  }

  const speakerLabel = dialogue.isNarration
    ? 'Narration'
    : (dialogue.speakerName || dialogue.speakerId || 'Speaker');

  return (
    <TouchableOpacity
      activeOpacity={dialogue.canAdvance ? 0.85 : 1}
      onPress={dialogue.canAdvance ? onAdvance : undefined}
      style={[styles.wrap, { borderColor: colors.border, backgroundColor: colors.card }]}
    >
      {!dialogue.isNarration && (
        <View style={styles.headerRow}>
          {dialogue.portraitUri ? (
            <Image source={{ uri: dialogue.portraitUri }} style={styles.portrait} />
          ) : (
            <View style={[styles.portraitFallback, { backgroundColor: colors.border }]}>
              <Feather name="user" size={18} color={colors.mutedForeground} />
            </View>
          )}
          <View style={styles.headerCopy}>
            <Text style={[styles.speaker, { color: colors.primary }]}>
              {speakerLabel}
            </Text>
            {!!dialogue.expressionId && (
              <Text style={[styles.expression, { color: colors.mutedForeground }]}>
                {dialogue.expressionId}
              </Text>
            )}
          </View>
          {dialogue.canAdvance && (
            <View style={styles.tapHint}>
              <Feather name="chevron-right" size={14} color={colors.primary} />
            </View>
          )}
        </View>
      )}

      <Text style={[styles.text, { color: colors.foreground }]}>
        {dialogue.text || '(empty line)'}
      </Text>

      {dialogue.isNarration && dialogue.canAdvance && (
        <View style={styles.captionContinue}>
          <View style={[styles.continueDot, { backgroundColor: colors.primary }]} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  captionWrap: {
    gap: 10,
    paddingVertical: 4,
  },
  captionText: {
    fontSize: 17,
    fontFamily: 'Inter_400Regular',
    lineHeight: 26,
  },
  captionContinue: {
    alignItems: 'flex-start',
  },
  continueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.85,
  },
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
  text: { fontSize: 16, fontFamily: 'Inter_400Regular', lineHeight: 24 },
});

export const DialogueBubble = React.memo(DialogueBubbleInner);
