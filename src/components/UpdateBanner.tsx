/**
 * UpdateBanner
 *
 * Full-screen modal shown when a new APK is available on GitHub.
 * "Update Now" opens the download page via Capacitor Browser.
 */

import { useState } from "react";
import { Download, X, Sparkles } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import type { UpdateInfo } from "@/lib/useAppUpdate";

const DOWNLOAD_PAGE = "https://stumbling-fours.pages.dev";

interface Props {
  update: UpdateInfo;
  onDismiss: () => void;
}

export function UpdateBanner({ update, onDismiss }: Props) {
  const [downloading, setDownloading] = useState(false);

  const handleUpdate = async () => {
    setDownloading(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const { Browser } = await import("@capacitor/browser");
        await Browser.open({ url: DOWNLOAD_PAGE, presentationStyle: "fullscreen" });
      } else {
        window.open(DOWNLOAD_PAGE, "_blank");
      }
    } catch {
      window.open(DOWNLOAD_PAGE, "_blank");
    } finally {
      setDownloading(false);
    }
  };

  const notes = update.releaseNotes
    ? update.releaseNotes.slice(0, 300) + (update.releaseNotes.length > 300 ? "…" : "")
    : null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center p-4"
      style={{ background: "oklch(0 0 0 / 75%)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-md rounded-3xl overflow-hidden"
        style={{
          background: "oklch(0.18 0.05 150)",
          border: "2px solid oklch(0.83 0.16 88 / 40%)",
          boxShadow: "0 0 40px oklch(0.83 0.16 88 / 20%)",
        }}
      >
        {/* Header */}
        <div
          className="px-6 pt-6 pb-4 relative"
          style={{ background: "linear-gradient(135deg, oklch(0.62 0.22 25), oklch(0.38 0.18 295))" }}
        >
          <button
            onClick={onDismiss}
            className="absolute top-4 right-4 h-8 w-8 rounded-full flex items-center justify-center"
            style={{ background: "oklch(1 0 0 / 20%)" }}
          >
            <X className="h-4 w-4 text-white" />
          </button>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl flex items-center justify-center"
                 style={{ background: "oklch(1 0 0 / 20%)" }}>
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-white/80 text-sm font-medium">New version available</p>
              <h2 className="text-white text-2xl font-black font-display">v{update.latestVersion}</h2>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {notes && (
            <div>
              <p className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest mb-2">
                What's new
              </p>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">{notes}</p>
            </div>
          )}
          <div className="space-y-2 pt-1">
            <button
              onClick={handleUpdate}
              disabled={downloading}
              className="chip-button chip-button-hover w-full disabled:opacity-50"
              style={{ background: "var(--gradient-crimson)", color: "white" }}
            >
              <Download className="h-5 w-5 mr-2" />
              {downloading ? "Opening download…" : "Update Now"}
            </button>
            <button
              onClick={onDismiss}
              className="w-full py-2.5 text-sm text-foreground/50 hover:text-foreground/80 transition"
            >
              Remind me later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
