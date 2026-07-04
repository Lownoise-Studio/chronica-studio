import { fromValidationError } from '../engine/diagnostics';

describe('foundation audit phase 1 — consistency fixes', () => {
  test('fromValidationError preserves warning severity from validation ladder', () => {
    const warning = fromValidationError({
      fragmentUid: 'f1',
      fragmentTitle: 'Room',
      type: 'orphan-scene',
      message: 'Scene "extra" is unreachable.',
      severity: 'warning',
    });

    expect(warning.severity).toBe('warning');
    expect(warning.recoveryCategory).toBe('auto-recovered');
    expect(warning.code).toBe('TRANSITION_TARGET_INVALID');
  });

  test('fromValidationError maps blocking compile errors to error severity', () => {
    const blocking = fromValidationError({
      fragmentUid: 'f1',
      fragmentTitle: 'Room',
      type: 'broken-link',
      message: 'Choice points to unknown scene "missing".',
    });

    expect(blocking.severity).toBe('error');
    expect(blocking.recoveryCategory).toBe('project-repair-recommended');
  });

  test('fromValidationError honors ValidationError.level', () => {
    const info = fromValidationError({
      fragmentUid: 'f1',
      fragmentTitle: 'Room',
      type: 'invalid-action',
      message: 'Adventure note.',
      level: 'info',
    });

    expect(info.severity).toBe('info');
    expect(info.recoveryCategory).toBe('auto-recovered');
  });
});
