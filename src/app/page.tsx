"use client";

import { useEffect, useState, Suspense, lazy } from "react";
import { useSearchParams } from "next/navigation";
import { useNexus } from "@/store/useNexus";
import { toast } from "sonner";
import { InputView } from "@/components/nexus/InputView";
import { ProcessingOverlay } from "@/components/nexus/ProcessingOverlay";
import { WorkspaceView } from "@/components/nexus/WorkspaceView";
import { HomeView } from "@/components/nexus/HomeView";
import { AllProjectsView } from "@/components/nexus/AllProjectsView";
import { AgentHubView } from "@/components/nexus/AgentHubView";
import { BootSequence } from "@/components/landing/BootSequence";
import "./landing.css";

const LandingPage = lazy(() => import("@/components/landing/LandingPage").then(m => ({ default: m.LandingPage })));

type AppState = "boot" | "landing" | "app";

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

  const [appState, setAppState] = useState<AppState>("boot");

  // Boot sequence → landing
  useEffect(() => {
    if (appState === "boot") {
      const timer = setTimeout(() => {
        // If URL has project token, skip landing → go directly to app
        if (projectId && token) {
          setAppState("app");
        } else {
          setAppState("landing");
        }
      }, 4200); // Boot takes ~4.2s
      return () => clearTimeout(timer);
    }
  }, [appState, projectId, token]);

  useEffect(() => {
    if (projectId && token && appState === "app") {
      setRoute(projectId, token);
      setView("workspace");
    } else if (appState === "app") {
      setRoute(null, null);
      const currentView = useNexus.getState().view;
      if (currentView === "workspace") {
        setView("home");
      }
    }
  }, [projectId, token, setRoute, setView, appState]);

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

  // Warn on exit during AI work
  useEffect(() => {
    if (!pipelineRunning) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "AI dang lam viec. Ban co chac muon thoat?";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [pipelineRunning]);

  // ===== Boot Sequence =====
  if (appState === "boot") {
    return <BootSequence onComplete={() => {
      if (projectId && token) {
        setAppState("app");
      } else {
        setAppState("landing");
      }
    }} />;
  }

  // ===== Landing Page =====
  if (appState === "landing") {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading NEXUS AI...</div>}>
        <LandingPage onLaunch={() => setAppState("app")} />
      </Suspense>
    );
  }

  // ===== App (workspace/home/etc) =====
  return (
    <div className="min-h-screen flex flex-col nexus-grid-bg">
      {view === "home" && <HomeView />}
      {view === "input" && <InputView />}
      {view === "workspace" && <WorkspaceView />}
      {view === "all-projects" && <AllProjectsView />}
      {view === "agent-hub" && <AgentHubView />}
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
