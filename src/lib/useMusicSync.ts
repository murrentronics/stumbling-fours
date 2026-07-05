/**
 * useMusicSync
 *
 * The casino BGM plays automatically on every logged-in device.
 * The toggle button is a personal mute/unmute — it only controls
 * the audio on that device. No cross-device commands are sent.
 *
 * Auto-starts when the user is logged in.
 * Auto-stops when the user logs out.
 * Remembers the user's mute preference in localStorage.
 */
import { useCallback, useEffect, useState } from "react";
import { appMusic } from "./appMusic";

const STORAGE_KEY = "sf_music_muted";

export function useMusicSync(enabled: boolean) {
  // Read the saved preference — default is playing (not muted)
  const [muted, setMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  // When login state or mute preference changes, start/stop accordingly
  useEffect(() => {
    if (enabled && !muted) {
      appMusic.start();
    } else {
      appMusic.stop();
    }
  }, [enabled, muted]);

  // Cleanup when component unmounts (e.g. full page unload)
  useEffect(() => {
    return () => { appMusic.stop(); };
  }, []);

  // Pause when app goes to background, resume when it comes back — only if music was on
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (appMusic.playing) appMusic.stop();
      } else {
        // Only resume if the user hasn't muted and is logged in
        if (enabled && !muted) appMusic.start();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [enabled, muted]);

  /** Toggle mute for this device only */
  const toggleMusic = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  return { playing: enabled && !muted, toggleMusic };
}
