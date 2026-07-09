// ai/utils/jfix.ts — JSON repair utility (extracted from ai.ts)

export class JFix {
  static fix(raw: string): string {
    if (!raw || typeof raw !== "string") return "";
    let s = raw.trim();
    if (s.startsWith("```json")) s = s.substring(7);
    else if (s.startsWith("```")) s = s.substring(3);
    if (s.endsWith("```")) s = s.substring(0, s.length - 3);
    s = s.replace(/,\s*([\]}])/g, "$1");
    let r = "";
    let inS = false;
    let es = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (es) { r += c; es = false; continue; }
      if (c === "\\" && inS) { r += c; es = true; continue; }
      if (c === '"') { inS = !inS; r += c; continue; }
      if (inS && (c === "\n" || c === "\r")) { r += "\\n"; continue; }
      if (!inS && (c === "\n" || c === "\r" || c === "\t")) continue;
      if (!inS && c === "/" && s[i + 1] === "/") {
        while (i < s.length && s[i] !== "\n") i++;
        continue;
      }
      r += c;
    }
    return r;
  }

  static parse(raw: string): unknown {
    if (!raw || typeof raw !== "string") throw new Error("Empty");
    try { return JSON.parse(raw.trim()); } catch { /* continue */ }
    try { return JSON.parse(this.fix(raw)); } catch { /* continue */ }
    try {
      const a = raw.indexOf("{");
      const b = raw.lastIndexOf("}");
      if (a !== -1 && b > a) return JSON.parse(this.fix(raw.substring(a, b + 1)));
    } catch { /* continue */ }
    throw new Error("Parse fail");
  }
}
