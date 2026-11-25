import { useEffect, useState, type FormEvent } from "react";
import { Clock, Globe, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ExpiryPreset, SpotStream } from "@/lib/spot-types";
import {
  computeExpiresAt,
  isValidHttpUrl,
  isVideoUrl,
  parseBulkStreams,
  ytId,
} from "@/lib/spot-utils";

interface StreamModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  isAdmin: boolean;
  editingStream: SpotStream | null;
  defaultGlobal?: boolean;
  onSaved: () => void;
}

const PRESETS: Array<{ value: ExpiryPreset; label: string }> = [
  { value: "none", label: "دائم" },
  { value: "30m", label: "30 دقيقة" },
  { value: "1h", label: "ساعة" },
  { value: "2h", label: "ساعتان" },
  { value: "3h", label: "3 ساعات" },
  { value: "6h", label: "6 ساعات" },
  { value: "24h", label: "24 ساعة" },
  { value: "custom", label: "وقت محدد" },
];

export function StreamModal({
  open,
  onClose,
  userId,
  isAdmin,
  editingStream,
  defaultGlobal = false,
  onSaved,
}: StreamModalProps) {
  const [tab, setTab] = useState<"one" | "bulk">("one");
  const [title, setTitle] = useState("");
  const [league, setLeague] = useState("");
  const [url, setUrl] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [m3uUrl, setM3uUrl] = useState("");
  const [isGlobal, setIsGlobal] = useState(false);
  const [preset, setPreset] = useState<ExpiryPreset>("none");
  const [customDateTime, setCustomDateTime] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingStream) {
      setTab("one");
      setTitle(editingStream.title);
      setLeague(editingStream.league);
      setUrl(editingStream.url);
      setIsGlobal(editingStream.is_global);
      if (editingStream.expires_at) {
        setPreset("custom");
        const d = new Date(editingStream.expires_at);
        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
          .toISOString()
          .slice(0, 16);
        setCustomDateTime(local);
      } else {
        setPreset("none");
        setCustomDateTime("");
      }
    } else {
      setTab("one");
      setTitle("");
      setLeague("");
      setUrl("");
      setBulkText("");
      setM3uUrl("");
      setIsGlobal(isAdmin && defaultGlobal);
      setPreset("none");
      setCustomDateTime("");
    }
  }, [open, editingStream, isAdmin, defaultGlobal]);

  if (!open) return null;

  const yt = ytId(url);
  const previewThumb = yt ? `https://img.youtube.com/vi/${yt}/mqdefault.jpg` : "";

  const handleFetchM3U = async () => {
    if (!isValidHttpUrl(m3uUrl)) {
      toast.error("أدخل رابط قائمة صالح");
      return;
    }
    try {
      const res = await fetch(m3uUrl.trim());
      if (!res.ok) throw new Error("fetch failed");
      setBulkText(await res.text());
      toast.success("تم جلب القائمة، اضغط حفظ");
    } catch {
      toast.error("تعذّر جلب القائمة (قد يمنع الخادم CORS). ارفع الملف بدلاً من ذلك");
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const expiresAt = isAdmin ? computeExpiresAt(preset, customDateTime) : null;
    if (isAdmin && preset === "custom" && !expiresAt) {
      toast.error("اختر تاريخاً ووقتاً مستقبلياً للحذف التلقائي");
      return;
    }

    setSaving(true);
    try {
      if (editingStream) {
        if (!title.trim() || !isValidHttpUrl(url)) {
          toast.error("أدخل اسم البث ورابطاً صحيحاً يبدأ بـ https://");
          return;
        }
        const payload = {
          title: title.trim(),
          league: league.trim(),
          url: url.trim(),
          thumb: previewThumb || editingStream.thumb,
          is_global: isAdmin ? isGlobal : false,
          expires_at: isAdmin ? expiresAt : null,
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase
          .from("streams")
          .update(payload)
          .eq("id", editingStream.id);
        if (error) {
          toast.error("تعذّر تحديث البث");
          return;
        }
        toast.success("تم تحديث البث");
        onSaved();
        onClose();
        return;
      }

      if (tab === "one") {
        if (!title.trim() || !isValidHttpUrl(url)) {
          toast.error("أدخل اسم البث ورابطاً صحيحاً يبدأ بـ https://");
          return;
        }
        const { error } = await supabase.from("streams").insert({
          owner_id: userId,
          title: title.trim(),
          league: league.trim(),
          url: url.trim(),
          thumb: previewThumb,
          is_global: isAdmin ? isGlobal : false,
          expires_at: isAdmin ? expiresAt : null,
        });
        if (error) {
          toast.error("تعذّرت إضافة البث");
          return;
        }
        toast.success(isAdmin && isGlobal ? "تم نشر البث لجميع المستخدمين" : "تمت إضافة البث");
      } else {
        const parsed = parseBulkStreams(bulkText);
        if (!parsed.length) {
          toast.error("لم يتم العثور على روابط صالحة");
          return;
        }
        const rows = parsed.map((item) => ({
          owner_id: userId,
          title: item.title,
          league: item.league,
          url: item.url,
          thumb: item.thumb,
          is_global: isAdmin ? isGlobal : false,
          expires_at: isAdmin ? expiresAt : null,
        }));
        const { error } = await supabase.from("streams").insert(rows);
        if (error) {
          toast.error("تعذّرت إضافة البثوث");
          return;
        }
        toast.success(`تمت إضافة ${rows.length} بث`);
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="spot-dialog-surface max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">
            {editingStream ? "تعديل البث" : "إضافة بث"}
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

        {!editingStream ? (
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setTab("one")}
              className={`spot-chip ${tab === "one" ? "spot-chip-active" : ""}`}
            >
              رابط واحد
            </button>
            <button
              type="button"
              onClick={() => setTab("bulk")}
              className={`spot-chip ${tab === "bulk" ? "spot-chip-active" : ""}`}
            >
              إضافة جماعية
            </button>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-3">
          {tab === "one" ? (
            <>
              <div>
                <label htmlFor="s-title" className="mb-1 block text-xs text-muted-foreground">
                  اسم البث / المباراة
                </label>
                <input
                  id="s-title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="اكتب اسم البث"
                  className="w-full rounded-xl border border-border bg-background/80 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <div>
                <label htmlFor="s-league" className="mb-1 block text-xs text-muted-foreground">
                  البطولة
                </label>
                <input
                  id="s-league"
                  value={league}
                  onChange={(e) => setLeague(e.target.value)}
                  placeholder="اسم البطولة (اختياري)"
                  className="w-full rounded-xl border border-border bg-background/80 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <div>
                <label htmlFor="s-url" className="mb-1 block text-xs text-muted-foreground">
                  رابط البث
                </label>
                <input
                  id="s-url"
                  type="url"
                  required
                  dir="ltr"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://.../stream.m3u8 أو رابط يوتيوب"
                  className="w-full rounded-xl border border-border bg-background/80 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>

              {/* Live preview viewer */}
              <div className="mx-auto aspect-video w-full max-w-xs overflow-hidden rounded-xl border border-primary/40 bg-background">
                {previewThumb ? (
                  <img src={previewThumb} alt="معاينة البث" className="h-full w-full object-cover" />
                ) : isValidHttpUrl(url) ? (
                  isVideoUrl(url) ? (
                    <div className="flex h-full items-center justify-center p-3 text-center text-xs text-muted-foreground">
                      رابط فيديو مباشر جاهز للتشغيل
                    </div>
                  ) : (
                    <iframe
                      src={url.trim()}
                      title="معاينة"
                      loading="lazy"
                      referrerPolicy="strict-origin-when-cross-origin"
                      className="h-full w-full border-0"
                    />
                  )
                ) : (
                  <div className="flex h-full items-center justify-center p-3 text-center text-xs text-muted-foreground">
                    أدخل رابط البث لتظهر المعاينة
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="s-bulk" className="mb-1 block text-xs text-muted-foreground">
                  الصق الروابط (سطر لكل بث: الاسم | الرابط | البطولة)
                </label>
                <textarea
                  id="s-bulk"
                  rows={5}
                  dir="ltr"
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder="https://.../stream.m3u8"
                  className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <div>
                <label htmlFor="s-m3u-file" className="mb-1 block text-xs text-muted-foreground">
                  أو اختر ملف M3U
                </label>
                <input
                  id="s-m3u-file"
                  type="file"
                  accept=".m3u,.m3u8,text/plain"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setBulkText(await file.text());
                      toast.success("تم تحميل الملف، اضغط حفظ");
                    }
                  }}
                  className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-xs text-foreground"
                />
              </div>
              <div>
                <label htmlFor="s-m3u-url" className="mb-1 block text-xs text-muted-foreground">
                  أو رابط قائمة M3U
                </label>
                <div className="flex gap-2">
                  <input
                    id="s-m3u-url"
                    type="url"
                    dir="ltr"
                    value={m3uUrl}
                    onChange={(e) => setM3uUrl(e.target.value)}
                    placeholder="https://.../list.m3u"
                    className="flex-1 rounded-xl border border-border bg-background/80 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                  <button type="button" onClick={handleFetchM3U} className="spot-btn spot-btn-ghost">
                    جلب
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Disguised Admin Controls: Broadcast to all users + Auto-delete timer */}
          {isAdmin ? (
            <div className="space-y-3 rounded-xl border border-primary/35 bg-primary/5 p-3.5">
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Globe className="h-4 w-4 text-primary" />
                  نشر البث لجميع المستخدمين
                </span>
                <input
                  type="checkbox"
                  checked={isGlobal}
                  onChange={(e) => setIsGlobal(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
              </label>

              <div>
                <span className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 text-gold" />
                  توقيت الحذف التلقائي للبث
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPreset(p.value)}
                      className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                        preset === p.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background/70 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {preset === "custom" ? (
                  <input
                    type="datetime-local"
                    dir="ltr"
                    value={customDateTime}
                    onChange={(e) => setCustomDateTime(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-2 pt-2">
            <button type="submit" disabled={saving} className="spot-btn flex-1">
              {saving ? "جارٍ الحفظ..." : "حفظ"}
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