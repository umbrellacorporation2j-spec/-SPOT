import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const developerLoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6),
  secretPin: z.string().trim().min(1),
});

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export type DeveloperLoginResult =
  | { ok: true; accessToken: string; refreshToken: string }
  | { ok: false; error: string };

export const verifyDeveloperLogin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => developerLoginSchema.parse(input))
  .handler(async ({ data }): Promise<DeveloperLoginResult> => {
    const expectedPin = process.env["SPOT_DEVELOPER_PIN"] || "1057534388";
    if (!constantTimeEqual(data.secretPin, expectedPin)) {
      return { ok: false, error: "بيانات الدخول أو الرقم التعريفي السري غير صحيحة" };
    }

    const supabaseUrl = process.env["SUPABASE_URL"];
    const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!supabaseUrl || !publishableKey) {
      return { ok: false, error: "إعدادات السحابة غير متوفرة حالياً" };
    }

    const authClient = createClient<Database>(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (
            publishableKey.startsWith("sb_") &&
            h.get("Authorization") === `Bearer ${publishableKey}`
          ) {
            h.delete("Authorization");
          }
          h.set("apikey", publishableKey);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (authError || !authData.user || !authData.session) {
      const msg = (authError?.message ?? "").toLowerCase();
      if (msg.includes("email not confirmed")) {
        return { ok: false, error: "يرجى تأكيد بريدك الإلكتروني أولاً قبل تسجيل الدخول" };
      }
      return { ok: false, error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: roleError } = await supabaseAdmin.from("user_roles").upsert(
      { user_id: authData.user.id, role: "admin" },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );

    if (roleError) {
      console.error("Failed to assign developer role:", roleError);
      return { ok: false, error: "تعذّر تفعيل صلاحيات مطوّر التطبيقات" };
    }

    return {
      ok: true,
      accessToken: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
    };
  });

export const purgeExpiredStreams = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ deletedCount: number }> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) {
      throw new Error("Forbidden");
    }

    const { data: deleted, error } = await context.supabase
      .from("streams")
      .delete()
      .not("expires_at", "is", null)
      .lte("expires_at", new Date().toISOString())
      .select("id");

    if (error) {
      throw new Error("Failed to purge expired streams");
    }

    return { deletedCount: deleted?.length ?? 0 };
  });