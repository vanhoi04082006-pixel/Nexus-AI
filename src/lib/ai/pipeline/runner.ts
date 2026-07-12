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

/**
 * Validate that UML section fields contain valid Mermaid syntax.
 * AI sometimes returns plain Vietnamese text instead of Mermaid diagrams.
 * Each field must start with the correct Mermaid diagram type declaration.
 */
function validateMermaidUML(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  const checks: Record<string, RegExp> = {
    useCase: /^(graph\s+(TD|LR|TB|RL|BT)|flowchart\s+(TD|LR|TB|RL|BT))\b/i,
    classDiagram: /^classDiagram\b/i,
    erd: /^erDiagram\b/i,
    sequence: /^sequenceDiagram\b/i,
  };
  for (const [field, regex] of Object.entries(checks)) {
    const val = obj[field];
    if (typeof val !== "string" || !regex.test(val.trim())) {
      return false; // field missing or not Mermaid syntax
    }
  }
  return true;
}

/**
 * Detect AI degeneration — repeated text patterns.
 * Free models sometimes get stuck repeating a word/phrase thousands of times.
 * Returns true if repetition detected (output is garbage).
 */
function detectRepetition(dataStr: string): boolean {
  if (!dataStr || dataStr.length < 100) return false;
  // Check 1: any single word (4+ chars) appears more than 30 times
  const words = dataStr.match(/\b\w{4,}\b/g) || [];
  const wordCounts: Record<string, number> = {};
  for (const w of words) {
    wordCounts[w] = (wordCounts[w] || 0) + 1;
    if (wordCounts[w] > 30) {
      return true; // degeneration detected
    }
  }
  // Check 2: any 20-char substring repeats more than 10 times
  if (dataStr.length > 500) {
    const seen: Record<string, number> = {};
    for (let i = 0; i < dataStr.length - 20; i += 10) {
      const sub = dataStr.substring(i, i + 20);
      seen[sub] = (seen[sub] || 0) + 1;
      if (seen[sub] > 10) return true;
    }
  }
  // Check 3: ratio of unique chars too low (repetitive content)
  const uniqueChars = new Set(dataStr.split("")).size;
  if (dataStr.length > 500 && uniqueChars < 15) return true;
  return false;
}

/**
 * Self-Healing Mermaid — clean common syntax errors before validation.
 * Strip code fences, fix |use| syntax, ensure newlines between statements.
 */
function cleanMermaidSyntax(rawStr: string): string {
  if (!rawStr || typeof rawStr !== "string") return rawStr;
  let clean = rawStr.trim();
  // Strip code fences (```mermaid ... ```)
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```[a-zA-Z]*\n?/, "").replace(/```\s*$/, "").trim();
  }
  // Fix |use| → plain edge (classDiagram doesn't support |label| syntax)
  clean = clean.replace(/-->\s*\|use\|/g, "-->");
  clean = clean.replace(/-->\s*\|include\|/g, "-->|include|");
  clean = clean.replace(/-.->\s*\|extend\|/g, "-.->|extend|");
  // Fix literal \n → real newlines
  clean = clean.replace(/\\n/g, "\n");
  return clean;
}

/**
 * Apply Self-Healing to UML section data (all string fields that contain Mermaid).
 */
function healUMLData(data: unknown): { data: unknown; healed: boolean } {
  if (!data || typeof data !== "object") return { data, healed: false };
  const obj = data as Record<string, unknown>;
  let healed = false;
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === "string") {
      const original = obj[key] as string;
      const cleaned = cleanMermaidSyntax(original);
      if (original !== cleaned) {
        obj[key] = cleaned;
        healed = true;
      }
    }
  }
  return { data: obj, healed };
}

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
            // FIX: Detect AI degeneration (repeated text like "hang hang hang...")
            const hasRepetition = detectRepetition(dataStr);
            // FIX: Validate Mermaid syntax for UML section (AI sometimes returns plain Vietnamese text)
            const hasInvalidMermaid = sectionKey === "uml" && !validateMermaidUML(zodResult.data);
            if (dataStr.length < 20 || dataStr === "{}" || dataStr === "[]") {
              console.log(`      [${a}] Self-critic: data too empty, retrying`);
              appendLog({ level: "warn", model, message: `  ⚠ ${model} parsed OK but data nearly empty — retrying (attempt ${a})` });
            } else if (hasRepetition) {
              console.log(`      [${a}] Self-critic: detected repetition (degeneration), retrying`);
              appendLog({ level: "warn", model, message: `  ⚠ ${model} parsed OK but degenerated (repeated text) — retrying (attempt ${a})` });
            } else if (hasInvalidMermaid) {
              console.log(`      [${a}] Self-critic: UML fields not valid Mermaid syntax, retrying`);
              appendLog({ level: "warn", model, message: `  ⚠ ${model} UML fields contain plain text instead of Mermaid syntax — retrying (attempt ${a})` });
            } else {
              // SELF-HEALING: Apply Mermaid syntax cleanup for UML sections
              let finalData = zodResult.data;
              if (sectionKey === "uml") {
                const { data: healedData, healed } = healUMLData(zodResult.data);
                if (healed) {
                  finalData = healedData;
                  console.log(`      [${a}] Self-healing: cleaned Mermaid syntax`);
                  appendLog({ level: "info", model, message: `  🔧 ${model} self-healing: cleaned Mermaid syntax (code fences, |use|, \\n)` });
                }
              }
              console.log(`      ✓ ${model} (lan ${a}) [Zod validated + self-critic OK]`);
              appendLog({ level: "success", model, message: `  ✓ ${model} parsed + Zod validated + self-critic OK (attempt ${a})` });
              return { data: finalData, model };
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
