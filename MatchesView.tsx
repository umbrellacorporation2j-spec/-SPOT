import { useMemo, useState } from "react";
import { Pencil, Plus, Shield, Trash2 } from "lucide-react";
import type { MatchStatus, SpotMatch } from "@/lib/spot-types";
import { formatMatchDate, matchStatusLabel } from "@/lib/spot-utils";

interface MatchesViewProps {
  matches: SpotMatch[];
  mode: "all" | "results";
  isAdmin: boolean;
  loading: boolean;
  onAddMatch: () => void;
  onEditMatch: (match: SpotMatch) => void;
  onDeleteMatch: (match: SpotMatch) => void;
}

function TeamCrest({ name, logoUrl }: { name: string; logoUrl: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
      <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-background/60">
        {logoUrl && !broken ? (
          <img
            src={logoUrl}
            alt={name}
            loading="lazy"
            onError={() => setBroken(true)}
            className="h-9 w-9 object-contain"
          />
        ) : (
          <Shield className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <span className="line-clamp-2 text-xs font-semibold text-foreground sm:text-sm">{name}</span>
    </div>
  );
}

export function MatchesView({
  matches,
  mode,
  isAdmin,
  loading,
  onAddMatch,
  onEditMatch,
  onDeleteMatch,
}: MatchesViewProps) {
  const [statusFilter, setStatusFilter] = useState<"all" | MatchStatus>("all");
  const [leagueFilter, setLeagueFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const baseList = useMemo(() => {
    if (mode === "results") {
      return matches.filter(
        (m) => m.status === "finished" || (m.home_score !== null && m.away_score !== null),
      );
    }
    return matches;
  }, [matches, mode]);

  const leagues = useMemo(
    () => [...new Set(baseList.map((m) => m.league).filter(Boolean))],
    [baseList],
  );

  const filtered = useMemo(() => {
    const k = query.trim().toLowerCase();
    return baseList.filter((m) => {
      if (mode === "all" && statusFilter !== "all" && m.status !== statusFilter) return false;
      if (leagueFilter !== "all" && m.league !== leagueFilter) return false;
      if (k) {
        const haystack = `${m.home_team} ${m.away_team} ${m.league} ${m.venue}`.toLowerCase();
        if (!haystack.includes(k)) return false;
      }
      return true;
    });
  }, [baseList, mode, statusFilter, leagueFilter, query]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="spot-section-heading my-0 flex-1">
          {mode === "results" ? "نتائج المباريات" : "جميع المباريات"}
          <span className="text-xs font-normal text-muted-foreground">({filtered.length})</span>
        </h2>
        {isAdmin ? (
          <button type="button" onClick={onAddMatch} className="spot-btn">
            <Plus className="h-4 w-4" />
            إضافة مباراة
          </button>
        ) : null}
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ابحث باسم فريق أو بطولة..."
        className="w-full rounded-xl border border-border bg-card/80 px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary"
      />

      {mode === "all" ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(
            [
              ["all", "الكل"],
              ["live", "مباشر"],
              ["scheduled", "قادمة"],
              ["finished", "انتهت"],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setStatusFilter(val)}
              className={`spot-chip ${statusFilter === val ? "spot-chip-active" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {leagues.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setLeagueFilter("all")}
            className={`spot-chip ${leagueFilter === "all" ? "spot-chip-active" : ""}`}
          >
            جميع البطولات
          </button>
          {leagues.map((lg) => (
            <button
              key={lg}
              type="button"
              onClick={() => setLeagueFilter(lg)}
              className={`spot-chip ${leagueFilter === lg ? "spot-chip-active" : ""}`}
            >
              {lg}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2].map((n) => (
            <div key={n} className="h-28 animate-pulse rounded-2xl bg-card" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <p>
            {baseList.length === 0
              ? mode === "results"
                ? "لا توجد نتائج مسجّلة حتى الآن"
                : "لا توجد مباريات مضافة حتى الآن"
              : "لا توجد مباريات مطابقة للبحث"}
          </p>
          {isAdmin ? (
            <button type="button" onClick={onAddMatch} className="spot-btn">
              <Plus className="h-4 w-4" />
              إضافة مباراة الآن
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((m) => {
            const hasScore = m.home_score !== null && m.away_score !== null;
            const expanded = expandedId === m.id;
            const details = [
              m.league,
              m.round_name ? `الجولة ${m.round_name}` : "",
              m.venue ? `الملعب: ${m.venue}` : "",
              m.notes,
            ].filter(Boolean);

            return (
              <article
                key={m.id}
                onClick={() => setExpandedId(expanded ? null : m.id)}
                className={`spot-card cursor-pointer p-4 ps-5 ${expanded ? "spot-card-active" : ""}`}
              >
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <TeamCrest name={m.home_team} logoUrl={m.home_logo_url} />

                  <div className="flex flex-col items-center text-center">
                    <span
                      className={`mb-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        m.status === "live"
                          ? "bg-primary text-primary-foreground"
                          : m.status === "finished"
                            ? "bg-secondary text-muted-foreground"
                            : "bg-primary/15 text-primary"
                      }`}
                    >
                      {matchStatusLabel(m.status)}
                    </span>
                    <strong className="text-xl font-bold tracking-wider text-foreground" dir="ltr">
                      {hasScore ? `${m.home_score} - ${m.away_score}` : "VS"}
                    </strong>
                    {m.kickoff_at ? (
                      <small className="mt-1 text-[11px] text-muted-foreground">
                        {formatMatchDate(m.kickoff_at)}
                      </small>
                    ) : null}
                  </div>

                  <TeamCrest name={m.away_team} logoUrl={m.away_logo_url} />
                </div>

                {expanded && details.length > 0 ? (
                  <div className="mt-3 border-t border-border/60 pt-2.5 text-center text-xs text-muted-foreground">
                    {details.join(" · ")}
                  </div>
                ) : null}

                {isAdmin ? (
                  <div
                    className="mt-3 flex items-center justify-end gap-2 border-t border-border/50 pt-2.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => onEditMatch(m)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-background/70 px-2.5 py-1 text-xs text-foreground hover:border-primary"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      تعديل
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteMatch(m)}
                      className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      حذف
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}