"use client";

import { useCallback } from "react";
import { useNexus } from "@/store/useNexus";
import { toast } from "sonner";

/**
 * Refetches the full project workspace data from the API and updates the store.
 * Used after section edits, member additions, task updates, etc.
 */
export function useReloadProject() {
  const projectId = useNexus((s) => s.projectId);
  const token = useNexus((s) => s.token);
  const setAccess = useNexus((s) => s.setAccess);
  const setProject = useNexus((s) => s.setProject);
  const setResult = useNexus((s) => s.setResult);
  const setMembers = useNexus((s) => s.setMembers);
  const setMessages = useNexus((s) => s.setMessages);
  const setTasks = useNexus((s) => s.setTasks);
  const setEmails = useNexus((s) => s.setEmails);
  const setProposals = useNexus((s) => s.setProposals);

  return useCallback(async () => {
    if (!projectId || !token) return;
    try {
      const resp = await fetch(`/api/projects/${projectId}?token=${encodeURIComponent(token)}`);
      if (!resp.ok) return;
      const data = await resp.json();
      setAccess(data.access);
      setProject(data.project);
      setResult(data.result);
      setMembers(data.members || []);
      setMessages(data.messages || []);
      setTasks(data.tasks || []);
      setProposals(data.proposals || []);
    } catch {
      /* silent */
    }
  }, [projectId, token, setAccess, setProject, setResult, setMembers, setMessages, setTasks, setEmails, setProposals]);
}

/** Reload only emails (for the mailbox tab). */
export function useReloadEmails() {
  const projectId = useNexus((s) => s.projectId);
  const token = useNexus((s) => s.token);
  const setEmails = useNexus((s) => s.setEmails);
  return useCallback(async () => {
    if (!projectId || !token) return;
    try {
      const resp = await fetch(`/api/projects/${projectId}/mailbox?token=${encodeURIComponent(token)}`);
      if (!resp.ok) return;
      const data = await resp.json();
      setEmails(data.emails || []);
    } catch {
      /* silent */
    }
  }, [projectId, token, setEmails]);
}
