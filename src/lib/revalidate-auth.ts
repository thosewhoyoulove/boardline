import { createHash, timingSafeEqual } from "node:crypto";

const MAX_TOKEN_LENGTH = 512;

export type RevalidateAuth = { ok: true } | { ok: false; status: 401 | 503 };

export function bearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization.trim());
  return match?.[1] ?? null;
}

/** Compare digests so a length mismatch does not short-circuit the check. */
export function secretsMatch(provided: string, expected: string): boolean {
  const providedDigest = createHash("sha256").update(provided).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

export function authorizeRevalidate(authorization: string | null, secret: string | undefined): RevalidateAuth {
  if (!secret) return { ok: false, status: 503 };
  const token = bearerToken(authorization);
  if (!token || token.length > MAX_TOKEN_LENGTH || !secretsMatch(token, secret)) {
    return { ok: false, status: 401 };
  }
  return { ok: true };
}
