import { create } from "zustand";

export type Role = "admin" | "player";

export type Team = {
  id: string;
  name: string;
  players: { email: string; name: string }[];
  color: "team-a" | "team-b";
};

export type RoundEntry = {
  id: string;
  tableId: string;
  matchId: string;
  teamId: string;
  teamName: string;
  high: boolean;
  low: boolean;
  jack: number; // 0, 1, or 3 (hang jack)
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

  // hang jack flash trigger keyed per table
  hangJackFlash: Record<string, number>;
  triggerHangJack: (tableId: string) => void;
  clearHangJack: (tableId: string) => void;
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
}));
