// NEXUS AI - Multi-provider AI client (OpenRouter multi-key rotation)
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
  dsRateLimited?: Map<number, number>;
};
const gc = globalThis as typeof globalThis & GlobalCacheStore;
const aiCache: Map<string, { result: string; timestamp: number }> = gc.aiCache ?? new Map();
gc.aiCache = aiCache;
const CACHE_TTL = 3600000;

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
// DeepSeek API (direct — priority provider)
// ===========================================================
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_KEYS: string[] = [
  process.env.DEEPSEEK_API_KEY || "",
  process.env.DEEPSEEK_API_KEY_2 || "",
  process.env.DEEPSEEK_API_KEY_3 || "",
].filter((k) => k && k.startsWith("sk-"));

// Map OpenRouter model names → DeepSeek native model names
const DEEPSEEK_MODEL_MAP: Record<string, string> = {
  "deepseek/deepseek-chat:free": "deepseek-chat",
  "deepseek/deepseek-r1:free": "deepseek-reasoner",
};

// Track rate-limited DeepSeek keys (globalThis to survive dev recompiles)
const dsRateLimited: Map<number, number> = gc.dsRateLimited ?? new Map<number, number>();
gc.dsRateLimited = dsRateLimited;

function getAvailableDeepSeekKey(): number {
  const now = Date.now();
  for (let i = 0; i < DEEPSEEK_KEYS.length; i++) {
    const resetAt = dsRateLimited.get(i);
    if (!resetAt || resetAt < now) {
      dsRateLimited.delete(i);
      return i;
    }
  }
  return -1; // all rate-limited
}

async function callDeepSeek(
  params: CallModelParams,
  timeoutMs = 120000
): Promise<string> {
  if (DEEPSEEK_KEYS.length === 0) {
    throw { status: 401, message: "No DEEPSEEK_API_KEY configured" } as OpenRouterError;
  }

  const dsModel = DEEPSEEK_MODEL_MAP[params.model] || "deepseek-chat";
  const isReasoner = dsModel === "deepseek-reasoner";
  // V4 Pro (reasoner) needs more time to think — up to 5 min
  const effectiveTimeout = isReasoner ? Math.max(timeoutMs, 300000) : timeoutMs;
  const keyIdx = getAvailableDeepSeekKey();
  if (keyIdx === -1) {
    throw { status: 429, message: "All DeepSeek keys rate-limited" } as OpenRouterError;
  }

  const apiKey = DEEPSEEK_KEYS[keyIdx];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), effectiveTimeout);

  try {
    console.log(`      [DeepSeek] Key #${keyIdx + 1}, model: ${dsModel}${isReasoner ? " (V4 Pro — thinking)" : " (V4 Flash)"}`);
    appendLog({
      level: "info",
      provider: "deepseek",
      model: dsModel,
      keyIndex: keyIdx + 1,
      message: `[DeepSeek] Key #${keyIdx + 1}, model: ${dsModel}${isReasoner ? " (V4 Pro)" : " (V4 Flash)"}`,
    });
    const resp = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: dsModel,
        messages: params.messages,
        temperature: params.temperature,
        max_tokens: params.max_tokens ?? 8000,
        top_p: params.top_p ?? 0.9,
        frequency_penalty: params.frequency_penalty ?? 0.1,
        presence_penalty: params.presence_penalty ?? 0.1,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      let errMsg = `HTTP ${resp.status}`;
      try {
        const body = await resp.json();
        errMsg = body?.error?.message || errMsg;
      } catch { /* ignore */ }

      const err: OpenRouterError = {
        status: resp.status,
        message: errMsg,
        keyIndex: keyIdx,
      };

      if (resp.status === 429) {
        const ra = parseInt(resp.headers.get("retry-after") || "60");
        dsRateLimited.set(keyIdx, Date.now() + ra * 1000);
        console.log(`  [DeepSeek] Key #${keyIdx + 1} rate-limited for ${ra}s`);
        appendLog({
          level: "warn",
          provider: "deepseek",
          model: dsModel,
          keyIndex: keyIdx + 1,
          message: `[KEY ROTATION] DeepSeek Key #${keyIdx + 1} rate-limited for ${ra}s`,
        });
        throw err;
      }
      if (resp.status === 401 || resp.status === 403) {
        console.log(`  [DeepSeek] Key #${keyIdx + 1} invalid (${resp.status})`);
        appendLog({
          level: "error",
          provider: "deepseek",
          model: dsModel,
          keyIndex: keyIdx + 1,
          message: `✗ DeepSeek Key #${keyIdx + 1} invalid (${resp.status}) — ${errMsg}`,
        });
        throw err;
      }
      // 402 (insufficient balance) and other errors
      appendLog({
        level: "error",
        provider: "deepseek",
        model: dsModel,
        keyIndex: keyIdx + 1,
        message: `✗ DeepSeek Key #${keyIdx + 1} → [${resp.status}] ${errMsg}`,
      });
      throw err;
    }

    const data = await resp.json();
    const message = data?.choices?.[0]?.message;
    let content = message?.content || "";

    // V4 Pro (reasoner) may have <think> tags or reasoning before JSON
    if (isReasoner && content) {
      content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      // If there's text before the JSON, extract just the JSON part
      const jsonStart = content.indexOf("{");
      if (jsonStart > 0) {
        const beforeJson = content.substring(0, jsonStart).trim();
        if (beforeJson.length < 100) {
          content = content.substring(jsonStart);
        }
      }
    }

    if (!content || !content.trim()) {
      throw { message: "Null response from DeepSeek", keyIndex: keyIdx } as OpenRouterError;
    }

    // Track tokens
    const usage = data?.usage;
    if (usage) {
      lastTokenUsage = {
        model: dsModel,
        keyIndex: keyIdx + 1,
        provider: "deepseek",
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
      };
      totalTokensUsed += lastTokenUsage.totalTokens;
    }

    // Cache (skip for reasoner — non-deterministic thinking)
    if (params.temperature < 0.5 && !isReasoner) {
      const cacheKey = getCacheKey(params.model, params.messages, params.temperature);
      setCachedResult(cacheKey, content);
    }

    console.log(`      [DeepSeek] ✓ Success (${dsModel}${isReasoner ? " V4 Pro" : " V4 Flash"})`);
    appendLog({
      level: "success",
      provider: "deepseek",
      model: dsModel,
      keyIndex: keyIdx + 1,
      message: `✓ DeepSeek ${dsModel} (Key #${keyIdx + 1})`,
    });
    return content as string;
  } catch (e: unknown) {
    if (e && typeof e === "object" && "status" in e) {
      throw e;
    }
    const err: OpenRouterError = {
      code: (e as Error)?.name === "AbortError" ? "ETIMEDOUT" : "ENET",
      message: (e as Error)?.message || "DeepSeek network error",
      keyIndex: keyIdx,
    };
    appendLog({
      level: "error",
      provider: "deepseek",
      model: dsModel,
      keyIndex: keyIdx + 1,
      message: `✗ DeepSeek ${dsModel} → [${err.code}] ${err.message}`,
    });
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ===========================================================
// OpenRouter API (fallback provider — multi-key rotation)
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
  return getAllApiKeys().length + DEEPSEEK_KEYS.length;
}

