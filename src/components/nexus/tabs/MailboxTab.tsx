"use client";

import { useEffect, useState } from "react";
import { useNexus } from "@/store/useNexus";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Inbox, Clock, Send, Bell, Loader2 } from "lucide-react";
import { useReloadEmails } from "../useReload";
import type { EmailView } from "@/store/useNexus";

const TYPE_META: Record<string, { label: string; icon: typeof Mail; color: string }> = {
  INVITATION: { label: "Loi moi", icon: Send, color: "text-primary" },
  REMINDER: { label: "Nhac nho", icon: Bell, color: "text-amber-400" },
  TASK_ASSIGNED: { label: "Task moi", icon: Clock, color: "text-sky-400" },
};

export function MailboxTab() {
  const emails = useNexus((s) => s.emails);
  const access = useNexus((s) => s.access);
  const reloadEmails = useReloadEmails();
  const [selected, setSelected] = useState<EmailView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      await reloadEmails();
      setLoading(false);
    })();
  }, [reloadEmails]);

  const isLeader = access?.role === "leader";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="flex items-center gap-2 text-base font-bold">
          <Inbox className="w-4 h-4 text-primary" /> Mailbox
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {isLeader
            ? "Tat ca email da gui cho thanh vien (loi moi, nhac nho, task). Day la email mo phong trong sandbox."
            : `Hop thu cua ban (${access?.email}).`}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : emails.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-secondary/30 flex items-center justify-center mx-auto mb-3">
              <Mail className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Chua co email nao duoc gui.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {/* Email list */}
          <div className="space-y-2">
            {emails.map((e) => {
              const meta = TYPE_META[e.type] || TYPE_META.INVITATION;
              const Icon = meta.icon;
              const isSelected = selected?.id === e.id;
              return (
                <button
                  key={e.id}
                  onClick={() => setSelected(e)}
                  className={`w-full text-left ${
                    isSelected ? "ring-1 ring-primary" : ""
                  }`}
                >
                  <Card className="bg-card border-border hover:border-primary/40 transition-colors">
                    <CardContent className="p-3.5">
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Icon className={`w-4 h-4 ${meta.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Badge
                              variant="outline"
                              className={`text-[9px] ${meta.color} border-current/30`}
                            >
                              {meta.label}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground/60 ml-auto">
                              {new Date(e.sentAt).toLocaleString("vi-VN", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className="text-sm font-medium truncate">{e.subject}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            To: {e.toName || e.toEmail}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              );
            })}
          </div>

          {/* Email detail */}
          <div className="md:sticky md:top-4 h-fit">
            {selected ? (
              <Card className="bg-card border-border">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h4 className="font-semibold text-sm">{selected.subject}</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(selected.body)}
                      className="text-xs h-7"
                    >
                      Copy
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5 mb-4 pb-4 border-b border-border">
                    <div>
                      <strong>To:</strong> {selected.toName} &lt;{selected.toEmail}&gt;
                    </div>
                    <div>
                      <strong>Sent:</strong>{" "}
                      {new Date(selected.sentAt).toLocaleString("vi-VN")}
                    </div>
                    <div>
                      <strong>Type:</strong> {selected.type}
                    </div>
                  </div>
                  <pre className="text-xs text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed">
                    {selected.body}
                  </pre>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-card border-border">
                <CardContent className="p-12 text-center">
                  <Mail className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Chon email de xem noi dung</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
