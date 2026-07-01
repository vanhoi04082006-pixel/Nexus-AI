"use client";

import { useState } from "react";
import { useNexus } from "@/store/useNexus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionEditor } from "../SectionEditor";
import { MermaidRenderer } from "../MermaidRenderer";
import { useReloadProject } from "../useReload";
import { toast } from "sonner";
import {
  Link2,
  Terminal,
  GitBranch,
  Ticket,
  Github,
  Upload,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Rocket,
} from "lucide-react";
import type { GitData } from "@/lib/types";

function esc(s: unknown): string {
  return String(s ?? "");
}

export function GitTab() {
  const result = useNexus((s) => s.result);
  const project = useNexus((s) => s.project);
  const projectId = useNexus((s) => s.projectId);
  const token = useNexus((s) => s.token);
  const access = useNexus((s) => s.access);
  const reload = useReloadProject();
  const r = (result?.git || {}) as Partial<GitData>;

  const [pushing, setPushing] = useState(false);
  const isLeader = access?.role === "leader";
  const githubConnected = project?.githubConnected;
  const githubUsername = project?.githubUsername;
  const githubRepoName = project?.githubRepoName;
  const githubPushedAt = project?.githubPushedAt;

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {});
  }

  function connectGitHub() {
    if (!projectId || !token) return;
    // Redirect to GitHub OAuth — the backend will redirect to github.com
    window.location.href = `/api/github/auth?projectId=${encodeURIComponent(projectId)}&token=${encodeURIComponent(token)}`;
  }

  async function pushToGitHub() {
    if (!projectId || !token) return;
    setPushing(true);
    try {
      const resp = await fetch(
        `/api/github/push?token=${encodeURIComponent(token)}&projectId=${encodeURIComponent(projectId)}`,
        { method: "POST" }
      );
      const data = (await resp.json()) as {
        success?: boolean;
        repoUrl?: string;
        fileCount?: number;
        error?: string;
      };
      if (!resp.ok || !data.success) {
        throw new Error(data.error || `HTTP ${resp.status}`);
      }
      toast.success(`Da push ${data.fileCount} files len GitHub!`);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Loi push GitHub");
    } finally {
      setPushing(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionEditor section="git" title="Git & Repo" content={r} onSaved={reload} />

      {/* ===== GitHub OAuth Integration ===== */}
      {isLeader && (
        <Card className="bg-card border-border border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Github className="w-4 h-4 text-primary" /> GitHub Integration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!githubConnected ? (
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  Ket noi tai khoan GitHub de NEXUS AI tu dong tao repo va push toan bo
                  project (README, docs, UML, todolist, code conventions...) len GitHub.
                  Khong can PAT — chi can bam &quot;Connect GitHub&quot;.
                </p>
                <Button
                  onClick={connectGitHub}
                  className="bg-foreground text-background hover:bg-foreground/90"
                >
                  <Github className="w-4 h-4" /> Connect GitHub
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-emerald-500/15 text-emerald-400 gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Da ket noi
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    GitHub: <strong className="text-foreground">@{esc(githubUsername)}</strong>
                  </span>
                  {githubRepoName && (
                    <a
                      href={`https://github.com/${esc(githubRepoName)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      {esc(githubRepoName)} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {githubPushedAt && (
                  <p className="text-xs text-muted-foreground">
                    Lan push cuoi: {new Date(githubPushedAt).toLocaleString("vi-VN")}
                  </p>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    onClick={pushToGitHub}
                    disabled={pushing}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {pushing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Rocket className="w-4 h-4" />
                    )}
                    {pushing ? "Dang push..." : githubPushedAt ? "Push lai len GitHub" : "Push len GitHub"}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={connectGitHub}>
                    <Github className="w-3.5 h-3.5" /> Doi tai khoan
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground bg-secondary/30 border border-border rounded-lg p-3">
                  <strong className="text-foreground">NEXUS AI se tao repo va push cac files:</strong>
                  {" "}README.md, .gitignore, PROJECT_SUMMARY.md, FOLDER_STRUCTURE.txt,
                  {" "}docs/ (CODING_CONVENTION, API_STANDARD, ARCHITECTURE, DATABASE, API_ENDPOINTS, SPRINT_PLAN, TEAM, TASKS),
                  {" "}docs/UML/ (use-case.mmd, class-diagram.mmd, erd.mmd, sequence.mmd),
                  {" "}.github/ISSUE_TEMPLATE/task.md
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Repo URL */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="w-4 h-4 text-primary" /> Repository URL (AI de xuat)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 items-center">
            <code className="flex-1 px-3.5 py-2.5 bg-secondary/40 border border-border rounded-lg text-sm text-primary font-mono break-all">
              {esc(r.repoUrl)}
            </code>
            <button
              onClick={() => copy(r.repoUrl || "")}
              className="text-xs border border-border px-3 py-2.5 rounded-lg hover:border-primary hover:text-primary transition-colors flex-shrink-0"
            >
              Copy
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Git commands */}
      {r.gitCommands && (
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold mb-3">
            <Terminal className="w-4 h-4 text-primary" /> Git Commands
          </h3>
          <div className="bg-[#060b14] border border-border rounded-xl overflow-hidden">
            <div className="flex justify-between items-center px-4 py-2 bg-[#0c1322] border-b border-border">
              <span className="text-xs text-muted-foreground font-mono">setup.sh</span>
              <button
                onClick={() => copy(r.gitCommands || "")}
                className="text-[11px] text-muted-foreground border border-border px-2 py-0.5 rounded hover:border-primary hover:text-primary transition-colors"
              >
                Copy
              </button>
            </div>
            <pre className="px-4 py-3 overflow-x-auto nexus-scroll font-mono text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap">
              {esc((r.gitCommands || "").replace(/\\n/g, "\n").replace(/\\\\n/g, "\n"))}
            </pre>
          </div>
        </div>
      )}

      {/* Branch strategy */}
      {r.branchStrategy && (
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold mb-3">
            <GitBranch className="w-4 h-4 text-primary" /> Branch Strategy
          </h3>
          <MermaidRenderer code={r.branchStrategy} id="branch" />
        </div>
      )}

      {/* Issue template */}
      {r.issueTemplate && (
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold mb-3">
            <Ticket className="w-4 h-4 text-primary" /> Issue Template
          </h3>
          <div className="bg-[#060b14] border border-border rounded-xl overflow-hidden">
            <div className="flex justify-between items-center px-4 py-2 bg-[#0c1322] border-b border-border">
              <span className="text-xs text-muted-foreground font-mono">task.md</span>
              <button
                onClick={() => copy(r.issueTemplate || "")}
                className="text-[11px] text-muted-foreground border border-border px-2 py-0.5 rounded hover:border-primary hover:text-primary transition-colors"
              >
                Copy
              </button>
            </div>
            <pre className="px-4 py-3 overflow-x-auto nexus-scroll font-mono text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap">
              {esc((r.issueTemplate || "").replace(/\\n/g, "\n").replace(/\\\\n/g, "\n"))}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
