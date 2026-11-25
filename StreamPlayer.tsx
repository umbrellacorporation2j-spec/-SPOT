import { useEffect, useRef } from "react";
import { Clock, Globe } from "lucide-react";
import { toast } from "sonner";
import spotIcon512 from "@/assets/spot-icon-512.png.asset.json";
import type { SpotStream } from "@/lib/spot-types";
import { formatTimeRemaining, isVideoUrl, toEmbedUrl } from "@/lib/spot-utils";

interface StreamPlayerProps {
  stream: SpotStream | null;
  hidden: boolean;
  nowMs: number;
}

export function StreamPlayer({ stream, hidden, nowMs }: StreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!stream || !isVideoUrl(stream.url)) return;
    const videoEl = videoRef.current;
    if (!videoEl) return;

    let hlsInstance: { destroy: () => void } | null = null;
    let cancelled = false;

    const attach = async () => {
      if (/\.m3u8/i.test(stream.url)) {
        const { default: Hls } = await import("hls.js");
        if (cancelled) return;
        if (Hls.isSupported()) {
          const hls = new Hls({ lowLatencyMode: true });
          hlsInstance = hls;
          hls.loadSource(stream.url);
          hls.attachMedia(videoEl);
          hls.on(Hls.Events.ERROR, (_evt, data) => {
            if (data.fatal) {
              toast.error("تعذّر تشغيل الرابط، تحقق من الرابط أو صلاحية CORS");
            }
          });
        } else {
          videoEl.src = stream.url;
        }
      } else {
        videoEl.src = stream.url;
      }
      void videoEl.play().catch(() => {});
    };

    void attach();

    return () => {
      cancelled = true;
      if (hlsInstance) hlsInstance.destroy();
      videoEl.pause();
      videoEl.removeAttribute("src");
      videoEl.load();
    };
  }, [stream]);

  if (hidden) return null;

  const remaining = stream && nowMs ? formatTimeRemaining(stream.expires_at, nowMs) : null;

  return (
    <section className="mt-3.5">
      <div className="spot-stage">
        {!stream ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center text-sm text-muted-foreground">
            <img
              src={spotIcon512.url}
              alt="SPOT"
              className="w-24 rounded-2xl shadow-2xl ring-1 ring-primary/40 sm:w-28"
            />
            <span>اختر بثاً من القائمة لبدء المشاهدة</span>
          </div>
        ) : isVideoUrl(stream.url) ? (
          <video
            ref={videoRef}
            controls
            autoPlay
            playsInline
            className="absolute inset-0 h-full w-full bg-background"
          />
        ) : (
          <iframe
            key={stream.id}
            src={toEmbedUrl(stream.url)}
            title={stream.title}
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full border-0 bg-background"
          />
        )}
      </div>

      <div className="flex min-h-14 flex-wrap items-center gap-2.5 px-1 py-2.5">
        {stream ? (
          <>
            <span className="spot-live-tag">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-foreground" />
              مباشر
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold text-foreground">{stream.title}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{stream.league || "بدون بطولة"}</span>
                {stream.is_global ? (
                  <span className="inline-flex items-center gap-1 text-primary">
                    <Globe className="h-3 w-3" />
                    بث للجميع
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
          </>
        ) : (
          <span className="text-sm text-muted-foreground">اختر بثاً من القائمة لبدء المشاهدة</span>
        )}
      </div>
    </section>
  );
}