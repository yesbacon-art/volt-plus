import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const HASH_ITERATIONS = 310_000;
const HASH_KEYLEN = 32;
const HASH_DIGEST = "sha256";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEYLEN, HASH_DIGEST).toString(
    "hex"
  );
  return `pbkdf2$${HASH_ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash) return false;
  const [scheme, iterationsText, salt, hash] = storedHash.split("$");
  if (scheme !== "pbkdf2" || !iterationsText || !salt || !hash) return false;
  const iterations = Number(iterationsText);
  if (!Number.isInteger(iterations) || iterations < 100_000) return false;

  const actual = pbkdf2Sync(password, salt, iterations, HASH_KEYLEN, HASH_DIGEST);
  const expected = Buffer.from(hash, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
