// NEXUS AI - OpenRouter API client with multi-key rotation
// Endpoint: https://openrouter.ai/api/v1/chat/completions
//
// Supports multiple API keys to avoid rate limits:
// - OPENROUTER_API_KEY (primary)
// - OPENROUTER_API_KEY_2, OPENROUTER_API_KEY_3, ... (fallbacks)
// On 429 (rate limit) or 401/403 (key invalid), rotates to next key.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CallModelParams {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

export interface OpenRouterError {
  status?: number;
  code?: string;
  message: string;
  retryAfter?: number;
  keyIndex?: number; // which key was used when error occurred
}

/* ===========================================================
   Multi-API key management
=========================================================== */

/** Collect all API keys from environment variables */
function getAllApiKeys(): string[] {
  const keys: string[] = [];
  // Primary key
  if (process.env.OPENROUTER_API_KEY) keys.push(process.env.OPENROUTER_API_KEY);
  // Additional keys: OPENROUTER_API_KEY_2, _3, _4, ...
  for (let i = 2; i <= 10; i++) {
    const key = process.env[`OPENROUTER_API_KEY_${i}`];
    if (key) keys.push(key);
  }
  return keys.filter((k) => k && k.startsWith("sk-or-"));
}

/** Track which keys are rate-limited + when they reset */
const rateLimitedKeys = new Map<number, number>(); // keyIndex → reset timestamp

/** Get the next available API key (skips rate-limited ones) */
function getAvailableKeyIndex(): number {
  const keys = getAllApiKeys();
  if (keys.length === 0) return -1;
  const now = Date.now();
  // Find first key that's not rate-limited
  for (let i = 0; i < keys.length; i++) {
    const resetAt = rateLimitedKeys.get(i);
    if (!resetAt || resetAt < now) {
      rateLimitedKeys.delete(i); // expired, clean up
      return i;
    }
  }
  // All keys rate-limited — return the one that resets soonest
  let soonest = 0;
  let soonestTime = Infinity;
  for (const [idx, resetAt] of rateLimitedKeys) {
    if (resetAt < soonestTime) {
      soonestTime = resetAt;
      soonest = idx;
    }
  }
  return soonest;
}

/** Mark a key as rate-limited for X seconds */
function markKeyRateLimited(keyIndex: number, retryAfter: number) {
  rateLimitedKeys.set(keyIndex, Date.now() + retryAfter * 1000);
  console.log(
    `  [KEY ROTATION] Key #${keyIndex + 1} rate-limited for ${retryAfter}s, ` +
      `switching to next available key`
  );
}

/** Get the actual key string by index */
function getKeyByIndex(index: number): string {
  const keys = getAllApiKeys();
  return keys[index] || "";
}

/** Get total number of configured keys */
export function getApiKeyCount(): number {
  return getAllApiKeys().length;
}

/* ===========================================================
   Call OpenRouter with automatic key rotation
=========================================================== */

/**
 * Call an OpenRouter chat model. Automatically rotates API keys on 429/401/403.
 * Throws OpenRouterError on failure (after all keys exhausted).
 */
export async function callOpenRouter(
  params: CallModelParams,
  timeoutMs = 120000
): Promise<string> {
  const keys = getAllApiKeys();
  if (keys.length === 0) {
    throw {
      status: 401,
      message: "No OPENROUTER_API_KEY configured in .env",
    } as OpenRouterError;
  }

  // Try each available key, rotating on 429/401/403
  let lastError: OpenRouterError | null = null;

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const keyIndex = getAvailableKeyIndex();
    if (keyIndex === -1) {
      // All keys exhausted — wait for soonest reset
      const waitMs = Math.min(
        ...Array.from(rateLimitedKeys.values()).map((t) => Math.max(0, t - Date.now())),
        30000
      );
      if (waitMs > 0) {
        console.log(`  [KEY ROTATION] All keys rate-limited, waiting ${Math.round(waitMs / 1000)}s...`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
    }

    const apiKey = getKeyByIndex(keyIndex);
    if (!apiKey) continue;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "NEXUS AI",
        },
        body: JSON.stringify({
          model: params.model,
          messages: params.messages,
          temperature: params.temperature,
          max_tokens: params.max_tokens ?? 8000,
          top_p: params.top_p ?? 0.9,
          frequency_penalty: params.frequency_penalty ?? 0.1,
          presence_penalty: params.presence_penalty ?? 0.1,
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        let errMsg = `HTTP ${resp.status}`;
        let retryAfter: number | undefined;
        try {
          const body = await resp.json();
          errMsg = body?.error?.message || errMsg;
        } catch {
          /* ignore */
        }
        const ra = resp.headers.get("retry-after");
        if (ra) retryAfter = parseInt(ra) || undefined;

        const err: OpenRouterError = {
          status: resp.status,
          message: errMsg,
          retryAfter,
          keyIndex,
        };

        // 429: rate limit — mark key and try next
        if (resp.status === 429) {
          markKeyRateLimited(keyIndex, retryAfter || 60);
          lastError = err;
          continue; // try next key
        }

        // 401/403: invalid key — skip this key, try next
        if (resp.status === 401 || resp.status === 403) {
          console.log(`  [KEY ROTATION] Key #${keyIndex + 1} invalid (${resp.status}), trying next`);
          lastError = err;
          continue; // try next key
        }

        // Other errors (5xx, etc.) — throw immediately
        throw err;
      }

      // Success!
      const data = await resp.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        throw { message: "Null response from model", keyIndex } as OpenRouterError;
      }
      return content as string;
    } catch (e: unknown) {
      if (e && typeof e === "object" && "status" in e) {
        // Already an OpenRouterError — if 429/401/403 we already continued above
        // This is a different error (5xx, etc.) — throw it
        throw e;
      }
      // Network / abort error — try next key
      const err: OpenRouterError = {
        code: (e as Error)?.name === "AbortError" ? "ETIMEDOUT" : "ENET",
        message: (e as Error)?.message || "Network error",
        keyIndex,
      };
      console.log(`  [KEY ROTATION] Key #${keyIndex + 1} network error: ${err.code}, trying next`);
      lastError = err;
      continue;
    } finally {
      clearTimeout(timer);
    }
  }

  // All keys exhausted
  throw (
    lastError || {
      message: "All API keys exhausted",
    }
  );
}
