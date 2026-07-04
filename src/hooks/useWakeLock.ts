import { useEffect } from "react";

/**
 * Requests a Screen Wake Lock so the display never dims or locks
 * while the app is in the foreground. Re-acquires automatically
 * when the page becomes visible again (e.g. after a tab switch).
 */
export function useWakeLock() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!("wakeLock" in navigator)) return; // API not available (old browsers)

    let lock: WakeLockSentinel | null = null;

    async function acquire() {
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        // Permission denied or API unavailable — silently ignore
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        acquire();
      }
    }

    acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      lock?.release().catch(() => {});
    };
  }, []);
}
