// NEXUS AI - AI client (OpenRouter multi-key rotation)
// Each request tries multiple API keys + multiple models, with retry on rate-limit.

import { db } from "./db";
import { appendLog } from "./pipeline-progress";

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
  provider: string;
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

// ===== In-memory cache (stored on globalThis to survive dev recompiles) =====
type GlobalCacheStore = {
  aiCache?: Map<string, { result: string; timestamp: number }>;
  rateLimitedKeys?: Map<number, number>;
  deadModels?: Map<string, number>; // model -> expiry timestamp (ms)
};
const gc = globalThis as typeof globalThis & GlobalCacheStore;
const aiCache: Map<string, { result: string; timestamp: number }> = gc.aiCache ?? new Map();
gc.aiCache = aiCache;
const CACHE_TTL = 3600000;

// ===== Dead-model cache =====
// When a model exhausts ALL API keys with 429 (rate-limited) or 404 (unavailable),
// we mark it "dead" for a cooldown period so other agents skip it instantly
// instead of wasting time retrying the same dead model.
const deadModels: Map<string, number> = gc.deadModels ?? new Map<string, number>();
gc.deadModels = deadModels;
const DEAD_MODEL_COOLDOWN_MS = 120000; // 2 minutes — enough for rate-limit to ease

/** Check if a model is currently dead (all keys exhausted recently). */
export function isModelDead(model: string): boolean {
  const expiry = deadModels.get(model);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    deadModels.delete(model);
    return false;
  }
  return true;
}

/** Mark a model as dead for the cooldown period. */
function markModelDead(model: string, reason: string): void {
  deadModels.set(model, Date.now() + DEAD_MODEL_COOLDOWN_MS);
  console.log(`  [DEAD MODEL] ${model} marked dead for ${DEAD_MODEL_COOLDOWN_MS / 1000}s (${reason})`);
  appendLog({
    level: "warn",
    provider: "openrouter",
    model,
    message: `[DEAD MODEL] ${model} marked dead for ${DEAD_MODEL_COOLDOWN_MS / 1000}s — other agents will skip it (${reason})`,
  });
}

function getCacheKey(model: string, messages: { role: string; content: string }[], temperature: number): string {
  const content = messages.map((m) => `${m.role}:${m.content}`).join("|");
  return `${model}:${temperature}:${content.substring(0, 500)}`;
}

export function getCachedResult(key: string): string | null {
  const cached = aiCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log("  [CACHE] Hit — skipping API call");
    appendLog({
      level: "info",
      provider: "cache",
      message: "[CACHE] Hit — skip API call (cached ≤1h)",
    });
    return cached.result;
  }
  return null;
}

