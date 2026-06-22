import React, { useState } from 'react';
import {
  Modal, Platform, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

type Step = {
  icon: string;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    icon: 'book-open',
    title: 'Welcome to Chronica Studio',
    body: "Create branching stories directly on your phone — no coding needed.\n\nYour story is made of scenes: moments your reader moves through, one choice at a time.",
  },
  {
    icon: 'file-text',
    title: 'Write Your Scenes',
    body: "Each scene is a moment in your story. Write what the reader sees, feels, or hears.\n\nGive each scene a name so you can find it easily.",
  },
  {
    icon: 'git-branch',
    title: 'Connect with Choices',
    body: "Add choices to let readers steer the story. Each choice links to another scene.\n\nYou can also add unlock requirements — conditions a reader must meet before a choice appears.",
  },
  {
    icon: 'play',
    title: 'Playtest & Share',
    body: "Tap Playtest to read through your story and check every path.\n\nWhen you're ready, export your project as a file to back it up or share it with others.",
  },
];

export function Onboarding({ onDismiss }: { onDismiss: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const next = () => isLast ? onDismiss() : setStep(s => s + 1);
  const prev = () => setStep(s => Math.max(0, s - 1));

  return (
    <Modal visible transparent animationType="fade">
      <View style={[styles.overlay, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 24 }]}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.skipBtn} onPress={onDismiss}>
            <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip</Text>
          </TouchableOpacity>

          <View style={[styles.iconRing, { backgroundColor: colors.primary + '22', borderColor: colors.primary + '44' }]}>
            <Feather name={current.icon as any} size={36} color={colors.primary} />
          </View>

          <Text style={[styles.title, { color: colors.foreground }]}>{current.title}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>{current.body}</Text>

          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i === step ? colors.primary : colors.border },
                ]}
              />
            ))}
          </View>

          <View style={styles.nav}>
            {step > 0 ? (
              <TouchableOpacity
                style={[styles.navBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                onPress={prev}
                activeOpacity={0.8}
              >
                <Feather name="arrow-left" size={16} color={colors.foreground} />
                <Text style={[styles.navBtnText, { color: colors.foreground }]}>Back</Text>
              </TouchableOpacity>
            ) : <View style={{ flex: 1 }} />}
            <TouchableOpacity
              style={[styles.navBtn, { backgroundColor: colors.primary, flex: isLast ? 2 : 1 }]}
              onPress={next}
              activeOpacity={0.8}
            >
              <Text style={styles.navBtnTextLight}>{isLast ? "Start writing" : 'Next'}</Text>
              {!isLast && <Feather name="arrow-right" size={16} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: 16,
  },
  card: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    gap: 16,
    alignItems: 'center',
  },
  skipBtn: { position: 'absolute', top: 16, right: 16 },
  skipText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  iconRing: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'center', letterSpacing: -0.3 },
  body: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  nav: { flexDirection: 'row', gap: 10, width: '100%' },
  navBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 10, paddingVertical: 13, borderWidth: 1, borderColor: 'transparent',
  },
  navBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  navBtnTextLight: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
