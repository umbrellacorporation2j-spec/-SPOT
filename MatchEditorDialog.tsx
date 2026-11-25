import { useEffect, useState, type FormEvent } from "react";
import { ImageOff, Shield, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { MatchStatus, SpotMatch } from "@/lib/spot-types";
import { isValidHttpUrl, parseOptionalScore } from "@/lib/spot-utils";

interface MatchEditorDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  editingMatch: SpotMatch | null;
  onSaved: () => void;
}

function LogoUrlPreview({ url, label }: { url: string; label: string }) {
  const [failed, setFailed] = useState(false);
  const trimmed = url.trim();

  useEffect(() => {
    setFailed(false);
  }, [trimmed]);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-background/70 p-2.5">
      <div className="flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-xl border border-primary/30 bg-card">
        {trimmed && isValidHttpUrl(trimmed) && !failed ? (
          <img
            src={trimmed}
            alt={label}
            onError={() => setFailed(true)}
            className="h-11 w-11 object-contain"
          />
        ) : failed ? (
          <ImageOff className="h-5 w-5 text-destructive" />
        ) : (
          <Shield className="h-5 w-5 text-muted-foreground/60" />
        )}
      </div>
      <div className="min-w-0 flex-1 text-xs">
        <p className="font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-muted-foreground">
          {!trimmed
            ? "الصق رابط الأيقونة أو الصورة لتظهر معاينتها هنا"
            : !isValidHttpUrl(trimmed)
              ? "الرابط يجب أن يبدأ بـ https://"
              : failed
                ? "تعذّر تحميل المعاينة من هذا الرابط"
                : "المعاينة جاهزة للعرض"}
        </p>
      </div>
    </div>
  );
}

