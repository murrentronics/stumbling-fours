import { useEffect } from "react";
import { supabase } from "./supabase";
import { useApp, markRemoteSnapshotHash, type Match, type RoundEntry, type Tournament } from "./store";

type Snapshot = { tournament: Tournament | null; matches: Match[]; entries: RoundEntry[]; hangJackFlash?: Record<string, number> };

function isSnapshot(v: unknown): v is Snapshot {
  return !!v && typeof v === "object" && "matches" in (v as Record<string, unknown>);
}

export function useRealtimeSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("game_snapshot")
        .select("data")
        .eq("id", 1)
        .maybeSingle();
      if (cancelled) return;
      const snap = (data?.data ?? null) as Snapshot | null;
      if (isSnapshot(snap)) {
        markRemoteSnapshotHash(snap);
        useApp.getState().hydrateSnapshot(snap);
      }
    })();

    const channel = supabase
      .channel("game_snapshot_rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_snapshot" },
        (payload) => {
          const rec = (payload.new ?? payload.old) as { data?: unknown } | null;
          const snap = rec?.data;
          if (isSnapshot(snap)) {
            markRemoteSnapshotHash(snap);
            useApp.getState().hydrateSnapshot(snap);
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [enabled]);
}
