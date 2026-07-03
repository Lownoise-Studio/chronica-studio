import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import {
  advanceDevSession,
  importChronicaPackageForDeveloper,
  refreshDevSummary,
  sessionHasAdvanceAction,
  type DevFixtureId,
  type DevImportResult,
} from '@/dev/chronica-compat-import';
import { godotHybridFixturePackage } from '@/dev/fixtures/godot-hybrid-package';
import { v3CompatibilityFixturePackage } from '@/engine/compat/fixtures';

const FIXTURES: { id: DevFixtureId; label: string; package: typeof godotHybridFixturePackage }[] = [
  { id: 'hybrid', label: 'Hybrid (v2)', package: godotHybridFixturePackage },
  { id: 'v3-compat', label: 'v3 compat fixture', package: v3CompatibilityFixturePackage },
];

/**
 * Developer-only debug panel that exercises the compat ingestion pipeline
 * against bundled fixtures. Not the shipping importer; not connected to
 * ProjectsContext or PlayerHost. Mounted only when the About screen is in
 * developer/advanced mode.
 */
export function ChronicaCompatDevPanel() {
  const colors = useColors();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DevImportResult | null>(null);

  const runImport = useCallback(async (fixtureId: DevFixtureId) => {
    const fixture = FIXTURES.find(f => f.id === fixtureId);
    if (!fixture) return;
    setBusy(true);
    try {
      const next = await importChronicaPackageForDeveloper(fixture.package, fixtureId);
      setResult(next);
    } finally {
      setBusy(false);
    }
  }, []);

  const advance = useCallback(async () => {
    if (!result?.session) return;
    setBusy(true);
    try {
      await advanceDevSession(result.session);
      const summary = await refreshDevSummary(result);
      setResult(current => (current ? { ...current, summary } : current));
    } finally {
      setBusy(false);
    }
  }, [result]);

  const canAdvance = result?.session ? sessionHasAdvanceAction(result.session) : false;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Feather name="package" size={16} color={colors.primary} />
        <Text style={[styles.title, { color: colors.foreground }]}>.chronica compat bridge</Text>
      </View>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Provisional developer path — ingest bundled fixtures through the compat
        pipeline. Does not replace the shipping importer.
      </Text>

      <View style={styles.fixtureRow}>
        {FIXTURES.map(fixture => (
          <TouchableOpacity
            key={fixture.id}
            style={[
              styles.fixtureButton,
              {
                backgroundColor: result?.fixtureId === fixture.id ? colors.primary + '18' : colors.secondary,
                borderColor: result?.fixtureId === fixture.id ? colors.primary : colors.border,
              },
            ]}
            onPress={() => runImport(fixture.id)}
            disabled={busy}
            activeOpacity={0.8}
            accessibilityLabel={`Import ${fixture.label} through the compat bridge`}
            testID={`chronica-compat-dev-import-${fixture.id}`}
          >
            {busy && result?.fixtureId !== fixture.id ? null : busy && result?.fixtureId === fixture.id ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Feather name="play" size={13} color={colors.primary} />
            )}
            <Text style={[styles.buttonText, { color: colors.foreground }]}>{fixture.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {result && (
        <View style={styles.result}>
          <SummaryRow label="Title" value={result.summary.title} colors={colors} />
          <SummaryRow label="Compat level" value={result.summary.compatibilityLevel} colors={colors} />
          <SummaryRow label="Schema support" value={result.summary.schemaVersionSupport} colors={colors} />
          <SummaryRow label="Runtime target" value={result.summary.selectedRuntimeTarget} colors={colors} />
          <SummaryRow label="Warnings" value={String(result.summary.warningsCount)} colors={colors} />
          <SummaryRow label="Started" value={result.started ? 'yes' : 'no'} colors={colors} />

          {result.warnings.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.miniLabel, { color: colors.mutedForeground }]}>Warning detail</Text>
              {result.warnings.map((warning, i) => (
                <Text key={i} style={[styles.warningItem, { color: colors.mutedForeground }]}>
                  • {warning}
                </Text>
              ))}
            </View>
          )}

          {result.summary.saveResumeSmoke && (
            <View style={styles.section}>
              <Text style={[styles.miniLabel, { color: colors.mutedForeground }]}>Save / resume (canonical v2)</Text>
              <Text
                style={[
                  styles.smokeText,
                  { color: result.summary.saveResumeSmoke.ok ? colors.foreground : colors.destructive },
                ]}
              >
                {result.summary.saveResumeSmoke.ok
                  ? `ok — format v${result.summary.saveResumeSmoke.formatVersion}, scene ${result.summary.saveResumeSmoke.fragmentLocationId ?? '(none)'}`
                  : `failed — ${result.summary.saveResumeSmoke.reason}`}
              </Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={[styles.miniLabel, { color: colors.mutedForeground }]}>Current scene</Text>
            <Text style={[styles.sceneText, { color: colors.foreground }]}>
              {result.summary.currentFragmentText || '(no active scene)'}
            </Text>
          </View>

          {result.summary.availableChoices.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.miniLabel, { color: colors.mutedForeground }]}>Choices</Text>
              {result.summary.availableChoices.map(c => (
                <Text key={c.uid} style={[styles.choice, { color: colors.foreground }]}>• {c.label}</Text>
              ))}
            </View>
          )}

          {result.summary.availableHotspots.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.miniLabel, { color: colors.mutedForeground }]}>Hotspots</Text>
              {result.summary.availableHotspots.map(h => (
                <Text key={h.uid} style={[styles.choice, { color: colors.foreground }]}>• {h.label}</Text>
              ))}
            </View>
          )}

          {canAdvance && (
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.secondary, borderColor: colors.border, marginTop: 8 }]}
              onPress={advance}
              disabled={busy}
              activeOpacity={0.8}
              accessibilityLabel="Advance dialogue, choice, or hotspot"
              testID="chronica-compat-dev-advance"
            >
              {busy ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather name="arrow-right" size={13} color={colors.primary} />
              )}
              <Text style={[styles.buttonText, { color: colors.foreground }]}>Advance</Text>
            </TouchableOpacity>
          )}

          {!result.ok && result.errors.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.miniLabel, { color: colors.destructive }]}>Errors</Text>
              {result.errors.map((err, i) => (
                <Text key={i} style={[styles.errorItem, { color: colors.destructive }]}>{err}</Text>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function SummaryRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 12, borderRadius: 12, borderWidth: 1, padding: 16, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  subtitle: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  fixtureRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fixtureButton: {
    flex: 1,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  buttonText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  result: { marginTop: 6, gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  rowValue: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  section: { marginTop: 8, gap: 4 },
  miniLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sceneText: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18, marginTop: 2 },
  choice: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  warningItem: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  smokeText: { fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 2 },
  errorItem: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
