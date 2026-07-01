"use client";

import { useState } from "react";
import { useNexus } from "@/store/useNexus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useReloadProject } from "../useReload";
import {
  UserPlus,
  Mail,
  Copy,
  Check,
  Crown,
  User as UserIcon,
  Loader2,
  Link2,
  ClipboardCheck,
  ClipboardX,
  MessageSquarePlus,
} from "lucide-react";
import type { MemberView, EditProposalView } from "@/store/useNexus";

export function MembersTab() {
  const projectId = useNexus((s) => s.projectId);
  const token = useNexus((s) => s.token);
  const access = useNexus((s) => s.access);
  const members = useNexus((s) => s.members);
  const proposals = useNexus((s) => s.proposals);
  const reload = useReloadProject();
  const isLeader = access?.role === "leader";

  const [addOpen, setAddOpen] = useState(false);
  const [newMember, setNewMember] = useState({ name: "", email: "", strengths: "", weaknesses: "" });
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function addMember() {
    if (!newMember.name.trim() || !newMember.email.trim()) {
      toast.error("Vui long nhap ten va email");
      return;
    }
    setAdding(true);
    try {
      const resp = await fetch(`/api/projects/${projectId}/members?token=${encodeURIComponent(token || "")}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMember),
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${resp.status}`);
      }
      toast.success(`Da them ${newMember.name} va gui email loi moi`);
      setNewMember({ name: "", email: "", strengths: "", weaknesses: "" });
      setAddOpen(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Loi them thanh vien");
    } finally {
      setAdding(false);
    }
  }

  function copyInviteLink(m: MemberView) {
    if (!m.inviteToken) return;
    const link = `${window.location.origin}/?p=${projectId}&token=${m.inviteToken}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(m.id);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  async function handleProposal(p: EditProposalView, status: "APPROVED" | "REJECTED") {
    try {
      const resp = await fetch(`/api/projects/${projectId}/edit-proposals/${p.id}?token=${encodeURIComponent(token || "")}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!resp.ok) throw new Error("Loi cap nhat");
      toast.success(status === "APPROVED" ? "Da duyet de xuat" : "Da tu choi de xuat");
      await reload();
    } catch {
      toast.error("Loi cap nhat de xuat");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold">
            <UserPlus className="w-4 h-4 text-primary" /> Thanh vien ({members.length})
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {isLeader
              ? "Them thanh vien - email loi moi tu dong gui. Copy link de chia se truc tiep."
              : "Danh sach thanh vien trong du an."}
          </p>
        </div>
        {isLeader && (
          <Button onClick={() => setAddOpen(true)} className="bg-primary text-primary-foreground">
            <UserPlus className="w-4 h-4" /> Them thanh vien
          </Button>
        )}
      </div>

      {/* Member list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {members.map((m) => (
          <Card key={m.id} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <UserIcon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate">{m.name}</span>
                    {m.joinedAt ? (
                      <Badge className="bg-emerald-500/15 text-emerald-400 text-[9px] px-1.5">
                        <Check className="w-2.5 h-2.5 mr-0.5" /> Da tham gia
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-[9px] px-1.5">
                        Chua tham gia
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                    <Mail className="w-3 h-3 flex-shrink-0" /> {m.email}
                  </div>
                  {m.role && (
                    <div className="text-xs text-primary font-medium mt-1.5">{m.role}</div>
                  )}
                </div>
              </div>
              {isLeader && m.inviteToken && (
                <div className="mt-3 pt-3 border-t border-border">
                  <button
                    onClick={() => copyInviteLink(m)}
                    className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-primary border border-border hover:border-primary rounded-md py-1.5 transition-colors"
                  >
                    {copied === m.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" /> Da copy link
                      </>
                    ) : (
                      <>
                        <Link2 className="w-3.5 h-3.5" /> Copy link loi moi
                      </>
                    )}
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit proposals (leader only) */}
      {isLeader && proposals.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold mb-3">
            <MessageSquarePlus className="w-4 h-4 text-primary" /> De xuat chinh sua (
            {proposals.filter((p) => p.status === "PENDING").length} cho duyet)
          </h3>
          <div className="space-y-2">
            {proposals.map((p) => (
              <Card key={p.id} className="bg-card border-border">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px]">
                          {p.section}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {p.memberName || "Thanh vien"}
                        </span>
                        {p.status !== "PENDING" && (
                          <Badge
                            className={
                              p.status === "APPROVED"
                                ? "bg-emerald-500/15 text-emerald-400 text-[10px]"
                                : "bg-destructive/15 text-destructive text-[10px]"
                            }
                          >
                            {p.status === "APPROVED" ? (
                              <ClipboardCheck className="w-2.5 h-2.5 mr-0.5" />
                            ) : (
                              <ClipboardX className="w-2.5 h-2.5 mr-0.5" />
                            )}
                            {p.status}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-foreground/90">{p.requestedChange}</p>
                    </div>
                    {p.status === "PENDING" && (
                      <div className="flex gap-1.5 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleProposal(p, "APPROVED")}
                          className="h-7 text-xs bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                        >
                          Duyet
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleProposal(p, "REJECTED")}
                          className="h-7 text-xs"
                        >
                          Tu choi
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Sau khi duyet, nhan <strong className="text-primary">"AI Refine"</strong> trong tab Thao
            Luan de AI ap dung cac de xuat vao phan tuong ung.
          </p>
        </div>
      )}

      {/* Add member dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" /> Them thanh vien moi
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Ten *</label>
              <Input
                value={newMember.name}
                onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                className="bg-[#060b14] border-border"
                placeholder="Nguyen Van B"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email *</label>
              <Input
                type="email"
                value={newMember.email}
                onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                className="bg-[#060b14] border-border"
                placeholder="b@example.com"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Email loi moi se tu dong gui den dia chi nay.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Uu diem</label>
                <Input
                  value={newMember.strengths}
                  onChange={(e) => setNewMember({ ...newMember, strengths: e.target.value })}
                  className="bg-[#060b14] border-border text-xs"
                  placeholder="React, Node.js"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nhuoc diem</label>
                <Input
                  value={newMember.weaknesses}
                  onChange={(e) => setNewMember({ ...newMember, weaknesses: e.target.value })}
                  className="bg-[#060b14] border-border text-xs"
                  placeholder="Weak CSS"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)} disabled={adding}>
              Huy
            </Button>
            <Button onClick={addMember} disabled={adding} className="bg-primary text-primary-foreground">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Them & Gui loi moi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
