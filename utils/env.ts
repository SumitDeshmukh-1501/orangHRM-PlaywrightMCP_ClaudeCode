/**
 * Typed access to environment configuration. All environment-specific values
 * live in `.env` (loaded by `playwright.config.ts` via dotenv) — never
 * hardcoded in specs, page objects, or config.
 */

/** Reads a required environment variable, failing loudly if it is missing. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(
      `Missing required environment variable "${name}". Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

/** Valid admin credentials for the target instance, from .env. */
export function adminCredentials(): { username: string; password: string } {
  return {
    username: requireEnv('ADMIN_USERNAME'),
    password: requireEnv('ADMIN_PASSWORD'),
  };
}
