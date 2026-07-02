import { ChronicaSession } from '../chronica-session';
import {
  ECHO_MODULE_ID,
  INSTABILITY_MODULE_ID,
  createEchoModule,
  createInstabilityModule,
  type EchoModuleConfig,
  type InstabilityModuleConfig,
} from '../modules';
import { ingestChronicaPackageForMobilePlayer } from './ingest';
import type {
  CreateMobileSessionOptions,
  MobileSessionResult,
  MobileSessionSuccess,
  ParsedChronicaPackage,
} from './types';

function resolveInstabilityConfig(
  pkg: ParsedChronicaPackage,
  requested: boolean | InstabilityModuleConfig | undefined,
): InstabilityModuleConfig | null {
  if (!requested) return null;
  if (typeof requested === 'object') return requested;
  const hint = pkg.modules?.[INSTABILITY_MODULE_ID];
  return isRecord(hint) ? (hint as InstabilityModuleConfig) : {};
}

function resolveEchoConfig(
  pkg: ParsedChronicaPackage,
  requested: boolean | EchoModuleConfig | undefined,
): EchoModuleConfig | null {
  if (!requested) return null;
  if (typeof requested === 'object') return requested;
  const hint = pkg.modules?.[ECHO_MODULE_ID];
  return isRecord(hint) ? (hint as EchoModuleConfig) : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Convenience wrapper — ingest a parsed package and hand back a ready
 * {@link ChronicaSession}. Optionally attaches first-party modules and
 * calls `start()` before returning.
 *
 * Returns the ingest failure shape unchanged when compatibility rejects the
 * package, so callers only need one control-flow branch.
 */
export async function createMobileSessionFromChronicaPackage(
  pkg: ParsedChronicaPackage,
  options: CreateMobileSessionOptions = {},
): Promise<MobileSessionResult> {
  const ingest = ingestChronicaPackageForMobilePlayer(pkg, options);
  if (!ingest.ok) return ingest;

  const session = new ChronicaSession(ingest.game);

  const instabilityConfig = resolveInstabilityConfig(pkg, options.modules?.instability);
  if (instabilityConfig) {
    session.register(createInstabilityModule(instabilityConfig));
  }
  const echoConfig = resolveEchoConfig(pkg, options.modules?.echo);
  if (echoConfig) {
    session.register(createEchoModule(echoConfig));
  }

  if (options.autoStart) {
    await session.start();
  }

  const success: MobileSessionSuccess = {
    ...ingest,
    session,
  };
  return success;
}
