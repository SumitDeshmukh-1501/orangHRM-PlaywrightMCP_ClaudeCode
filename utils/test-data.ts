import { randomBytes } from 'crypto';

/**
 * Runtime test data generation. This suite targets a shared public demo
 * instance that resets periodically, so values are always generated fresh —
 * never hardcoded in specs.
 */

/** Short lowercase alphanumeric token, unique enough for one test run. */
export function randomToken(length = 6): string {
  return randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

/**
 * Deliberately bogus username — the `zz_bogus_` prefix makes it obvious in
 * logs that this value was never meant to authenticate.
 */
export function randomBogusUsername(): string {
  return `zz_bogus_user_${randomToken()}`;
}

/** Deliberately bogus password — see {@link randomBogusUsername}. */
export function randomBogusPassword(): string {
  return `zz_bogus_pass_${randomToken()}`;
}

/**
 * A fresh, unique username for a system user this run will CREATE.
 *
 * Constraints confirmed live on the demo instance on 2026-08-14:
 *  - under 5 characters the field renders "Should be at least 5 characters",
 *    so this is always comfortably longer;
 *  - an existing username renders "Already exists" and blocks Save, so the
 *    random suffix is what keeps a create from colliding with another run or
 *    with another user of this shared instance.
 *
 * The `zz_qa_` prefix makes anything accidentally left behind on the shared
 * demo instance obvious and attributable to this suite.
 */
export function randomUsername(): string {
  return `zz_qa_user_${randomToken(8)}`;
}

/**
 * A password that satisfies the Add User form's strength requirements.
 *
 * Confirmed live on 2026-08-14: under 7 characters the field renders
 * "Should have at least 7 characters", and the form shows a live strength
 * meter. The fixed `Zz9!` prefix guarantees an upper-case letter, a
 * lower-case letter, a digit and a symbol are always present (the
 * combination the form's own help text asks for), while the random tail
 * keeps the value fresh per run.
 */
export function randomStrongPassword(): string {
  return `Zz9!${randomToken(8)}`;
}
