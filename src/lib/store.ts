import { create } from "zustand";
import { supabase } from "./supabase";

export type Role = "admin" | "player";

/**
 * Reliably determine which team won a completed match.
 * Score is the primary source of truth — winnerId alone is not trustworthy
 * because JSON serialization drops `undefined` values and the field can
 * disappear after a Supabase snapshot round-trip.
 *
 * Tiebreaker (All Fours rules): when scores are equal, the winner is the
 * team that first scored High, then Low, then Hang Jack, then Game
 * in the final round's entries (sorted by submission timestamp).
 *
 * Returns true if teamA won.
 */
export function winnerIsTeamA(
  match: {
    scoreA: number;
    scoreB: number;
    winnerId?: string;
    teamA: { id: string };
    teamB: { id: string };
    disqualifiedTeamId?: string;
  },
  entries?: RoundEntry[],
): boolean {
  // DQ: the disqualified team loses
  if (match.disqualifiedTeamId) {
    return match.disqualifiedTeamId === match.teamB.id;
  }

  // Score is primary truth
  if (match.scoreA !== match.scoreB) {
    return match.scoreA > match.scoreB;
  }

  // ── Tied score — All Fours tiebreaker ──────────────────────────────────
  // Order of precedence: High → Low → Hang Jack → Game
  // Winner = first team to have scored that category in the final deal
  if (entries && entries.length > 0) {
    // Sort all entries by submission time ascending (earliest first)
    const sorted = [...entries].sort((a, b) => a.ts - b.ts);

    // Check each category in order
    const categories: ((e: RoundEntry) => boolean)[] = [
      (e) => e.high,
      (e) => e.low,
      (e) => e.jack > 0,   // Hang Jack (3) or Jack (1)
      (e) => e.game,
    ];

    for (const hasCategory of categories) {
      const first = sorted.find(hasCategory);
      if (first) {
        return first.teamId === match.teamA.id;
      }
    }
  }

  // Last resort: explicit winnerId
  if (match.winnerId) {
    return match.winnerId === match.teamA.id;
  }

  // Absolute fallback — teamA
  return true;
}

export type TeamColor =
  | "team-a"   | "team-b"   | "team-c"   | "team-d"
  | "team-e"   | "team-f"   | "team-g"   | "team-h"
  | "team-i"   | "team-j"   | "team-k"
  | "team-m"   | "team-n"   | "team-o"   | "team-p"
  | "team-q"   | "team-r"
  | "team-s"   | "team-t"   | "team-u"   | "team-v"
  | "team-w"   | "team-x"   | "team-y"   | "team-z";

export const TEAM_COLORS: { value: TeamColor; label: string; css: string }[] = [
  { value: "team-a", label: "Crimson",      css: "oklch(0.62 0.22 25)" },
  { value: "team-b", label: "Royal Blue",   css: "oklch(0.55 0.18 250)" },
  { value: "team-c", label: "Emerald",      css: "oklch(0.62 0.18 160)" },
  { value: "team-d", label: "Gold",         css: "oklch(0.78 0.18 88)" },
  { value: "team-e", label: "Purple",       css: "oklch(0.55 0.22 300)" },
  { value: "team-f", label: "Orange",       css: "oklch(0.68 0.20 50)" },
  { value: "team-g", label: "Teal",         css: "oklch(0.60 0.16 195)" },
  { value: "team-h", label: "Rose",         css: "oklch(0.65 0.20 355)" },
  { value: "team-i", label: "Lime",         css: "oklch(0.72 0.18 130)" },
  { value: "team-j", label: "Sky",          css: "oklch(0.68 0.16 220)" },
  { value: "team-k", label: "Amber",        css: "oklch(0.74 0.18 70)" },
  { value: "team-m", label: "Coral",        css: "oklch(0.66 0.20 35)" },
  { value: "team-n", label: "Mint",         css: "oklch(0.72 0.14 170)" },
  { value: "team-o", label: "Magenta",      css: "oklch(0.60 0.24 330)" },
  { value: "team-p", label: "Slate",        css: "oklch(0.62 0.08 230)" },
  { value: "team-q", label: "Copper",       css: "oklch(0.64 0.16 55)" },
  { value: "team-r", label: "Violet",       css: "oklch(0.58 0.22 285)" },
  { value: "team-s", label: "Brown",        css: "oklch(0.48 0.10 55)" },
  { value: "team-t", label: "Burgundy",     css: "oklch(0.40 0.16 20)" },
  { value: "team-u", label: "Tan",          css: "oklch(0.74 0.08 75)" },
  { value: "team-v", label: "Grey",         css: "oklch(0.60 0.01 250)" },
  { value: "team-w", label: "Cream",        css: "oklch(0.93 0.04 95)" },
  { value: "team-x", label: "Beige",        css: "oklch(0.86 0.05 85)" },
  { value: "team-y", label: "White",        css: "oklch(0.97 0.00 0)" },
  { value: "team-z", label: "Black",        css: "oklch(0.22 0.00 0)" },
];

