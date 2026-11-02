/**
 * Utilería para resolución del nombre del atleta.
 * Soporta parametrización explícita, variable de entorno NEXT_PUBLIC_ATHLETE_NAME
 * y fallback estándar a 'Víctor' según FR-008.
 */

export const DEFAULT_ATHLETE_NAME = 'Víctor';

export function getRequiredAthleteName(
  explicitName?: string,
  env?: Record<string, string | undefined>,
): string {
  const envVal =
    env !== undefined ? env.NEXT_PUBLIC_ATHLETE_NAME : process.env.NEXT_PUBLIC_ATHLETE_NAME;
  const candidate = explicitName?.trim() || envVal?.trim();
  return candidate || DEFAULT_ATHLETE_NAME;
}

export function getAthleteSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function getDefaultSessionToken(
  explicitName?: string,
  env?: Record<string, string | undefined>,
): string {
  const athlete = getRequiredAthleteName(explicitName, env);
  const slug = getAthleteSlug(athlete);
  return `carrera-${slug}`;
}
