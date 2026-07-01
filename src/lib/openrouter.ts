// NEXUS AI - OpenRouter API client
// Endpoint: https://openrouter.ai/api/v1/chat/completions

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
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
}

/**
 * Call an OpenRouter chat model. Throws OpenRouterError on failure.
 */
export async function callOpenRouter(
  params: CallModelParams,
  timeoutMs = 120000
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
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
      };
      throw err;
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw { message: "Null response from model" } as OpenRouterError;
    return content as string;
  } catch (e: unknown) {
    if (e && typeof e === "object" && "status" in e) {
      throw e; // already an OpenRouterError
    }
    // Network / abort error
    const err: OpenRouterError = {
      code: (e as Error)?.name === "AbortError" ? "ETIMEDOUT" : "ENET",
      message: (e as Error)?.message || "Network error",
    };
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
