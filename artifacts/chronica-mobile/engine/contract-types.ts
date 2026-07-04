/** Shared diagnostic shape for engine contract validation. */
export type ContractSeverity = 'info' | 'warning' | 'error';

export interface ContractDiagnostic {
  domain: string;
  code: string;
  severity: ContractSeverity;
  message: string;
  path?: string;
}

export interface ContractValidationResult {
  ok: boolean;
  diagnostics: ContractDiagnostic[];
  errors: ContractDiagnostic[];
  warnings: ContractDiagnostic[];
}

export function buildContractResult(diagnostics: ContractDiagnostic[]): ContractValidationResult {
  const errors = diagnostics.filter(item => item.severity === 'error');
  const warnings = diagnostics.filter(item => item.severity === 'warning' || item.severity === 'info');
  return {
    ok: errors.length === 0,
    diagnostics,
    errors,
    warnings,
  };
}

export function contractError(
  domain: string,
  code: string,
  message: string,
  path?: string,
): ContractDiagnostic {
  return { domain, code, severity: 'error', message, path };
}

export function contractWarning(
  domain: string,
  code: string,
  message: string,
  path?: string,
): ContractDiagnostic {
  return { domain, code, severity: 'warning', message, path };
}
