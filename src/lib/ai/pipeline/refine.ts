// ai/pipeline/refine.ts — AI Refine sections
// Extracted from ai.ts Phase 2

import { appendLog } from "@/lib/pipeline-progress";
import type { ProjectInput, ProjectResult, SectionType } from "@/lib/types";
import { buildCtx, isValidSchema } from "../utils/helpers";
import { callAndParse } from "./runner";
import { AGENTS } from "../agents/definitions";
import { PROMPT_MAP } from "../prompts";

export async function refineSections(
  input: ProjectInput,
  current: ProjectResult,
  editRequests: { section: SectionType; change: string }[],
  chatDiscussion: string,
  onProgress?: (section: SectionType, done: boolean) => void
): Promise<ProjectResult> {
  const refined: ProjectResult = { ...current };
  const base = buildCtx("analysis", current, input);
  const discussion = chatDiscussion ? `\n\nCUOC THAO LUAN CUA NHOM:\n${chatDiscussion}` : "";
  const edits = editRequests.length
    ? `\n\nYEU CAU CHINH SUA CUA NHOM TRUONG:\n${editRequests.map((e) => `- [${e.section}]: ${e.change}`).join("\n")}`
    : "";

  appendLog({ level: "info", agentId: "REFINE", provider: "pipeline", message: `▶ AI REFINE STARTED — ${AGENTS.length} sections to re-generate` });
  if (editRequests.length > 0) {
    for (const e of editRequests) {
      appendLog({ level: "info", agentId: "REFINE", provider: "pipeline", message: `📝 Leader edit request [${e.section}]: ${e.change.substring(0, 120)}` });
    }
  }

  const sectionLabels: Record<string, string> = {
    analysis: "Phân tích", hr: "Nhân sự", sprint: "Sprint",
    design: "Thiết kế", uml: "UML", docs: "Tài liệu", git: "Git",
  };

  for (const ag of AGENTS) {
    onProgress?.(ag.key, false);
    const label = sectionLabels[ag.key] || ag.key;
    appendLog({ level: "info", agentId: "REFINE", provider: "pipeline", message: `🔧 [REFINE] ${label} (${ag.key}) → đang đọc nội dung + yêu cầu chỉnh sửa...` });

    try {
      const sys = PROMPT_MAP[ag.key]() + `\n\nNhiem vu dac biet: Ban dang CHINH SUA lai phan "${ag.key}" dua tren yeu cau cua nhom truong va cuoc thao luan. Giu nguyen cau truc JSON, chi sua noi dung. Dam bao dong bo voi cac phan khac.`;
      const user = `${base}${edits}${discussion}\n\nNOI DUNG HIEN TAI cua phan ${ag.key}:\n${JSON.stringify(current[ag.key]).substring(0, 4000)}\n\nHay tra lai phan ${ag.key} da chinh sua (JSON day du).`;
      const res = await callAndParse(ag.models, sys, user, ag.temp, ag.key);
      if (res && isValidSchema(res.data, ag.key)) {
        (refined as unknown as Record<string, unknown>)[ag.key] = res.data;
        appendLog({ level: "success", agentId: "REFINE", provider: "pipeline", model: res.model, message: `✓ [REFINE] ${label} → đã chỉnh sửa xong (${res.model})` });
      } else if (res) {
        (refined as unknown as Record<string, unknown>)[ag.key] = res.data;
        appendLog({ level: "warn", agentId: "REFINE", provider: "pipeline", model: res.model, message: `⚠ [REFINE] ${label} → schema không hợp lệ, vẫn lưu` });
      } else {
        appendLog({ level: "warn", agentId: "REFINE", provider: "fallback", message: `▷ [REFINE] ${label} → giữ nguyên (tất cả model fail)` });
      }
    } catch (e) {
      appendLog({ level: "error", agentId: "REFINE", provider: "pipeline", message: `✗ [REFINE] ${label} → lỗi: ${(e as Error).message?.substring(0, 100)}` });
    }
    onProgress?.(ag.key, true);
  }

  appendLog({ level: "success", agentId: "REFINE", provider: "pipeline", message: `✅ AI REFINE COMPLETED — tất cả section đã được đồng bộ` });
  return refined;
}
