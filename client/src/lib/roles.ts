// Single source of truth (client-side) for "who can verify / write data".
// MUST stay in sync with the backend route gates in `vinRoutes.ts`
// (`/verify`, `/log`, `/generate-draft`, `/images`, `/ledger/:vin`, `/specs`).
// The server is the real authority — this only controls what UI we bother to show
// (so a read-only role never lands on a form whose actions would 403).
export const VERIFIER_ROLES = ["super_admin", "garage_admin", "diagnostician"] as const;

/** True if the role may verify/record/edit vehicles. `user` and `insurance` are read-only. */
export function canVerify(role?: string | null): boolean {
  return !!role && (VERIFIER_ROLES as readonly string[]).includes(role);
}
