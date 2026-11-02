/**
 * Utilería para resolución y validación estricta del nombre del atleta.
 * Falla de inmediato (Fail-Fast) si NEXT_PUBLIC_ATHLETE_NAME no está configurada,
 * evitando fallbacks estáticos silenciosos.
 */

export function getRequiredAthleteName(
  explicitName?: string,
  env: Record<string, string | undefined> = process.env,
): string {
  const candidate = explicitName?.trim() || env.NEXT_PUBLIC_ATHLETE_NAME?.trim();
  if (!candidate) {
    throw new Error(
      'La variable de entorno NEXT_PUBLIC_ATHLETE_NAME no está definida y no se proporcionó ningún nombre de atleta.',
    );
  }
  return candidate;
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
  env: Record<string, string | undefined> = process.env,
): string {
  const athlete = getRequiredAthleteName(explicitName, env);
  const slug = getAthleteSlug(athlete);
  return `carrera-${slug}`;
}