async function callOpenRouterDirect(
  params: CallModelParams,
  timeoutMs = 120000
): Promise<string> {
  const keys = getAllApiKeys();
  if (keys.length === 0) {
    throw { status: 401, message: "No OPENROUTER_API_KEY configured" } as OpenRouterError;
  }

  let lastError: OpenRouterError | null = null;

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
          console.log(`  [KEY ROTATION] OpenRouter Key #${keyIndex + 1} invalid (${resp.status})`);
          appendLog({
            level: "error",
            provider: "openrouter",
            model: params.model,
            keyIndex: keyIndex + 1,
            message: `✗ [Key #${keyIndex + 1}] ${params.model} → [${resp.status}] invalid key — ${errMsg}`,
          });
          lastError = err;
          continue;
        }
        // 4xx (non-429, non-401/403): invalid model / bad request — log and skip to next model
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
      continue;
    } finally {
      clearTimeout(timer);
    }
  }

  appendLog({
    level: "error",
    provider: "openrouter",
    model: params.model,
    message: `✗ All ${keys.length} OpenRouter keys exhausted for ${params.model}`,
  });
  throw lastError || { message: "All OpenRouter keys exhausted" };
}

// ===========================================================
// MAIN: callOpenRouter — tries DeepSeek first, then OpenRouter
// ===========================================================
export async function callOpenRouter(
  params: CallModelParams,
  timeoutMs = 120000
): Promise<string> {
  // Check cache first
  if (params.temperature < 0.5) {
    const cacheKey = getCacheKey(params.model, params.messages, params.temperature);
    const cached = getCachedResult(cacheKey);
    if (cached) return cached;
  }

  // Step 1: Try DeepSeek API first (if model is a DeepSeek model)
  if (DEEPSEEK_KEYS.length > 0 && DEEPSEEK_MODEL_MAP[params.model]) {
    try {
      return await callDeepSeek(params, timeoutMs);
    } catch (err) {
      const e = err as OpenRouterError;
      console.log(`  [FALLBACK] DeepSeek failed (${e.status || e.code}): ${e.message} → trying OpenRouter`);
      appendLog({
        level: "warn",
        provider: "deepseek",
        model: params.model,
        message: `[FALLBACK] DeepSeek failed (${e.status || e.code}) → switching to OpenRouter`,
      });
    }
  }

  // Step 2: Fall back to OpenRouter (multi-key rotation)
  return callOpenRouterDirect(params, timeoutMs);
}
