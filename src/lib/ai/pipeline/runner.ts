// ai/pipeline/runner.ts — callModel + callAndParse (retry engine + JSON parser)
// Extracted from ai.ts Phase 2

import { callOpenRouter, type OpenRouterError, isModelDead, getModelHealth } from "@/lib/openrouter";
import { appendLog } from "@/lib/pipeline-progress";
import { validateSection } from "@/lib/schemas";
import pLimit from "p-limit";
import type { SectionType } from "@/lib/types";
import {
  MAX_RETRIES, INIT_DELAY, BACKOFF_MULT, MAX_DELAY, RATE_LIMIT_DELAY,
  MAX_CONCURRENCY, getAdaptiveTimeout, jitteredDelay, wait,
} from "../config/constants";

import { JFix } from "../utils/jfix";

const limiter = pLimit(MAX_CONCURRENCY);

export interface ParseResult {
  data: unknown;
  model: string;
}

export async function callModel(
  model: string,
  sys: string,
  usr: string,
  temp: number
): Promise<string> {
  return limiter(() => callOpenRouter(
    {
      model,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: usr },
      ],
      temperature: temp,
      max_tokens: 8000,
      top_p: 0.9,
      frequency_penalty: 0.1,
      presence_penalty: 0.1,
    },
    getAdaptiveTimeout(model)
  ));
}

