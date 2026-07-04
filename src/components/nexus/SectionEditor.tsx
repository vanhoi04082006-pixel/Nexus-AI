"use client";

import { useState } from "react";
import { useNexus } from "@/store/useNexus";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Send, RefreshCw, Loader2, Crown, MessageSquarePlus } from "lucide-react";
import type { SectionType } from "@/lib/types";

interface SectionEditorProps {
  section: SectionType;
  title: string;
  /** Current content object */
  content: unknown;
  /** Called after a successful save to refresh the store */
  onSaved?: () => void;
}

/**
 * Leader: can open a JSON editor and save changes directly (PUT /section).
 * Member: can propose a change as text (POST /edit-proposals).
 */
export function SectionEditor({ section, title, content, onSaved }: SectionEditorProps) {
  const projectId = useNexus((s) => s.projectId);
  const token = useNexus((s) => s.token);
  const access = useNexus((s) => s.access);
  const isLeader = access?.role === "leader";

  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const [proposeOpen, setProposeOpen] = useState(false);
  const [proposalText, setProposalText] = useState("");
  const [proposing, setProposing] = useState(false);

  function openEdit() {
    setDraft(JSON.stringify(content, null, 2));
    setEditOpen(true);
  }

  async function saveEdit() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch (e) {
      toast.error("JSON khong hop le: " + (e instanceof Error ? e.message : ""));
      return;
    }
    setSaving(true);
    try {
      const resp = await fetch(`/api/projects/${projectId}/section?token=${encodeURIComponent(token || "")}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, content: parsed }),
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${resp.status}`);
      }
      toast.success(`Da luu chinh sua "${title}"`);
      setEditOpen(false);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Loi luu");
    } finally {
      setSaving(false);
    }
  }

  async function submitProposal() {
    if (!proposalText.trim()) {
      toast.error("Vui long nhap mo ta thay doi muon de xuat");
      return;
    }
    setProposing(true);
    try {
      const resp = await fetch(`/api/projects/${projectId}/edit-proposals?token=${encodeURIComponent(token || "")}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, requestedChange: proposalText.trim() }),
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${resp.status}`);
      }
      // Auto-post to chat so everyone sees the proposal
      try {
        await fetch(`/api/projects/${projectId}/chat?token=${encodeURIComponent(token || "")}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `[De xuat chinh sua - ${title}]: ${proposalText.trim()}`,
          }),
        });
      } catch {
        /* non-fatal — proposal still saved */
      }
      toast.success("Da gui de xuat vao phong thao luan. Nhom truong se xem xet.");
      setProposalText("");
      setProposeOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Loi gui de xuat");
    } finally {
      setProposing(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        {isLeader ? (
          <Button variant="secondary" size="sm" onClick={openEdit}>
            <Pencil className="w-3.5 h-3.5" /> Chinh sua
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setProposeOpen(true)}>
            <MessageSquarePlus className="w-3.5 h-3.5" /> De xuat chinh sua
          </Button>
        )}
      </div>

      {/* Leader JSON editor */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] bg-card border-border overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" />
              Chinh sua: {title}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto nexus-scroll">
            <p className="text-xs text-muted-foreground mb-3">
              Sua noi dung JSON. Sau khi luu, ban co the nhan{" "}
              <span className="text-primary font-medium">"AI Refine"</span> trong tab Thao Luan de AI
              dong bo lai tat ca cac phan.
            </p>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="font-mono text-xs bg-nexus-surface-2 border-border min-h-[400px] resize-y"
              spellCheck={false}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={saving}>
              Huy
            </Button>
            <Button onClick={saveEdit} disabled={saving} className="bg-primary text-primary-foreground">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Luu chinh sua
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member proposal dialog */}
      <Dialog open={proposeOpen} onOpenChange={setProposeOpen}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquarePlus className="w-4 h-4 text-primary" />
              De xuat chinh sua: {title}
            </DialogTitle>
          </DialogHeader>
          <div>
            <p className="text-xs text-muted-foreground mb-3">
              Mo ta thay doi ban muon de xuat. Nhom truong se xem xet va AI se tong hop vao phan hien tai.
            </p>
            <Textarea
              value={proposalText}
              onChange={(e) => setProposalText(e.target.value)}
              rows={5}
              placeholder="VD: Them chuc nang xuat bao cao PDF, doi database sang PostgreSQL..."
              className="bg-nexus-surface-2 border-border"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setProposeOpen(false)} disabled={proposing}>
              Huy
            </Button>
            <Button onClick={submitProposal} disabled={proposing} className="bg-primary text-primary-foreground">
              {proposing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Gui de xuat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Re-export for convenience */
export { Crown };