export type Team = {
  id: string;
  name: string;
  players: { email: string; name: string }[];
  color: TeamColor;
};

export type RoundEntry = {
  id: string;
  tableId: string;
  matchId: string;
  teamId: string;
  teamName: string;
  high: boolean;
  low: boolean;
  jack: number; // 0 or 3
  game: boolean;
  total: number;
  submittedBy: string;
  ts: number;
};

export type Match = {
  id: string;
  tableId: string;
  tableName: string;
  teamA: Team;
  teamB: Team;
  scoreA: number;
  scoreB: number;
  status: "live" | "pending" | "completed";
  winnerId?: string;
  disqualifiedTeamId?: string; // set when match ended by DQ
  round: number;
  startedAt: number;
};

export type Tournament = {
  id: string;
  name: string;
  playersPerTeam: number;
  gamesPerRound: number;
  prizes: { first: string; second?: string; third?: string };
  teams: Team[];
  createdAt: number;
  scheduledDate?: number; // future start timestamp — shows in Upcoming tab
};

type State = {
  role: Role;
  setRole: (r: Role) => void;
  currentUserEmail: string;
  setCurrentUserEmail: (e: string) => void;

  tournament: Tournament | null;
  setTournament: (t: Tournament | null) => void;

  matches: Match[];
  setMatches: (m: Match[]) => void;
  updateMatch: (id: string, patch: Partial<Match>) => void;

  entries: RoundEntry[];
  addEntry: (e: RoundEntry) => void;

  hangJackFlash: Record<string, number>;
  triggerHangJack: (tableId: string) => void;
  clearHangJack: (tableId: string) => void;

  _hydrating: boolean;
  hydrateSnapshot: (s: { tournament: Tournament | null; matches: Match[]; entries: RoundEntry[]; hangJackFlash?: Record<string, number> } | null) => void;
};

export const useApp = create<State>((set) => ({
  role: "player",
  setRole: (r) => set({ role: r }),
  currentUserEmail: "",
  setCurrentUserEmail: (e) => set({ currentUserEmail: e }),

  tournament: null,
  setTournament: (t) => set({ tournament: t }),

  matches: [],
  setMatches: (m) => set({ matches: m }),
  updateMatch: (id, patch) =>
    set((s) => ({ matches: s.matches.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),

  entries: [],
  addEntry: (e) => set((s) => ({ entries: [e, ...s.entries] })),

  hangJackFlash: {},
  triggerHangJack: (tableId) =>
    set((s) => ({ hangJackFlash: { ...s.hangJackFlash, [tableId]: Date.now() } })),
  clearHangJack: (tableId) =>
    set((s) => {
      const next = { ...s.hangJackFlash };
      delete next[tableId];
      return { hangJackFlash: next };
    }),

  _hydrating: false,
  hydrateSnapshot: (snap) =>
    set((s) => ({
      _hydrating: true,
      tournament: snap?.tournament ?? null,
      matches: snap?.matches ?? [],
      entries: snap?.entries ?? [],
      // Merge incoming hangJackFlash — only apply keys newer than what we already have
      // so a device that already cleared its own overlay doesn't re-fire
      hangJackFlash: snap?.hangJackFlash
        ? Object.fromEntries(
            Object.entries(snap.hangJackFlash).filter(
              ([tableId, ts]) => (s.hangJackFlash[tableId] ?? 0) < (ts as number)
            )
          )
        : s.hangJackFlash,
    })),
}));

// Reset _hydrating flag immediately after apply (microtask so subscribers see it as true)
useApp.subscribe((s) => {
  if (s._hydrating) queueMicrotask(() => useApp.setState({ _hydrating: false }));
});

// Auto-push snapshot to Supabase on any relevant change.
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let lastPushed = "";
async function pushSnapshot() {
  const s = useApp.getState();
  const payload = {
    tournament: s.tournament,
    matches: s.matches,
    entries: s.entries,
    hangJackFlash: s.hangJackFlash,
  };
  const serialized = JSON.stringify(payload);
  if (serialized === lastPushed) return;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  lastPushed = serialized;
  await supabase
    .from("game_snapshot")
    .upsert(
      { id: 1, data: payload, updated_by: auth.user.id, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    );
}
function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(pushSnapshot, 200);
}

let prev = useApp.getState();
useApp.subscribe((s) => {
  const changed =
    s.tournament !== prev.tournament ||
    s.matches !== prev.matches ||
    s.entries !== prev.entries ||
    s.hangJackFlash !== prev.hangJackFlash;
  prev = s;
  if (changed && !s._hydrating) schedulePush();
});

export function markRemoteSnapshotHash(data: unknown) {
  lastPushed = JSON.stringify(data);
}
