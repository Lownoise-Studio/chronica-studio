import { isChronicaPackageBytes } from './chronica-package';
import { Project, ValidationError } from './types';

export type LoadGameImportFns = {
  importProject: (json: string) => { ok: boolean; error?: string; project?: Project };
  importProjectPackage: (bytes: Uint8Array) => Promise<{ ok: boolean; error?: string; project?: Project; diagnostics?: ValidationError[] }>;
};

export type LoadGameResult =
  | { ok: true; project: Project; kind: 'package' | 'json' }
  | { ok: false; error: string; cancelled?: boolean; diagnostics?: ValidationError[] };

export async function loadGameFromBytes(
  bytes: Uint8Array,
  importFns: LoadGameImportFns,
): Promise<LoadGameResult> {
  if (isChronicaPackageBytes(bytes)) {
    const outcome = await importFns.importProjectPackage(bytes);
    if (outcome.ok && outcome.project) {
      return { ok: true, project: outcome.project, kind: 'package' };
    }
    return { ok: false, error: outcome.error ?? 'Could not load game package.', diagnostics: outcome.diagnostics };
  }

  const content = new TextDecoder().decode(bytes);
  const outcome = importFns.importProject(content);
  if (outcome.ok && outcome.project) {
    return { ok: true, project: outcome.project, kind: 'json' };
  }
  return { ok: false, error: outcome.error ?? 'Could not load story file.' };
}
