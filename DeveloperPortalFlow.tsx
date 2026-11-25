import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, KeyRound, Lock, Mail, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { verifyDeveloperLogin } from "@/lib/admin-auth.functions";

const SAVED_DEV_EMAIL_KEY = "spot_saved_dev_email";

interface DeveloperPortalFlowProps {
  onBack: () => void;
  onAuthenticated: () => void;
}

export function DeveloperPortalFlow({ onBack, onAuthenticated }: DeveloperPortalFlowProps) {
  const [stage, setStage] = useState<"intro" | "dropping" | "login">("intro");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secretPin, setSecretPin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const runDeveloperLogin = useServerFn(verifyDeveloperLogin);

  useEffect(() => {
    try {
      const saved =
        window.localStorage.getItem(SAVED_DEV_EMAIL_KEY) ??
        window.localStorage.getItem("spot_saved_account_email");
      if (saved) setEmail(saved);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const handleContinue = () => {
    if (stage !== "intro") return;
    setStage("dropping");
    window.setTimeout(() => {
      setStage("login");
    }, 580);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password || !secretPin.trim()) {
      setError("يرجى تعبئة البريد وكلمة المرور والرقم التعريفي السري");
      return;
    }
    setSubmitting(true);
    try {
      const res = await runDeveloperLogin({
        data: {
          email: email.trim(),
          password,
          secretPin: secretPin.trim(),
        },
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const { error: sessionErr } = await supabase.auth.setSession({
        access_token: res.accessToken,
        refresh_token: res.refreshToken,
      });
      if (sessionErr) {
        setError("تعذّر تفعيل الجلسة، حاول مرة أخرى");
        return;
      }
      try {
        window.localStorage.setItem(SAVED_DEV_EMAIL_KEY, email.trim());
      } catch {
        // Ignore storage errors
      }
      toast.success("تم تسجيل الدخول إلى مساحة مطوّر التطبيقات");
      onAuthenticated();
    } catch {
      setError("حدث خطأ أثناء التحقق، حاول مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-background/95 p-4 backdrop-blur-md">
      <div className="spot-streaks" />

      {stage !== "login" ? (
        <div
          className={`spot-glass-panel relative z-10 w-full max-w-md rounded-3xl p-7 text-center ${
            stage === "dropping" ? "spot-glass-drop pointer-events-none" : ""
          }`}
        >
          <button
            type="button"
            onClick={onBack}
            className="mb-5 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            العودة
          </button>

          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-foreground/20 bg-foreground/10 shadow-lg">
            <Users className="h-8 w-8 text-foreground" />
          </div>

          <h2 className="text-xl font-bold tracking-tight text-foreground">
            المشاركة مع مطوّر التطبيقات
          </h2>
          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
            بوابة مخصّصة للتعاون الفني وإدارة المحتوى والتحديثات المباشرة لتطبيق سبوت.
          </p>

          <div className="mt-8">
            <button
              type="button"
              onClick={handleContinue}
              className="spot-glass-btn w-full rounded-2xl px-6 py-3.5 text-sm font-semibold"
            >
              متابعة
            </button>
          </div>
        </div>
      ) : (
        <div className="spot-dialog-surface spot-dev-reveal relative z-10 w-full max-w-md rounded-3xl p-6 sm:p-7">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">دخول مطوّر التطبيقات</h2>
                <p className="text-xs text-muted-foreground">تسجيل دخول مُصرّح به فقط</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              رجوع
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="dev-email"
                className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <Mail className="h-3.5 w-3.5" />
                البريد الإلكتروني
              </label>
              <input
                id="dev-email"
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
              <label
                htmlFor="dev-pass"
                className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <Lock className="h-3.5 w-3.5" />
                كلمة المرور
              </label>
              <input
                id="dev-pass"
                type="password"
                required
                minLength={6}
                dir="ltr"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-border bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>

            <div>
              <label
                htmlFor="dev-pin"
                className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <KeyRound className="h-3.5 w-3.5" />
                الرقم التعريفي السري
              </label>
              <input
                id="dev-pin"
                type="password"
                inputMode="numeric"
                required
                dir="ltr"
                autoComplete="off"
                value={secretPin}
                onChange={(e) => setSecretPin(e.target.value)}
                placeholder="••••••••••"
                className="w-full rounded-xl border border-border bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>

            {error ? (
              <p role="alert" className="text-xs font-medium text-destructive">
                {error}
              </p>
            ) : null}

            <button type="submit" disabled={submitting} className="spot-btn mt-2 w-full py-3">
              {submitting ? "جارٍ التحقق..." : "تسجيل الدخول"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}