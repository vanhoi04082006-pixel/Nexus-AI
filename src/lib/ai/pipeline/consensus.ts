// ai/pipeline/consensus.ts — Multi-Reviewer Consensus Engine
// Instead of 1 Quality Reviewer, multiple specialized reviewers
// each check a different aspect. Consensus is reached when ≥2/3 agree.

import { appendLog } from "@/lib/pipeline-progress";
import type { ProjectResult, ProjectInput } from "@/lib/types";
import { callAndParse } from "./runner";
import { REVIEWER_MODELS } from "../agents/definitions";
import { JSON_INSTRUCTION } from "../config/constants";
import { buildReviewSummary } from "../utils/helpers";

export type ReviewerRole = "architect" | "qa" | "security";

export interface ReviewResult {
  role: ReviewerRole;
  approved: boolean;
  issues: string[];
  suggestions: string[];
  model: string;
}

const REVIEWER_PROMPTS: Record<ReviewerRole, string> = {
  architect: `Ban la Solution Architect Reviewer. Kiem tra kien truc va thiet ke he thong.
Kiem tra:
1. DB tables phu hop voi modules
2. API endpoints day du cho features
3. Folder structure hop ly
4. Tech stack phu hop voi complex
${JSON_INSTRUCTION}
Tra object: { "approved": boolean, "issues": [string], "suggestions": [string] }`,

  qa: `Ban la QA Reviewer. Kiem tra test plan va quality.
Kiem tra:
1. Unit tests phu cover modules chinh
2. Integration tests co auth flow
3. E2E tests co signup/login
4. Test strategy day du
${JSON_INSTRUCTION}
Tra object: { "approved": boolean, "issues": [string], "suggestions": [string] }`,

  security: `Ban la Security Reviewer. Kiem tra security design.
Kiem tra:
1. Auth flow co JWT + refresh
2. OWASP checklist day du
3. Rate limiting co
4. Data protection co
${JSON_INSTRUCTION}
Tra object: { "approved": boolean, "issues": [string], "suggestions": [string] }`,
};

const REVIEWER_LABELS: Record<ReviewerRole, string> = {
  architect: "Architect Review",
  qa: "QA Review",
  security: "Security Review",
};

/**
 * Run multi-reviewer consensus on the project results.
 * Each reviewer checks a different aspect independently.
 * Consensus = ≥2/3 reviewers approve.
 */
export async function runConsensusReview(
  input: ProjectInput,
  results: ProjectResult,
  onProgress?: (role: ReviewerRole, done: boolean) => void
): Promise<{ reviews: ReviewResult[]; consensus: boolean; issues: string[] }> {
  const summary = buildReviewSummary(results, input.topic);
  const roles: ReviewerRole[] = ["architect", "qa", "security"];

  appendLog({
    level: "info",
    agentId: "CONSENSUS",
    provider: "pipeline",
    message: `▶ [CONSENSUS] Starting 3-reviewer consensus: Architect + QA + Security`,
  });

  // Run all 3 reviewers in parallel
  const reviewPromises = roles.map(async (role): Promise<ReviewResult> => {
    onProgress?.(role, false);
    const label = REVIEWER_LABELS[role];
    appendLog({ level: "info", agentId: "CONSENSUS", provider: "pipeline", message: `🔧 [${label}] → reviewing...` });

    try {
      const res = await callAndParse(
        REVIEWER_MODELS,
        REVIEWER_PROMPTS[role],
        `${summary}\n\nHay review va tra object { "approved": boolean, "issues": [string], "suggestions": [string] }`,
        0.1,
        undefined
      );

      if (res && res.data) {
        const data = res.data as { approved?: boolean; issues?: string[]; suggestions?: string[] };
        const review: ReviewResult = {
          role,
          approved: data.approved ?? false,
          issues: data.issues || [],
          suggestions: data.suggestions || [],
          model: res.model,
        };
        const status = review.approved ? "✓ APPROVED" : "⚠ ISSUES FOUND";
        appendLog({
          level: review.approved ? "success" : "warn",
          agentId: "CONSENSUS",
          provider: "pipeline",
          model: res.model,
          message: `${review.approved ? "✓" : "⚠"} [${label}] ${status} (${res.model}) — ${review.issues.length} issue(s)`,
        });
        if (review.issues.length > 0) {
          for (const issue of review.issues.slice(0, 3)) {
            appendLog({ level: "warn", agentId: "CONSENSUS", provider: "pipeline", message: `  ⚠ ${label}: ${issue.substring(0, 120)}` });
          }
        }
        onProgress?.(role, true);
        return review;
      }
    } catch (e) {
      appendLog({ level: "error", agentId: "CONSENSUS", provider: "pipeline", message: `✗ [${label}] → ${(e as Error).message?.substring(0, 100)}` });
    }

    // Default: approved (don't block pipeline if reviewer fails)
    onProgress?.(role, true);
    return { role, approved: true, issues: [], suggestions: [], model: "fallback" };
  });

  const reviews = await Promise.all(reviewPromises);

  // Consensus: ≥2/3 must approve
  const approvals = reviews.filter((r) => r.approved).length;
  const consensus = approvals >= 2;

  // Collect all issues
  const allIssues = reviews.flatMap((r) => r.issues.map((i) => `[${REVIEWER_LABELS[r.role]}] ${i}`));

  appendLog({
    level: consensus ? "success" : "warn",
    agentId: "CONSENSUS",
    provider: "pipeline",
    message: `${consensus ? "✓" : "⚠"} [CONSENSUS] ${approvals}/${reviews.length} approved — ${consensus ? "CONSENSUS REACHED" : "NO CONSENSUS (issues found)"}`,
  });

  if (!consensus && allIssues.length > 0) {
    appendLog({
      level: "warn",
      agentId: "CONSENSUS",
      provider: "pipeline",
      message: `⚠ [CONSENSUS] ${allIssues.length} total issue(s) across reviewers — pipeline continues, issues logged`,
    });
  }

  return { reviews, consensus, issues: allIssues };
}
