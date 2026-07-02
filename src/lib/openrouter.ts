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
  keyIndex?: number;
}

// ===== Token Usage Tracking =====
export interface TokenUsage {
  model: string;
  keyIndex: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

let lastTokenUsage: TokenUsage | null = null;
let totalTokensUsed = 0;

export function getLastTokenUsage(): TokenUsage | null {
  return lastTokenUsage;
}

export function getTotalTokensUsed(): number {
  return totalTokensUsed;
}

export function resetTokenTracking(): void {
  totalTokensUsed = 0;
  lastTokenUsage = null;
}

// ===== In-memory cache (replaces Redis for sandbox) =====
const aiCache = new Map<string, { result: string; timestamp: number }>();
const CACHE_TTL = 3600000; // 1 hour

function getCacheKey(model: string, messages: { role: string; content: string }[], temperature: number): string {
  const content = messages.map((m) => `${m.role}:${m.content}`).join("|");
  return `${model}:${temperature}:${content.substring(0, 500)}`;
}

export function getCachedResult(key: string): string | null {
  const cached = aiCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log("  [CACHE] Hit — skipping API call");
    return cached.result;
  }
  return null;
}

export function setCachedResult(key: string, result: string): void {
  aiCache.set(key, { result, timestamp: Date.now() });
  // Clean old entries
  if (aiCache.size > 100) {
    const oldest = [...aiCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    if (oldest) aiCache.delete(oldest[0]);
  }
}

/* ===========================================================
   Multi-API key management
=========================================================== */

/** Collect all API keys from environment variables — unlimited count */
function getAllApiKeys(): string[] {
  const keys: string[] = [];
  // Primary key
  if (process.env.OPENROUTER_API_KEY) keys.push(process.env.OPENROUTER_API_KEY);
  // Additional keys: OPENROUTER_API_KEY_2, _3, _4, ... up to _100 (unlimited)
  for (let i = 2; i <= 100; i++) {
    const key = process.env[`OPENROUTER_API_KEY_${i}`];
    if (key) keys.push(key);
    else break; // stop at first missing key (keys must be sequential)
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
  // Check cache first (skip for chat — different each time)
  if (params.temperature < 0.5) {
    const cacheKey = getCacheKey(params.model, params.messages, params.temperature);
    const cached = getCachedResult(cacheKey);
    if (cached) return cached;
  }

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

      // Track token usage (store in global for ai.ts to persist)
      const usage = data?.usage;
      if (usage) {
        lastTokenUsage = {
          model: params.model,
          keyIndex: keyIndex + 1,
          promptTokens: usage.prompt_tokens || 0,
          completionTokens: usage.completion_tokens || 0,
          totalTokens: usage.total_tokens || 0,
        };
        totalTokensUsed += lastTokenUsage.totalTokens;
      }

      // Cache result (only for low-temperature deterministic calls)
      if (params.temperature < 0.5) {
        const cacheKey = getCacheKey(params.model, params.messages, params.temperature);
        setCachedResult(cacheKey, content);
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
