import { useState } from "react";
import { Copy, Users, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { SpotFamily } from "@/lib/spot-types";

interface FamilyDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  family: SpotFamily | null;
  onChanged: () => void;
}

export function FamilyDialog({ open, onClose, userId, family, onChanged }: FamilyDialogProps) {
  const [familyName, setFamilyName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const handleCreate = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("create_family_with_owner", {
        _name: familyName.trim() || "عائلتي",
      });
      if (error) {
        toast.error("تعذّر إنشاء العائلة");
        return;
      }
      toast.success("تم إنشاء العائلة بنجاح");
      setFamilyName("");
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) {
      toast.error("أدخل رمز الدعوة أولاً");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.rpc("join_family_by_code", {
        _invite_code: joinCode.trim().toUpperCase(),
      });
      if (error) {
        toast.error("رمز الدعوة غير صحيح");
        return;
      }
      toast.success("انضممت إلى العائلة");
      setJoinCode("");
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMember = async (targetId: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("remove_family_member", {
        _target_user_id: targetId,
      });
      if (error) {
        toast.error("تعذّرت إزالة العضو");
        return;
      }
      toast.success("تمت إزالة العضو");
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("leave_or_delete_family");
      if (error) {
        toast.error("تعذّر تحديث العائلة");
        return;
      }
      toast.success(family?.owner_id === userId ? "تم حذف العائلة" : "غادرت العائلة");
      onChanged();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="spot-dialog-surface max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">إدارة العائلة</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!family ? (
          <div className="space-y-4">
            <p className="text-xs leading-relaxed text-muted-foreground">
              أنشئ عائلة لمشاركة المفضلات والمتابعة فقط دون مشاركة روابطك الخاصة، أو انضم برمز
              دعوة.
            </p>
            <div>
              <label htmlFor="fam-name" className="mb-1 block text-xs text-muted-foreground">
                اسم العائلة
              </label>
              <input
                id="fam-name"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="عائلتي"
                className="w-full rounded-xl border border-border bg-background/80 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              />
              <button
                type="button"
                disabled={busy}
                onClick={handleCreate}
                className="spot-btn mt-2.5 w-full"
              >
                إنشاء عائلة
              </button>
            </div>

            <div className="border-t border-border pt-4">
              <label htmlFor="fam-code" className="mb-1 block text-xs text-muted-foreground">
                رمز الدعوة
              </label>
              <input
                id="fam-code"
                dir="ltr"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="A7K2Q9"
                className="w-full rounded-xl border border-border bg-background/80 px-3 py-2.5 text-center text-sm tracking-widest text-foreground outline-none focus:border-primary"
              />
              <button
                type="button"
                disabled={busy}
                onClick={handleJoin}
                className="spot-btn spot-btn-ghost mt-2.5 w-full"
              >
                انضمام
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              تُشارك العائلة «{family.name}» المفضلات والمتابعة فقط.
            </p>
            <div className="flex items-center justify-between rounded-xl border border-dashed border-primary bg-background/80 px-4 py-3">
              <span className="text-xl font-bold tracking-[0.25em] text-foreground" dir="ltr">
                {family.invite_code}
              </span>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(family.invite_code);
                  toast.success("تم نسخ رمز الدعوة");
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1.5 text-xs text-foreground hover:bg-primary/20"
              >
                <Copy className="h-3.5 w-3.5" />
                نسخ
              </button>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                الأعضاء ({family.members.length})
              </p>
              <div className="divide-y divide-border/70">
                {family.members.map((m) => (
                  <div key={m.user_id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {m.display_name || m.email || "عضو"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {m.role === "owner" ? "المالك" : "عضو"}
                      </p>
                    </div>
                    {family.owner_id === userId && m.user_id !== userId ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRemoveMember(m.user_id)}
                        className="rounded-lg border border-destructive/40 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/15"
                      >
                        إزالة
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={handleLeave}
              className="spot-btn spot-btn-ghost w-full"
            >
              {family.owner_id === userId ? "حذف العائلة" : "مغادرة العائلة"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}