export function setCachedResult(key: string, result: string): void {
  aiCache.set(key, { result, timestamp: Date.now() });
  if (aiCache.size > 100) {
    const oldest = [...aiCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    if (oldest) aiCache.delete(oldest[0]);
  }
}

// ===========================================================
// OpenRouter API (multi-key rotation)
// ===========================================================
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function getAllApiKeys(): string[] {
  const keys: string[] = [];
  if (process.env.OPENROUTER_API_KEY) keys.push(process.env.OPENROUTER_API_KEY);
  for (let i = 2; i <= 100; i++) {
    const key = process.env[`OPENROUTER_API_KEY_${i}`];
    if (key) keys.push(key);
    else break;
  }
  return keys.filter((k) => k && k.startsWith("sk-or-"));
}

const rateLimitedKeys: Map<number, number> = gc.rateLimitedKeys ?? new Map<number, number>();
gc.rateLimitedKeys = rateLimitedKeys;

function getAvailableKeyIndex(): number {
  const keys = getAllApiKeys();
  if (keys.length === 0) return -1;
  const now = Date.now();
  for (let i = 0; i < keys.length; i++) {
    const resetAt = rateLimitedKeys.get(i);
    if (!resetAt || resetAt < now) {
      rateLimitedKeys.delete(i);
      return i;
    }
  }
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

function markKeyRateLimited(keyIndex: number, retryAfter: number) {
  rateLimitedKeys.set(keyIndex, Date.now() + retryAfter * 1000);
  console.log(`  [KEY ROTATION] OpenRouter Key #${keyIndex + 1} rate-limited for ${retryAfter}s`);
  appendLog({
    level: "warn",
    provider: "openrouter",
    keyIndex: keyIndex + 1,
    message: `[KEY ROTATION] OpenRouter Key #${keyIndex + 1} rate-limited for ${retryAfter}s`,
  });
}

function getKeyByIndex(index: number): string {
  const keys = getAllApiKeys();
  return keys[index] || "";
}

export function getApiKeyCount(): number {
  return getAllApiKeys().length;
}

async function callOpenRouterDirect(
  params: CallModelParams,
  timeoutMs = 300000
): Promise<string> {
  const keys = getAllApiKeys();
  if (keys.length === 0) {
    throw { status: 401, message: "No OPENROUTER_API_KEY configured" } as OpenRouterError;
  }

  let lastError: OpenRouterError | null = null;
  let etimedoutCount = 0; // Track consecutive ETIMEDOUT — don't try all 19 keys if model is slow
  let saw429 = false; // Track if any key got 429 — used to mark model dead even if last error is 401

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const keyIndex = getAvailableKeyIndex();
    if (keyIndex === -1) {
      const waitMs = Math.min(
        ...Array.from(rateLimitedKeys.values()).map((t) => Math.max(0, t - Date.now())),
        30000
      );
      if (waitMs > 0) {
        console.log(`  [KEY ROTATION] All OpenRouter keys rate-limited, waiting ${Math.round(waitMs / 1000)}s...`);
        appendLog({
          level: "warn",
          provider: "openrouter",
          message: `[KEY ROTATION] All OpenRouter keys rate-limited — waiting ${Math.round(waitMs / 1000)}s...`,
        });
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
    }

    const apiKey = getKeyByIndex(keyIndex);
    if (!apiKey) continue;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      console.log(`      [OpenRouter] Key #${keyIndex + 1}, model: ${params.model}`);
      appendLog({
        level: "info",
        provider: "openrouter",
        model: params.model,
        keyIndex: keyIndex + 1,
        message: `[OpenRouter] Key #${keyIndex + 1}, model: ${params.model}`,
      });
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
        try {
          const body = await resp.json();
          errMsg = body?.error?.message || errMsg;
        } catch { /* ignore */ }

        const ra = resp.headers.get("retry-after");
        const retryAfter = ra ? parseInt(ra) : undefined;
        const err: OpenRouterError = { status: resp.status, message: errMsg, retryAfter, keyIndex };

        if (resp.status === 429) {
          saw429 = true;
          appendLog({
            level: "error",
            provider: "openrouter",
            model: params.model,
            keyIndex: keyIndex + 1,
            message: `✗ [Key #${keyIndex + 1}] ${params.model} → [429] ${errMsg}`,
          });
          markKeyRateLimited(keyIndex, retryAfter || 60);
          lastError = err;
          continue;
        }
        if (resp.status === 401 || resp.status === 403) {
          console.log(`  [KEY ROTATION] OpenRouter Key #${keyIndex + 1} invalid (${resp.status}) — disabling for 24h`);
          appendLog({
            level: "error",
            provider: "openrouter",
            model: params.model,
            keyIndex: keyIndex + 1,
            message: `✗ [Key #${keyIndex + 1}] ${params.model} → [${resp.status}] invalid key — disabling for 24h — ${errMsg}`,
          });
          // Mark invalid key as rate-limited for 24h so getAvailableKeyIndex skips it
          // (prevents infinite retry loop on the same invalid key)
          markKeyRateLimited(keyIndex, 86400);
          lastError = err;
          continue;
        }
        // 4xx (non-429, non-401/403): invalid model / bad request — mark dead + skip to next model
        if (resp.status === 404) {
          markModelDead(params.model, "model unavailable (404)");
        }
        appendLog({
          level: "error",
          provider: "openrouter",
          model: params.model,
          keyIndex: keyIndex + 1,
          message: `✗ [Key #${keyIndex + 1}] ${params.model} → [${resp.status}] ${errMsg}`,
        });
        throw err;
      }

      const data = await resp.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        throw { message: "Null response", keyIndex } as OpenRouterError;
      }

      const usage = data?.usage;
      if (usage) {
        lastTokenUsage = {
          model: params.model,
          keyIndex: keyIndex + 1,
          provider: "openrouter",
          promptTokens: usage.prompt_tokens || 0,
          completionTokens: usage.completion_tokens || 0,
          totalTokens: usage.total_tokens || 0,
        };
        totalTokensUsed += lastTokenUsage.totalTokens;
      }

      if (params.temperature < 0.5) {
        const cacheKey = getCacheKey(params.model, params.messages, params.temperature);
        setCachedResult(cacheKey, content);
      }

      console.log(`      [OpenRouter] ✓ Success (${params.model})`);
      appendLog({
        level: "success",
        provider: "openrouter",
        model: params.model,
        keyIndex: keyIndex + 1,
        message: `✓ [Key #${keyIndex + 1}] ${params.model} → Success`,
      });
      return content as string;
    } catch (e: unknown) {
      if (e && typeof e === "object" && "status" in e) {
        throw e;
      }
      const err: OpenRouterError = {
        code: (e as Error)?.name === "AbortError" ? "ETIMEDOUT" : "ENET",
        message: (e as Error)?.message || "Network error",
        keyIndex,
      };
      console.log(`  [KEY ROTATION] OpenRouter Key #${keyIndex + 1} network error: ${err.code}`);
      appendLog({
        level: "error",
        provider: "openrouter",
        model: params.model,
        keyIndex: keyIndex + 1,
        message: `✗ [Key #${keyIndex + 1}] ${params.model} → [${err.code}] ${err.message}`,
      });
      lastError = err;
      // ETIMEDOUT = model is slow, not broken. Don't try all 19 keys (would take 95 min).
      // Break after 2 consecutive ETIMEDOUTs — caller (callAndParse) will retry the model.
      if (err.code === "ETIMEDOUT") {
        etimedoutCount++;
        if (etimedoutCount >= 2) {
          appendLog({
            level: "warn",
            provider: "openrouter",
            model: params.model,
            message: `⏳ ${params.model} timed out on ${etimedoutCount} keys — model may be slow, will retry`,
          });
          break;
        }
      }
      continue;
    } finally {
      clearTimeout(timer);
    }
  }

  appendLog({
    level: "error",
    provider: "openrouter",
    model: params.model,
    message: `✗ All available OpenRouter keys exhausted for ${params.model}`,
  });
  // Only mark model dead on 429 (rate-limited) or 404 (unavailable).
  // Do NOT mark dead on ETIMEDOUT/ENET — model may just be slow, not broken.
  // Also mark dead if saw429 is true (some keys got 429) even if last error was 401.
  if (lastError?.status === 404) {
    markModelDead(params.model, "model unavailable (404)");
  } else if (lastError?.status === 429 || saw429) {
    markModelDead(params.model, "all keys rate-limited (429)");
  }
  // ETIMEDOUT/ENET/401 → don't mark dead, just throw so caller retries
  throw lastError || { message: "All OpenRouter keys exhausted" };
}

// ===========================================================
// MAIN: callOpenRouter — cache → OpenRouter (multi-key rotation)
// ===========================================================
export async function callOpenRouter(
  params: CallModelParams,
  timeoutMs = 300000
): Promise<string> {
  // Check cache first
  if (params.temperature < 0.5) {
    const cacheKey = getCacheKey(params.model, params.messages, params.temperature);
    const cached = getCachedResult(cacheKey);
    if (cached) return cached;
  }

  // Call OpenRouter (multi-key rotation)
  return callOpenRouterDirect(params, timeoutMs);
}
