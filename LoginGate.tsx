import { useEffect, useState, type FormEvent } from "react";
import { DoorOpen, MessageSquareWarning, Send, User, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import spotIcon192 from "@/assets/spot-icon-192.png.asset.json";
import { translateAuthError } from "@/lib/spot-utils";
import { DeveloperPortalFlow } from "./DeveloperPortalFlow";

const SAVED_ACCOUNT_KEY = "spot_saved_account_email";

interface LoginGateProps {
  onAuthenticated: () => void;
}

export function LoginGate({ onAuthenticated }: LoginGateProps) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberAccount, setRememberAccount] = useState(true);
  const [error, setError] = useState("");
  const [confirmSent, setConfirmSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const [bugOpen, setBugOpen] = useState(false);
  const [bugName, setBugName] = useState("");
  const [bugEmail, setBugEmail] = useState("");
  const [bugMsg, setBugMsg] = useState("");
  const [bugSending, setBugSending] = useState(false);

  const [devPortalOpen, setDevPortalOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SAVED_ACCOUNT_KEY);
      if (saved) {
        setEmail(saved);
        setRememberAccount(true);
      }
    } catch {
      // Ignore storage errors in restricted browser modes
    }
  }, []);

  const persistAccountPreference = (cleanEmail: string) => {
    try {
      if (rememberAccount) {
        window.localStorage.setItem(SAVED_ACCOUNT_KEY, cleanEmail);
      } else {
        window.localStorage.removeItem(SAVED_ACCOUNT_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setConfirmSent(false);
    const cleanEmail = email.trim();
    if (!cleanEmail || password.length < 6) {
      setError("أدخل بريداً صحيحاً وكلمة مرور من 6 أحرف على الأقل");
      return;
    }

    setLoading(true);
    try {
      if (mode === "up") {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name.trim() },
          },
        });
        if (signUpErr) {
          setError(translateAuthError(signUpErr.message));
          return;
        }
        if (!data.session) {
          setConfirmSent(true);
          toast.success("أرسلنا رابط تأكيد إلى بريدك الإلكتروني");
          return;
        }
        persistAccountPreference(cleanEmail);
        toast.success("تم إنشاء حسابك بنجاح");
        onAuthenticated();
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (signInErr) {
          setError(translateAuthError(signInErr.message));
          return;
        }
        persistAccountPreference(cleanEmail);
        onAuthenticated();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    setError("");
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("اكتب بريدك الإلكتروني أولاً ثم اضغط نسيت كلمة المرور");
      return;
    }
    setLoading(true);
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetErr) {
        setError(translateAuthError(resetErr.message));
        return;
      }
      toast.success("أرسلنا رابط إعادة تعيين كلمة المرور إلى بريدك");
    } finally {
      setLoading(false);
    }
  };

  const handleBugSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!bugMsg.trim()) {
      toast.error("اكتب تفاصيل الخطأ أو الرسالة أولاً");
      return;
    }
    setBugSending(true);
    try {
      const { error: insErr } = await supabase.from("bug_reports").insert({
        sender_name: bugName.trim(),
        sender_email: bugEmail.trim(),
        message: bugMsg.trim(),
      });
      if (insErr) {
        toast.error("تعذّر إرسال الرسالة، حاول مرة أخرى");
        return;
      }
      toast.success("تم إرسال رسالتك بنجاح، شكراً لتواصلك");
      setBugName("");
      setBugEmail("");
      setBugMsg("");
      setBugOpen(false);
    } finally {
      setBugSending(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-8">
      <div className="spot-streaks" />

      {/* Subtle top action icons: small person icon (bug report) + tiny door icon (developer portal) */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => setBugOpen(true)}
          aria-label="إرسال بلاغ عن خطأ أو مشكلة"
          title="إرسال رسالة خطأ أو ملاحظة"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/80 bg-card/75 text-muted-foreground backdrop-blur-md transition-colors hover:border-primary/60 hover:text-foreground"
        >
          <User className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setDevPortalOpen(true)}
          aria-label="المشاركة مع مطوّر التطبيقات"
          title="المشاركة مع مطوّر التطبيقات"
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border/50 bg-card/45 text-muted-foreground/75 backdrop-blur-sm transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          <DoorOpen className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="spot-dialog-surface relative z-10 w-full max-w-md rounded-3xl p-6 text-center sm:p-7">
        <img
          src={spotIcon192.url}
          alt="SPOT"
          className="mx-auto h-20 w-20 rounded-2xl shadow-lg ring-1 ring-primary/50"
        />
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">سبوت SPOT</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          سجّل دخولك واحفظ مبارياتك ومفضلات عائلتك
        </p>

        <div className="my-4 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("in");
              setError("");
              setConfirmSent(false);
            }}
            className={`spot-chip ${mode === "in" ? "spot-chip-active" : ""}`}
          >
            دخول
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("up");
              setError("");
              setConfirmSent(false);
            }}
            className={`spot-chip ${mode === "up" ? "spot-chip-active" : ""}`}
          >
            حساب جديد
          </button>
        </div>

        {confirmSent ? (
          <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4 text-right text-sm leading-relaxed text-foreground">
            <p className="font-semibold">تحقق من بريدك الإلكتروني</p>
            <p className="mt-1 text-xs text-muted-foreground">
              أرسلنا رسالة لتأكيد حسابك إلى <span dir="ltr">{email}</span>. افتح الرابط في الرسالة
              ثم سجّل دخولك.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 text-right">
            {mode === "up" ? (
              <div>
                <label htmlFor="login-name" className="mb-1 block text-xs text-muted-foreground">
                  الاسم
                </label>
                <input
                  id="login-name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="اسمك"
                  className="w-full rounded-xl border border-border bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
            ) : null}

            <div>
              <label htmlFor="login-email" className="mb-1 block text-xs text-muted-foreground">
                البريد الإلكتروني
              </label>
              <input
                id="login-email"
                type="email"
                required
                dir="ltr"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full rounded-xl border border-border bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>

            <div>
              <label htmlFor="login-pass" className="mb-1 block text-xs text-muted-foreground">
                كلمة المرور
              </label>
              <input
                id="login-pass"
                type="password"
                required
                minLength={6}
                dir="ltr"
                autoComplete={mode === "up" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-border bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
              <input
                type="checkbox"
                checked={rememberAccount}
                onChange={(e) => setRememberAccount(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span>حفظ بيانات الحساب على هذا الجهاز</span>
            </label>

            {error ? (
              <p role="alert" className="min-h-4 text-xs font-medium text-destructive">
                {error}
              </p>
            ) : null}

            <button type="submit" disabled={loading} className="spot-btn mt-2 w-full py-3">
              {loading ? "يرجى الانتظار..." : mode === "up" ? "إنشاء الحساب" : "دخول"}
            </button>

            {mode === "in" ? (
              <div className="text-center">
                <button
                  type="button"
                  onClick={handleForgot}
                  disabled={loading}
                  className="mt-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>
            ) : null}
          </form>
        )}
      </div>

      {/* Bug Report Dialog */}
      {bugOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="spot-dialog-surface w-full max-w-md rounded-2xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquareWarning className="h-5 w-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">إبلاغ عن خطأ أو مشكلة</h2>
              </div>
              <button
                type="button"
                onClick={() => setBugOpen(false)}
                aria-label="إغلاق"
                className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleBugSubmit} className="space-y-3">
              <div>
                <label htmlFor="bug-name" className="mb-1 block text-xs text-muted-foreground">
                  الاسم (اختياري)
                </label>
                <input
                  id="bug-name"
                  type="text"
                  value={bugName}
                  onChange={(e) => setBugName(e.target.value)}
                  placeholder="اسمك"
                  className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <div>
                <label htmlFor="bug-email" className="mb-1 block text-xs text-muted-foreground">
                  البريد للتواصل (اختياري)
                </label>
                <input
                  id="bug-email"
                  type="email"
                  dir="ltr"
                  value={bugEmail}
                  onChange={(e) => setBugEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <div>
                <label htmlFor="bug-msg" className="mb-1 block text-xs text-muted-foreground">
                  وصف الخطأ أو الرسالة
                </label>
                <textarea
                  id="bug-msg"
                  rows={4}
                  required
                  value={bugMsg}
                  onChange={(e) => setBugMsg(e.target.value)}
                  placeholder="اشرح الخطأ أو المشكلة التي واجهتها..."
                  className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button type="submit" disabled={bugSending} className="spot-btn flex-1">
                  <Send className="h-4 w-4" />
                  {bugSending ? "جارٍ الإرسال..." : "إرسال"}
                </button>
                <button
                  type="button"
                  onClick={() => setBugOpen(false)}
                  className="spot-btn spot-btn-ghost"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {devPortalOpen ? (
        <DeveloperPortalFlow
          onBack={() => setDevPortalOpen(false)}
          onAuthenticated={() => {
            setDevPortalOpen(false);
            onAuthenticated();
          }}
        />
      ) : null}
    </div>
  );
}