export async function callAndParse(
  models: string[],
  sys: string,
  usr: string,
  temp: number,
  sectionKey?: string
): Promise<ParseResult | null> {
  // ===== Priority Model Sorting =====
  const sortedModels = [...models].sort((a, b) => {
    const ha = getModelHealth(a);
    const hb = getModelHealth(b);
    if (hb.successRate !== ha.successRate) return hb.successRate - ha.successRate;
    return hb.totalCalls - ha.totalCalls;
  });

  for (const model of sortedModels) {
    if (isModelDead(model)) {
      appendLog({
        level: "warn",
        model,
        message: `  ⊘ ${model} → SKIP (model marked dead)`,
      });
      console.log(`      [SKIP] ${model} (dead)`);
      continue;
    }
    let d = INIT_DELAY;

    for (let a = 1; a <= MAX_RETRIES; a++) {
      try {
        console.log(`      [${a}/${MAX_RETRIES}] ${model}`);
        appendLog({
          level: "info",
          model,
          message: `  → [${a}/${MAX_RETRIES}] trying ${model}`,
        });
        const raw = await callModel(model, sys, usr, temp);
        let data: unknown = null;

        // Parse pipeline: JSON.parse → JFix fallback → extract substring → AI self-fix
        try { data = JSON.parse(raw.trim()); } catch { /* continue */ }
        if (!data) try { data = JSON.parse(JFix.fix(raw)); } catch { /* continue */ }
        if (!data) {
          const s = raw.indexOf("{");
          const e = raw.lastIndexOf("}");
          if (s !== -1 && e > s) try { data = JSON.parse(JFix.fix(raw.substring(s, e + 1))); } catch { /* continue */ }
        }
        if (!data) {
          console.log(`      [${a}] JSON loi, AI sua...`);
          appendLog({ level: "warn", model, message: `  ⚠ [${a}] ${model} returned invalid JSON — AI self-fix pass` });
          const fix = await callModel(model, "JSON fixer. Chi tra JSON hop le.", `Sua JSON loi:\n${(raw || "").substring(0, 5000)}`, 0.1);
          data = JFix.parse(fix);
        }

        if (data) {
          const zodResult = validateSection(sectionKey || "", data);
          if (zodResult.success) {
            // ===== Self-Critic =====
            const dataStr = JSON.stringify(zodResult.data);
            if (dataStr.length < 20 || dataStr === "{}" || dataStr === "[]") {
              console.log(`      [${a}] Self-critic: data too empty, retrying`);
              appendLog({ level: "warn", model, message: `  ⚠ ${model} parsed OK but data nearly empty — retrying (attempt ${a})` });
            } else {
              console.log(`      ✓ ${model} (lan ${a}) [Zod validated + self-critic OK]`);
              appendLog({ level: "success", model, message: `  ✓ ${model} parsed + Zod validated + self-critic OK (attempt ${a})` });
              return { data: zodResult.data, model };
            }
          } else {
            console.log(`      [${a}] Zod validation failed: ${zodResult.error.substring(0, 80)}`);
            appendLog({ level: "warn", model, message: `  ⚠ [${a}] ${model} JSON valid but schema mismatch: ${zodResult.error.substring(0, 100)} — AI fixing` });
            const fixPrompt = `JSON cua ban da parse thanh cong nhung SAI CAU TRUC. Loi: ${zodResult.error}\n\nSua lai JSON cho dung schema:\n${JSON.stringify(data).substring(0, 5000)}`;
            const fixRaw = await callModel(model, "JSON schema fixer. Tra JSON dung schema.", fixPrompt, 0.1);
            let fixedData: unknown = null;
            try { fixedData = JSON.parse(fixRaw.trim()); } catch { fixedData = JFix.parse(fixRaw); }
            if (fixedData) {
              const revalidate = validateSection(sectionKey || "", fixedData);
              if (revalidate.success) {
                console.log(`      ✓ ${model} (lan ${a}) [Zod re-validated after fix]`);
                appendLog({ level: "success", model, message: `  ✓ ${model} Zod validated after AI fix (attempt ${a})` });
                return { data: revalidate.data, model };
              }
            }
            appendLog({ level: "warn", model, message: `  ⚠ [${a}] ${model} Zod fix failed — will retry` });
          }
        }
      } catch (err) {
        const e = err as OpenRouterError;
        const st = e.status;
        const msg = (e.message || "").substring(0, 120);
        console.log(`      ✗ [${a}] ${model} → [${st || e.code || "NET"}] ${msg}`);
        appendLog({ level: "error", model, keyIndex: e.keyIndex != null ? e.keyIndex + 1 : undefined, message: `  ✗ [${a}/${MAX_RETRIES}] ${model} → [${st || e.code || "NET"}] ${msg}` });

        if (st === 429) {
          const ra = e.retryAfter || 60;
          const jittered = jitteredDelay(INIT_DELAY, a);
          const waitMs = Math.max(RATE_LIMIT_DELAY, Math.min(ra * 1000, MAX_DELAY)) + Math.min(jittered, 5000);
          console.log(`      ⏳ Rate limit, doi ${Math.round(waitMs / 1000)}s (60s + jitter)`);
          appendLog({ level: "warn", model, message: `  ⏳ Rate-limited — waiting ${Math.round(waitMs / 1000)}s before retry (60s base + jitter)` });
          await wait(waitMs);
          d = Math.min(d * BACKOFF_MULT, MAX_DELAY);
          continue;
        }

        if ((st && st >= 500) || e.code === "ETIMEDOUT" || e.code === "ENET" || e.code === "ECONNRESET") {
          const isTimeout = e.code === "ETIMEDOUT";
          const jittered = jitteredDelay(INIT_DELAY, a);
          const waitMs = Math.max(RATE_LIMIT_DELAY, jittered);
          console.log(`      ⏳ ${isTimeout ? "Timeout" : "Server/timeout"}, doi ${Math.round(waitMs / 1000)}s`);
          appendLog({ level: "warn", model, message: isTimeout ? `  ⏳ Timeout — retrying in ${Math.round(waitMs / 1000)}s (attempt ${a}/${MAX_RETRIES})` : `  ⏳ Server/timeout — retrying in ${Math.round(waitMs / 1000)}s` });
          await wait(waitMs);
          d = Math.min(d * BACKOFF_MULT, MAX_DELAY);
          continue;
        }

        if (st === 401 || st === 403) {
          appendLog({ level: "warn", model, message: `  ⚠ ${model} → skip to next model (keys invalid ${st})` });
          break;
        }

        appendLog({ level: "warn", model, message: `  ⚠ ${model} → skip to next model (HTTP ${st})` });
        break;
      }
    }
  }
  return null;
}
