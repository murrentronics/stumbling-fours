import { create } from "zustand";
import { supabase } from "./supabase";

export type Role = "admin" | "player";

export type TeamColor =
  | "team-a"   | "team-b"   | "team-c"   | "team-d"
  | "team-e"   | "team-f"   | "team-g"   | "team-h"
  | "team-i"   | "team-j"   | "team-k"
  | "team-m"   | "team-n"   | "team-o"   | "team-p"
  | "team-q"   | "team-r";

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
  hydrateSnapshot: (s: { tournament: Tournament | null; matches: Match[]; entries: RoundEntry[] } | null) => void;
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
    set({
      _hydrating: true,
      tournament: snap?.tournament ?? null,
      matches: snap?.matches ?? [],
      entries: snap?.entries ?? [],
    }),
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
  const payload = { tournament: s.tournament, matches: s.matches, entries: s.entries };
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
    s.tournament !== prev.tournament || s.matches !== prev.matches || s.entries !== prev.entries;
  prev = s;
  if (changed && !s._hydrating) schedulePush();
});

export function markRemoteSnapshotHash(data: unknown) {
  lastPushed = JSON.stringify(data);
}
