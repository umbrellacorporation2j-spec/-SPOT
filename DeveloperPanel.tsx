import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Clock,
  Globe,
  MessageSquareWarning,
  Pencil,
  Play,
  Plus,
  Trash2,
  Trophy,
  Tv,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { purgeExpiredStreams } from "@/lib/admin-auth.functions";
import type { SpotBugReport, SpotMatch, SpotStream } from "@/lib/spot-types";
import { formatMatchDate, formatTimeRemaining, isStreamActive } from "@/lib/spot-utils";

interface DeveloperPanelProps {
  allStreams: SpotStream[];
  matches: SpotMatch[];
  bugReports: SpotBugReport[];
  nowMs: number;
  onPlayStream: (stream: SpotStream) => void;
  onAddGlobalStream: () => void;
  onEditStream: (stream: SpotStream) => void;
  onDeleteStream: (stream: SpotStream) => void;
  onAddMatch: () => void;
  onEditMatch: (match: SpotMatch) => void;
  onDeleteMatch: (match: SpotMatch) => void;
  onRefresh: () => void;
}

export function DeveloperPanel({
  allStreams,
  matches,
  bugReports,
  nowMs,
  onPlayStream,
  onAddGlobalStream,
  onEditStream,
  onDeleteStream,
  onAddMatch,
  onEditMatch,
  onDeleteMatch,
  onRefresh,
}: DeveloperPanelProps) {
  const [tab, setTab] = useState<"streams" | "matches" | "reports">("streams");
  const [purging, setPurging] = useState(false);
  const runPurge = useServerFn(purgeExpiredStreams);

  const expiredCount = nowMs
    ? allStreams.filter((s) => !isStreamActive(s.expires_at, nowMs)).length
    : 0;
  const newReportsCount = bugReports.filter((r) => r.status === "new").length;

  const handlePurgeExpired = async () => {
    setPurging(true);
    try {
      const res = await runPurge();
      toast.success(`تم حذف ${res.deletedCount} بث منتهي الصلاحية`);
      onRefresh();
    } catch {
      toast.error("تعذّر تنظيف البثوث المنتهية");
    } finally {
      setPurging(false);
    }
  };

  const handleResolveReport = async (report: SpotBugReport) => {
    const nextStatus = report.status === "resolved" ? "new" : "resolved";
    const { error } = await supabase
      .from("bug_reports")
      .update({ status: nextStatus })
      .eq("id", report.id);
    if (error) {
      toast.error("تعذّر تحديث حالة البلاغ");
      return;
    }
    onRefresh();
  };

  const handleDeleteReport = async (report: SpotBugReport) => {
    const { error } = await supabase.from("bug_reports").delete().eq("id", report.id);
    if (error) {
      toast.error("تعذّر حذف البلاغ");
      return;
    }
    toast.success("تم حذف البلاغ");
    onRefresh();
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="spot-section-heading my-0 flex-1">مساحة مطوّر التطبيقات</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onAddGlobalStream} className="spot-btn">
            <Globe className="h-4 w-4" />
            بث عام للجميع
          </button>
          <button type="button" onClick={onAddMatch} className="spot-btn spot-btn-ghost">
            <Plus className="h-4 w-4" />
            إضافة مباراة
          </button>
        </div>
      </div>

      {/* Compact live counters */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="spot-card p-3 ps-6">
          <p className="text-[11px] text-muted-foreground">جميع البثوث</p>
          <p className="mt-1 text-xl font-bold text-foreground">{allStreams.length}</p>
        </div>
        <div className="spot-card p-3 ps-6">
          <p className="text-[11px] text-muted-foreground">جميع المباريات</p>
          <p className="mt-1 text-xl font-bold text-foreground">{matches.length}</p>
        </div>
        <div className="spot-card p-3 ps-6">
          <p className="text-[11px] text-muted-foreground">بلاغات جديدة</p>
          <p className="mt-1 text-xl font-bold text-primary">{newReportsCount}</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setTab("streams")}
          className={`spot-chip flex items-center gap-1.5 ${tab === "streams" ? "spot-chip-active" : ""}`}
        >
          <Tv className="h-3.5 w-3.5" />
          جميع البثوث ({allStreams.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("matches")}
          className={`spot-chip flex items-center gap-1.5 ${tab === "matches" ? "spot-chip-active" : ""}`}
        >
          <Trophy className="h-3.5 w-3.5" />
          المباريات والنتائج ({matches.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("reports")}
          className={`spot-chip flex items-center gap-1.5 ${tab === "reports" ? "spot-chip-active" : ""}`}
        >
          <MessageSquareWarning className="h-3.5 w-3.5" />
          رسائل الأخطاء ({bugReports.length})
        </button>
      </div>

      {tab === "streams" ? (
        <div className="space-y-3">
          {expiredCount > 0 ? (
            <div className="flex items-center justify-between rounded-xl border border-gold/40 bg-gold/10 px-3.5 py-2.5 text-xs">
              <span>يوجد {expiredCount} بث منتهي التوقيت (مخفي عن المستخدمين)</span>
              <button
                type="button"
                disabled={purging}
                onClick={handlePurgeExpired}
                className="spot-btn py-1.5 text-xs"
              >
                {purging ? "جارٍ الحذف..." : "حذف المنتهية"}
              </button>
            </div>
          ) : null}

          {allStreams.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-7 text-center text-sm text-muted-foreground">
              لا توجد بثوث حالياً
            </div>
          ) : (
            <div className="grid gap-2.5 md:grid-cols-2">
              {allStreams.map((s) => {
                const remaining = nowMs ? formatTimeRemaining(s.expires_at, nowMs) : null;
                const expired = nowMs ? !isStreamActive(s.expires_at, nowMs) : false;
                return (
                  <div
                    key={s.id}
                    className={`spot-card flex items-center justify-between gap-3 p-3.5 ps-5 ${
                      expired ? "opacity-60" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-bold text-foreground">{s.title}</p>
                        {s.is_global ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                            <Globe className="h-2.5 w-2.5" />
                            للجميع
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{s.league || "بدون بطولة"}</span>
                        {s.ownerLabel ? (
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {s.ownerLabel}
                          </span>
                        ) : null}
                        {remaining ? (
                          <span className="inline-flex items-center gap-1 text-gold">
                            <Clock className="h-3 w-3" />
                            {remaining}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-none items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onPlayStream(s)}
                        aria-label="تشغيل"
                        className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditStream(s)}
                        aria-label="تعديل"
                        className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteStream(s)}
                        aria-label="حذف"
                        className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {tab === "matches" ? (
        <div className="space-y-2.5">
          {matches.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-7 text-center text-sm text-muted-foreground">
              <p>لم تقم بإضافة مباريات بعد</p>
              <button type="button" onClick={onAddMatch} className="spot-btn">
                <Plus className="h-4 w-4" />
                إضافة أول مباراة
              </button>
            </div>
          ) : (
            matches.map((m) => (
              <div
                key={m.id}
                className="spot-card flex flex-wrap items-center justify-between gap-3 p-3.5 ps-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">
                    {m.home_team}{" "}
                    <span className="mx-1.5 text-primary" dir="ltr">
                      {m.home_score !== null && m.away_score !== null
                        ? `${m.home_score} - ${m.away_score}`
                        : "VS"}
                    </span>{" "}
                    {m.away_team}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[m.league, formatMatchDate(m.kickoff_at)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onEditMatch(m)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-background/70 px-2.5 py-1.5 text-xs text-foreground hover:border-primary"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    تعديل
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteMatch(m)}
                    className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    حذف
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === "reports" ? (
        <div className="space-y-2.5">
          {bugReports.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-7 text-center text-sm text-muted-foreground">
              لا توجد رسائل أخطاء واردة
            </div>
          ) : (
            bugReports.map((r) => (
              <div key={r.id} className="spot-card space-y-2 p-4 ps-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    <strong className="text-foreground">{r.sender_name || "زائر"}</strong>
                    {r.sender_email ? <span className="ms-2" dir="ltr">{r.sender_email}</span> : null}
                    <span className="ms-2">· {formatMatchDate(r.created_at)}</span>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      r.status === "resolved"
                        ? "bg-live/20 text-live"
                        : "bg-primary/20 text-primary"
                    }`}
                  >
                    {r.status === "resolved" ? "تمت المعالجة" : "جديد"}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {r.message}
                </p>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleResolveReport(r)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-background/70 px-2.5 py-1 text-xs text-foreground hover:border-primary"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {r.status === "resolved" ? "إعادة كجديد" : "تمت المعالجة"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteReport(r)}
                    className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    حذف
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}