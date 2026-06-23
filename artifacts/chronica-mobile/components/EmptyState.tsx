import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: {
  icon: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.container}>
      <Feather name={icon as any} size={40} color={colors.mutedForeground} />
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      {!!message && (
        <Text style={[styles.message, { color: colors.mutedForeground }]}>{message}</Text>
      )}
      {(actionLabel && onAction) || (secondaryActionLabel && onSecondaryAction) ? (
        <View style={styles.actions}>
          {secondaryActionLabel && onSecondaryAction && (
            <TouchableOpacity
              style={[styles.btn, styles.secondaryBtn, { borderColor: colors.border }]}
              onPress={onSecondaryAction}
              activeOpacity={0.8}
            >
              <Text style={[styles.btnText, { color: colors.foreground }]}>{secondaryActionLabel}</Text>
            </TouchableOpacity>
          )}
          {actionLabel && onAction && (
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary }]}
              onPress={onAction}
              activeOpacity={0.8}
            >
              <Text style={[styles.btnText, { color: colors.primaryForeground }]}>{actionLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  title: { fontSize: 18, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  message: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  btn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  secondaryBtn: { backgroundColor: 'transparent', borderWidth: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 8 },
  btnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
