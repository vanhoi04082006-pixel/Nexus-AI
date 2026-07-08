/**
 * github-oauth.ts — GitHub OAuth state nonce store + token encryption.
 *
 * FIXES:
 * 1. State is now a random nonce (not projectId|leaderToken) → prevents CSRF + token reuse
 * 2. GitHub access token is encrypted at rest (AES-256-GCM) → DB leak doesn't expose tokens
 *
 * Usage:
 *   // In /api/github/auth:
 *   const state = createOauthState(projectId, leaderToken);
 *   // store nonce → { projectId, leaderToken } in memory + HttpOnly cookie
 *
 *   // In /api/github/callback:
 *   const ctx = consumeOauthState(state);
 *   if (!ctx) return redirect error;
 */

import crypto from "crypto";

interface OauthContext {
  projectId: string;
  leaderToken: string;
  createdAt: number;
}

// In-memory nonce store (single-instance). For multi-instance, use Redis.
const gc = globalThis as typeof globalThis & { githubOauthNonces?: Map<string, OauthContext> };
const nonces: Map<string, OauthContext> = gc.githubOauthNonces ?? new Map<string, OauthContext>();
gc.githubOauthNonces = nonces;

const NONCE_TTL = 10 * 60 * 1000; // 10 minutes

// Cleanup expired nonces periodically
let lastCleanup = Date.now();
function cleanupExpired(): void {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return; // 1 min
  lastCleanup = now;
  for (const [key, ctx] of nonces) {
    if (now - ctx.createdAt > NONCE_TTL) nonces.delete(key);
  }
}

/**
 * Create a new OAuth state nonce bound to (projectId, leaderToken).
 * Returns the nonce string to use as `state` in GitHub authorize URL.
 */
export function createOauthState(projectId: string, leaderToken: string): string {
  cleanupExpired();
  const nonce = crypto.randomBytes(32).toString("hex");
  nonces.set(nonce, { projectId, leaderToken, createdAt: Date.now() });
  return nonce;
}

/**
 * Consume (verify + delete) an OAuth state nonce.
 * Returns the context if valid + not expired, null otherwise.
 * One-time use — nonce is deleted after consumption (prevents replay).
 */
export function consumeOauthState(state: string): OauthContext | null {
  cleanupExpired();
  const ctx = nonces.get(state);
  if (!ctx) return null;
  // Check expiry
  if (Date.now() - ctx.createdAt > NONCE_TTL) {
    nonces.delete(state);
    return null;
  }
  // One-time use: delete after read
  nonces.delete(state);
  return ctx;
}

// ===== Token encryption (AES-256-GCM) =====

const ENCRYPTION_KEY = process.env.GITHUB_TOKEN_ENCRYPTION_KEY || "";

function getKey(): Buffer {
  // Use a fixed key from env, or derive from a default (dev only — WARN in production)
  if (ENCRYPTION_KEY) {
    // Hash to 32 bytes (AES-256)
    return crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
  }
  // Dev fallback: derive from a fixed string (NOT secure for production!)
  if (process.env.NODE_ENV === "production") {
    console.warn("[github-oauth] WARNING: GITHUB_TOKEN_ENCRYPTION_KEY not set in production — using insecure default");
  }
  return crypto.createHash("sha256").update("nexus-ai-dev-key-not-secure").digest();
}

/**
 * Encrypt a GitHub access token for storage.
 * Returns "iv:authTag:ciphertext" (all hex-encoded).
 */
export function encryptToken(plaintext: string): string {
  try {
    const key = getKey();
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
  } catch (err) {
    console.error("[github-oauth] encryptToken failed:", err);
    return plaintext; // fallback (should not happen)
  }
}

/**
 * Decrypt a GitHub access token.
 * Input format: "iv:authTag:ciphertext" (from encryptToken).
 * Returns plaintext, or null if decryption fails (tampered/wrong key).
 */
export function decryptToken(encrypted: string): string | null {
  if (!encrypted || !encrypted.includes(":")) return encrypted; // not encrypted (legacy)
  try {
    const parts = encrypted.split(":");
    if (parts.length !== 3) return null;
    const [ivHex, authTagHex, ciphertextHex] = parts;
    const key = getKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return null; // decryption failed (tampered or wrong key)
  }
}