export function MatchEditorDialog({
  open,
  onClose,
  userId,
  editingMatch,
  onSaved,
}: MatchEditorDialogProps) {
  const [homeTeam, setHomeTeam] = useState("");
  const [homeLogoUrl, setHomeLogoUrl] = useState("");
  const [homeScore, setHomeScore] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [awayLogoUrl, setAwayLogoUrl] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [league, setLeague] = useState("");
  const [roundName, setRoundName] = useState("");
  const [venue, setVenue] = useState("");
  const [status, setStatus] = useState<MatchStatus>("scheduled");
  const [kickoffLocal, setKickoffLocal] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingMatch) {
      setHomeTeam(editingMatch.home_team);
      setHomeLogoUrl(editingMatch.home_logo_url);
      setHomeScore(editingMatch.home_score !== null ? String(editingMatch.home_score) : "");
      setAwayTeam(editingMatch.away_team);
      setAwayLogoUrl(editingMatch.away_logo_url);
      setAwayScore(editingMatch.away_score !== null ? String(editingMatch.away_score) : "");
      setLeague(editingMatch.league);
      setRoundName(editingMatch.round_name);
      setVenue(editingMatch.venue);
      setStatus(editingMatch.status);
      setNotes(editingMatch.notes);
      if (editingMatch.kickoff_at) {
        const d = new Date(editingMatch.kickoff_at);
        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
          .toISOString()
          .slice(0, 16);
        setKickoffLocal(local);
      } else {
        setKickoffLocal("");
      }
    } else {
      setHomeTeam("");
      setHomeLogoUrl("");
      setHomeScore("");
      setAwayTeam("");
      setAwayLogoUrl("");
      setAwayScore("");
      setLeague("");
      setRoundName("");
      setVenue("");
      setStatus("scheduled");
      setKickoffLocal("");
      setNotes("");
    }
  }, [open, editingMatch]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!homeTeam.trim() || !awayTeam.trim()) {
      toast.error("اكتب اسم الفريق الأول واسم الفريق الثاني");
      return;
    }
    if (homeLogoUrl.trim() && !isValidHttpUrl(homeLogoUrl)) {
      toast.error("رابط شعار الفريق الأول غير صالح");
      return;
    }
    if (awayLogoUrl.trim() && !isValidHttpUrl(awayLogoUrl)) {
      toast.error("رابط شعار الفريق الثاني غير صالح");
      return;
    }

    const parsedHome = parseOptionalScore(homeScore);
    const parsedAway = parseOptionalScore(awayScore);
    if (parsedHome.error || parsedAway.error) {
      toast.error(parsedHome.error || parsedAway.error || "النتيجة غير صالحة");
      return;
    }

    const kickoffIso = kickoffLocal.trim() ? new Date(kickoffLocal).toISOString() : null;

    const payload = {
      home_team: homeTeam.trim(),
      home_logo_url: homeLogoUrl.trim(),
      home_score: parsedHome.value,
      away_team: awayTeam.trim(),
      away_logo_url: awayLogoUrl.trim(),
      away_score: parsedAway.value,
      league: league.trim(),
      round_name: roundName.trim(),
      venue: venue.trim(),
      status,
      kickoff_at: kickoffIso,
      notes: notes.trim(),
      updated_at: new Date().toISOString(),
    };

    setSaving(true);
    try {
      if (editingMatch) {
        const { error } = await supabase
          .from("matches")
          .update(payload)
          .eq("id", editingMatch.id);
        if (error) {
          toast.error("تعذّر تحديث المباراة");
          return;
        }
        toast.success("تم تحديث المباراة والنتيجة");
      } else {
        const { error } = await supabase.from("matches").insert({
          ...payload,
          created_by: userId,
        });
        if (error) {
          toast.error("تعذّرت إضافة المباراة");
          return;
        }
        toast.success("تمت إضافة المباراة إلى جميع المباريات");
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="spot-dialog-surface max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">
            {editingMatch ? "تعديل المباراة والنتيجة" : "إضافة مباراة جديدة"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Home team */}
            <div className="space-y-2 rounded-xl border border-border/70 bg-background/40 p-3">
              <p className="text-xs font-bold text-primary">الفريق الأول</p>
              <input
                required
                value={homeTeam}
                onChange={(e) => setHomeTeam(e.target.value)}
                placeholder="اسم الفريق الأول"
                className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
              <input
                type="url"
                dir="ltr"
                value={homeLogoUrl}
                onChange={(e) => setHomeLogoUrl(e.target.value)}
                placeholder="رابط أيقونة / صورة الفريق الأول"
                className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
              />
              <LogoUrlPreview url={homeLogoUrl} label="معاينة شعار الفريق الأول" />
              <div>
                <label htmlFor="m-hscore" className="mb-1 block text-xs text-muted-foreground">
                  نتيجة الفريق الأول (اختياري)
                </label>
                <input
                  id="m-hscore"
                  type="number"
                  min={0}
                  max={99}
                  dir="ltr"
                  value={homeScore}
                  onChange={(e) => setHomeScore(e.target.value)}
                  placeholder="—"
                  className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-center text-base font-bold text-foreground outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Away team */}
            <div className="space-y-2 rounded-xl border border-border/70 bg-background/40 p-3">
              <p className="text-xs font-bold text-primary">الفريق الثاني</p>
              <input
                required
                value={awayTeam}
                onChange={(e) => setAwayTeam(e.target.value)}
                placeholder="اسم الفريق الثاني"
                className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
              <input
                type="url"
                dir="ltr"
                value={awayLogoUrl}
                onChange={(e) => setAwayLogoUrl(e.target.value)}
                placeholder="رابط أيقونة / صورة الفريق الثاني"
                className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
              />
              <LogoUrlPreview url={awayLogoUrl} label="معاينة شعار الفريق الثاني" />
              <div>
                <label htmlFor="m-ascore" className="mb-1 block text-xs text-muted-foreground">
                  نتيجة الفريق الثاني (اختياري)
                </label>
                <input
                  id="m-ascore"
                  type="number"
                  min={0}
                  max={99}
                  dir="ltr"
                  value={awayScore}
                  onChange={(e) => setAwayScore(e.target.value)}
                  placeholder="—"
                  className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-center text-base font-bold text-foreground outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="m-status" className="mb-1 block text-xs text-muted-foreground">
                حالة المباراة
              </label>
              <select
                id="m-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as MatchStatus)}
                className="w-full rounded-xl border border-border bg-background/80 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="scheduled">قادمة</option>
                <option value="live">مباشر الآن</option>
                <option value="finished">انتهت</option>
              </select>
            </div>
            <div>
              <label htmlFor="m-kickoff" className="mb-1 block text-xs text-muted-foreground">
                موعد المباراة
              </label>
              <input
                id="m-kickoff"
                type="datetime-local"
                dir="ltr"
                value={kickoffLocal}
                onChange={(e) => setKickoffLocal(e.target.value)}
                className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
            <div>
              <label htmlFor="m-league" className="mb-1 block text-xs text-muted-foreground">
                البطولة
              </label>
              <input
                id="m-league"
                value={league}
                onChange={(e) => setLeague(e.target.value)}
                placeholder="اسم البطولة"
                className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
            <div>
              <label htmlFor="m-venue" className="mb-1 block text-xs text-muted-foreground">
                الملعب أو الجولة
              </label>
              <input
                id="m-venue"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="الملعب (اختياري)"
                className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="m-round" className="mb-1 block text-xs text-muted-foreground">
                الجولة (اختياري)
              </label>
              <input
                id="m-round"
                value={roundName}
                onChange={(e) => setRoundName(e.target.value)}
                placeholder="رقم أو اسم الجولة"
                className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
            <div>
              <label htmlFor="m-notes" className="mb-1 block text-xs text-muted-foreground">
                ملاحظات إضافية (اختياري)
              </label>
              <input
                id="m-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="القناة الناقلة أو ملاحظة"
                className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button type="submit" disabled={saving} className="spot-btn flex-1">
              {saving ? "جارٍ الحفظ..." : editingMatch ? "حفظ التعديلات" : "إضافة المباراة"}
            </button>
            <button type="button" onClick={onClose} className="spot-btn spot-btn-ghost">
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}