"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useNexus } from "@/store/useNexus";
import { toast } from "sonner";
import { InputView } from "@/components/nexus/InputView";
import { ProcessingOverlay } from "@/components/nexus/ProcessingOverlay";
import { WorkspaceView } from "@/components/nexus/WorkspaceView";
import { HomeView } from "@/components/nexus/HomeView";
import { AllProjectsView } from "@/components/nexus/AllProjectsView";
import { AgentHubView } from "@/components/nexus/AgentHubView";
import { KnowledgeBaseView } from "@/components/nexus/KnowledgeBaseView";
import { WorkflowView } from "@/components/nexus/WorkflowView";
import { SettingsView } from "@/components/nexus/SettingsView";
import { IntegrationsView } from "@/components/nexus/IntegrationsView";

function NexusApp() {
  const params = useSearchParams();
  const projectId = params.get("p");
  const token = params.get("token");
  const githubConnected = params.get("github_connected");
  const githubError = params.get("github_error");

  const view = useNexus((s) => s.view);
  const setRoute = useNexus((s) => s.setRoute);
  const setView = useNexus((s) => s.setView);
  const pipelineRunning = useNexus((s) => s.pipelineRunning);

  useEffect(() => {
    if (projectId && token) {
      setRoute(projectId, token);
      setView("workspace");
    } else {
      setRoute(null, null);
      // If no project in URL, go to home (shows project history)
      // But don't override if user is currently filling the input form
      const currentView = useNexus.getState().view;
      if (currentView === "workspace") {
        setView("home");
      }
    }
  }, [projectId, token, setRoute, setView]);

  // Show toast when returning from GitHub OAuth
  useEffect(() => {
    if (githubConnected === "1") {
      toast.success("Da ket noi GitHub thanh cong! Ban co the push project len GitHub.");
      const url = new URL(window.location.href);
      url.searchParams.delete("github_connected");
      window.history.replaceState({}, "", url.toString());
    } else if (githubError) {
      const messages: Record<string, string> = {
        denied: "Ban da tu choi ket noi GitHub.",
        missing_params: "Thieu tham so khi ket noi GitHub.",
        invalid_state: "Trang thai OAuth khong hop le.",
        token_exchange: "Khong the lay access token tu GitHub.",
        user_fetch: "Khong the lay thong tin nguoi dung GitHub.",
        db_save: "Khong the luu token vao database.",
      };
      toast.error(messages[githubError] || `Loi ket noi GitHub: ${githubError}`);
      const url = new URL(window.location.href);
      url.searchParams.delete("github_error");
      window.history.replaceState({}, "", url.toString());
    }
  }, [githubConnected, githubError]);

  // REMOVED: beforeunload warning during AI work — user requested removal.
  // AI pipeline runs in background (process.nextTick) so it continues even if user navigates away.

  return (
    <div className="min-h-screen flex flex-col nexus-grid-bg">
      {view === "home" && <HomeView />}
      {view === "input" && <InputView />}
      {view === "workspace" && <WorkspaceView />}
      {view === "all-projects" && <AllProjectsView />}
      {view === "agent-hub" && <AgentHubView />}
      {view === "knowledge-base" && <KnowledgeBaseView />}
      {view === "workflow" && <WorkflowView />}
      {view === "settings" && <SettingsView />}
      {view === "integrations" && <IntegrationsView />}
      {pipelineRunning && <ProcessingOverlay />}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading NEXUS AI...</div>}>
      <NexusApp />
    </Suspense>
  );
}
