import crypto from "node:crypto";

const URL_SAFE = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** A short, URL-safe, collision-resistant id (nanoid-style, crypto random). */
export function nano(length = 20): string {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += URL_SAFE[bytes[i]! % URL_SAFE.length];
  return out;
}

/** Public request id echoed to callers and stored in api_request_log (<=24 chars). */
export function newRequestId(): string {
  return "req_" + nano(20);
}
