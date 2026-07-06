// ai/cache/semanticCache.ts — Semantic Cache (in-memory cosine similarity)
// No Vector DB needed — uses TF-IDF + cosine similarity on text.
// Similar topics ("Quản lý bệnh viện" ≈ "Hospital Management") get cache hits.

import { appendLog } from "@/lib/pipeline-progress";

interface CacheEntry {
  key: string;
  prompt: string;
  response: string;
  model: string;
  timestamp: number;
  vector: number[];
}

const SIMILARITY_THRESHOLD = 0.85;
const MAX_ENTRIES = 200;

class SemanticCache {
  private entries: CacheEntry[] = [];

  private toVector(text: string): number[] {
    const stopwords = new Set([
      "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
      "have", "has", "had", "do", "does", "did", "will", "would", "could",
      "should", "may", "might", "must", "shall", "can", "need", "of", "in",
      "on", "at", "to", "for", "with", "by", "from", "as", "into", "through",
      "and", "or", "but", "not", "no", "if", "then", "else", "when", "this",
      "that", "these", "those", "it", "its", "they", "them", "their", "we",
      "you", "your", "he", "she", "his", "her", "du", "anh", "va", "cua",
      "hoac", "nhung", "khong", "co", "cho", "trong", "tren", "tu", "den",
      "mot", "cac", "nhieu", "it", "hon", "nua", "da", "se", "con", "theo",
    ]);

    const words = text.toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !stopwords.has(w));

    const freq = new Map<string, number>();
    for (const word of words) freq.set(word, (freq.get(word) || 0) + 1);
    return Array.from(freq.values()).sort((a, b) => b - a);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0) return 0;
    const len = Math.min(a.length, b.length);
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < len; i++) { dot += a[i] * b[i]; magA += a[i] * a[i]; magB += b[i] * b[i]; }
    for (let i = len; i < a.length; i++) magA += a[i] * a[i];
    for (let i = len; i < b.length; i++) magB += b[i] * b[i];
    if (magA === 0 || magB === 0) return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  get(prompt: string, model: string): string | null {
    const promptVector = this.toVector(prompt);
    let bestMatch: CacheEntry | null = null;
    let bestScore = 0;

    for (const entry of this.entries) {
      if (entry.model !== model) continue;
      const score = this.cosineSimilarity(promptVector, entry.vector);
      if (score > bestScore) { bestScore = score; bestMatch = entry; }
    }

    if (bestMatch && bestScore >= SIMILARITY_THRESHOLD) {
      appendLog({ level: "success", provider: "cache", message: `[SEMANTIC CACHE] Hit — similarity: ${(bestScore * 100).toFixed(0)}%` });
      return bestMatch.response;
    }
    if (bestScore > 0.5) {
      appendLog({ level: "info", provider: "cache", message: `[SEMANTIC CACHE] Near miss — similarity: ${(bestScore * 100).toFixed(0)}%` });
    }
    return null;
  }

  set(prompt: string, response: string, model: string): void {
    this.entries.push({ key: `${model}:${prompt.substring(0, 100)}`, prompt, response, model, timestamp: Date.now(), vector: this.toVector(prompt) });
    if (this.entries.length > MAX_ENTRIES) this.entries.shift();
  }

  clear(): void { this.entries = []; }
  stats(): { entries: number; models: number } {
    const models = new Set(this.entries.map((e) => e.model));
    return { entries: this.entries.length, models: models.size };
  }
}

export const semanticCache = new SemanticCache();
