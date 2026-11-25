import {
  CalendarDays,
  Eye,
  HelpCircle,
  Home,
  LogOut,
  Star,
  Trophy,
  Tv,
  Users,
  Wrench,
  X,
} from "lucide-react";
import spotIcon192 from "@/assets/spot-icon-192.png.asset.json";
import type { SpotView } from "@/lib/spot-types";

interface SpotDrawerProps {
  open: boolean;
  onClose: () => void;
  view: SpotView;
  onSelectView: (v: SpotView) => void;
  userLabel: string;
  isAdmin: boolean;
  counts: {
    streams: number;
    matches: number;
    favorites: number;
    tracked: number;
    reports: number;
  };
  onOpenFamily: () => void;
  onSignOut: () => void;
}

export function SpotDrawer({
  open,
  onClose,
  view,
  onSelectView,
  userLabel,
  isAdmin,
  counts,
  onOpenFamily,
  onSignOut,
}: SpotDrawerProps) {
  if (!open) return null;

  const navItems: Array<{ key: SpotView; label: string; icon: typeof Home; count?: number }> = [
    { key: "home", label: "الرئيسية", icon: Home },
    { key: "streams", label: "جميع البثوث", icon: Tv, count: counts.streams },
    { key: "matches", label: "جميع المباريات", icon: CalendarDays, count: counts.matches },
    { key: "results", label: "النتائج", icon: Trophy },
    { key: "favorites", label: "المفضلة", icon: Star, count: counts.favorites },
    { key: "tracked", label: "المتابعة", icon: Eye, count: counts.tracked },
    { key: "help", label: "كيف أضيف بثاً؟", icon: HelpCircle },
  ];

  if (isAdmin) {
    navItems.push({
      key: "developer",
      label: "مطوّر التطبيقات",
      icon: Wrench,
      count: counts.reports,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        aria-label="القائمة الرئيسية"
        className="spot-dialog-surface relative z-10 flex h-full w-[min(85vw,320px)] flex-col overflow-y-auto border-e border-primary/50 p-4"
      >
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-3">
            <img
              src={spotIcon192.url}
              alt="SPOT"
              className="h-12 w-12 rounded-2xl ring-1 ring-primary/60"
            />
            <div>
              <p className="text-lg font-bold leading-none text-foreground">سبوت</p>
              <p className="mt-1 text-[10px] font-bold tracking-[0.25em] text-primary">SPOT</p>
              <p className="mt-1 max-w-[160px] truncate text-xs text-muted-foreground">
                {userLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق القائمة"
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-2 mt-2 text-[11px] font-semibold text-muted-foreground">الأقسام</p>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  onSelectView(item.key);
                  onClose();
                }}
                className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-right text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary/20 text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
              >
                <span
                  className={`spot-slant flex h-9 w-9 flex-none items-center justify-center ${
                    active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1">{item.label}</span>
                {item.count ? (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-foreground">
                    {item.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <p className="mb-2 mt-5 text-[11px] font-semibold text-muted-foreground">الحساب</p>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenFamily();
            }}
            className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-right text-sm font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
          >
            <span className="spot-slant flex h-9 w-9 flex-none items-center justify-center bg-secondary text-foreground">
              <Users className="h-4 w-4" />
            </span>
            <span>العائلة</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onSignOut();
            }}
            className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-right text-sm font-medium text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
          >
            <span className="spot-slant flex h-9 w-9 flex-none items-center justify-center bg-secondary text-foreground">
              <LogOut className="h-4 w-4" />
            </span>
            <span>تسجيل الخروج</span>
          </button>
        </div>

        <p className="mt-auto pt-6 text-[11px] text-muted-foreground">
          SPOT · مشغّل المباريات المباشرة
        </p>
      </aside>
    </div>
  );
}