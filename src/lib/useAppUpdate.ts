/**
 * useAppUpdate
 *
 * Checks GitHub Releases for a newer APK version on app open.
 * Compares the latest release tag (e.g. "v1.2.0") against
 * VITE_APP_VERSION baked in at build time.
 *
 * Convention:
 *   - GitHub tag:  v1.0.1
 *   - Asset name:  stumbling-fours.apk
 */

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

const GITHUB_OWNER = "murrentronics";        // ← your GitHub username
const GITHUB_REPO  = "stumbling-fours";      // ← your GitHub repo name
const RELEASES_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

const CURRENT_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "1.0.0";

export type UpdateInfo = {
  latestVersion: string;
  apkUrl: string;
  releaseNotes: string;
};

function parseSemver(tag: string): number[] {
  return tag.replace(/^v/, "").split(".").map(Number);
}

function isNewer(current: string, latest: string): boolean {
  const c = parseSemver(current);
  const l = parseSemver(latest);
  for (let i = 0; i < 3; i++) {
    const cv = c[i] ?? 0;
    const lv = l[i] ?? 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}

export function useAppUpdate() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Only check on native Android — not on web
    if (!Capacitor.isNativePlatform()) return;

    const check = async () => {
      try {
        const res = await fetch(RELEASES_API, {
          headers: { Accept: "application/vnd.github+json" },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return;

        const data = await res.json() as {
          tag_name: string;
          body: string;
          assets: { name: string; browser_download_url: string }[];
        };

        const latestTag     = data.tag_name ?? "";
        const latestVersion = latestTag.replace(/^v/, "");

        if (!isNewer(CURRENT_VERSION, latestVersion)) return;

        const apkAsset = data.assets.find((a) => a.name.endsWith(".apk"));
        if (!apkAsset) return;

        setUpdate({
          latestVersion,
          apkUrl: apkAsset.browser_download_url,
          releaseNotes: data.body ?? "",
        });
      } catch {
        // Silently ignore network errors / timeouts
      }
    };

    // Check on mount, then every 4 hours
    check();
    const interval = setInterval(check, 4 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return {
    update: dismissed ? null : update,
    dismiss: () => setDismissed(true),
  };
}
