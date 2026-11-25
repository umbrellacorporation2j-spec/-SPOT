import { Clock, Eye, Globe, Pencil, Play, Plus, Star, Trash2, User } from "lucide-react";
import type { SpotStream } from "@/lib/spot-types";
import { formatTimeRemaining, thumbOf } from "@/lib/spot-utils";

interface StreamListProps {
  streams: SpotStream[];
  currentId: string | null;
  userId: string;
  isAdmin: boolean;
  nowMs: number;
  favorites: Set<string>;
  tracked: Set<string>;
  emptyMessage: string;
  onPlay: (stream: SpotStream) => void;
  onTogglePref: (kind: "favorites" | "tracked", id: string) => void;
  onEdit: (stream: SpotStream) => void;
  onDelete: (stream: SpotStream) => void;
  onAdd: () => void;
}

export function StreamList({
  streams,
  currentId,
  userId,
  isAdmin,
  nowMs,
  favorites,
  tracked,
  emptyMessage,
  onPlay,
  onTogglePref,
  onEdit,
  onDelete,
  onAdd,
}: StreamListProps) {
  if (streams.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-7 text-center text-sm text-muted-foreground">
        <p>{emptyMessage}</p>
        <button type="button" onClick={onAdd} className="spot-btn">
          <Plus className="h-4 w-4" />
          إضافة بث
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-2.5 md:grid-cols-2">
      {streams.map((stream) => {
        const thumb = thumbOf(stream);
        const isCurrent = currentId === stream.id;
        const isFav = favorites.has(stream.id);
        const isTr = tracked.has(stream.id);
        const canModify = isAdmin || (stream.owner_id === userId && !stream.is_global);
        const remaining = nowMs ? formatTimeRemaining(stream.expires_at, nowMs) : null;

        return (
          <article
            key={stream.id}
            tabIndex={0}
            role="button"
            onClick={() => onPlay(stream)}
            onKeyDown={(e) => {
              if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onPlay(stream);
              }
            }}
            className={`spot-card flex min-h-20 cursor-pointer items-center gap-3 p-2.5 pe-3 ps-4 ${
              isCurrent ? "spot-card-active" : ""
            }`}
          >
            <div className="relative flex aspect-video w-24 flex-none items-center justify-center overflow-hidden rounded-lg border border-primary/40 bg-background">
              <Play className="h-5 w-5 fill-current text-foreground/80" />
              {thumb ? (
                <img
                  src={thumb}
                  alt=""
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : null}
              <span className="spot-live-tag absolute top-1 start-1 px-1.5 py-0.5 text-[9px]">
                مباشر
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">{stream.title}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="truncate">{stream.league || "بدون بطولة"}</span>
                {stream.is_global ? (
                  <span className="inline-flex items-center gap-0.5 text-primary">
                    <Globe className="h-3 w-3" />
                    عام
                  </span>
                ) : null}
                {isAdmin && stream.ownerLabel ? (
                  <span className="inline-flex items-center gap-0.5">
                    <User className="h-3 w-3" />
                    {stream.ownerLabel}
                  </span>
                ) : null}
                {remaining ? (
                  <span className="inline-flex items-center gap-0.5 text-gold">
                    <Clock className="h-3 w-3" />
                    {remaining}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-none items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => onTogglePref("favorites", stream.id)}
                title="مفضلة"
                aria-label="إضافة للمفضلة"
                className={`rounded-lg p-1.5 transition-colors ${
                  isFav ? "text-gold" : "text-muted-foreground hover:text-gold"
                }`}
              >
                <Star className={`h-4 w-4 ${isFav ? "fill-current" : ""}`} />
              </button>
              <button
                type="button"
                onClick={() => onTogglePref("tracked", stream.id)}
                title="متابعة"
                aria-label="متابعة"
                className={`rounded-lg p-1.5 transition-colors ${
                  isTr ? "text-gold" : "text-muted-foreground hover:text-gold"
                }`}
              >
                <Eye className="h-4 w-4" />
              </button>
              {canModify ? (
                <>
                  <button
                    type="button"
                    onClick={() => onEdit(stream)}
                    title="تعديل"
                    aria-label="تعديل البث"
                    className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(stream)}
                    title="حذف"
                    aria-label="حذف البث"
                    className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}