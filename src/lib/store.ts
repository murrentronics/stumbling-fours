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
};

const teamA: Team = {
  id: "t-aces",
  name: "Aces High",
  color: "team-a",
  players: [
    { email: "kareem@example.com", name: "Kareem" },
    { email: "rishi@example.com", name: "Rishi" },
  ],
};
const teamB: Team = {
  id: "t-jokers",
  name: "Wild Jokers",
  color: "team-b",
  players: [
    { email: "anika@example.com", name: "Anika" },
    { email: "darius@example.com", name: "Darius" },
  ],
};
const teamC: Team = {
  id: "t-kings",
  name: "Port Kings",
  color: "team-a",
  players: [
    { email: "jamal@example.com", name: "Jamal" },
    { email: "tariq@example.com", name: "Tariq" },
  ],
};
const teamD: Team = {
  id: "t-queens",
  name: "Savannah Queens",
  color: "team-b",
  players: [
    { email: "maya@example.com", name: "Maya" },
    { email: "leila@example.com", name: "Leila" },
  ],
};

export const useApp = create<State>((set) => ({
  role: "player",
  setRole: (r) => set({ role: r }),
  currentUserEmail: "kareem@example.com",
  setCurrentUserEmail: (e) => set({ currentUserEmail: e }),

  tournament: {
    id: "trn-1",
    name: "Stumbling Fours Cup 2026",
    playersPerTeam: 2,
    gamesPerRound: 1,
    prizes: { first: "Trophy + $1000", second: "$400", third: "$200" },
    teams: [teamA, teamB, teamC, teamD],
    createdAt: Date.now(),
  },
  setTournament: (t) => set({ tournament: t }),

  matches: [
    {
      id: "m-1",
      tableId: "T-1",
      tableName: "Table 1",
      teamA,
      teamB,
      scoreA: 9,
      scoreB: 11,
      status: "live",
      round: 1,
      startedAt: Date.now() - 1000 * 60 * 22,
    },
    {
      id: "m-2",
      tableId: "T-2",
      tableName: "Table 2",
      teamA: teamC,
      teamB: teamD,
      scoreA: 6,
      scoreB: 4,
      status: "live",
      round: 1,
      startedAt: Date.now() - 1000 * 60 * 8,
    },
  ],
  setMatches: (m) => set({ matches: m }),
  updateMatch: (id, patch) =>
    set((s) => ({ matches: s.matches.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),

  entries: [
    {
      id: "e-1",
      tableId: "T-1",
      matchId: "m-1",
      teamId: teamA.id,
      teamName: teamA.name,
      high: true, low: true, jack: 1, game: true,
      total: 5,
      submittedBy: "kareem@example.com",
      ts: Date.now() - 1000 * 60 * 5,
    },
    {
      id: "e-2",
      tableId: "T-1",
      matchId: "m-1",
      teamId: teamB.id,
      teamName: teamB.name,
      high: false, low: false, jack: 0, game: false,
      total: 0,
      submittedBy: "anika@example.com",
      ts: Date.now() - 1000 * 60 * 4,
    },
  ],
  addEntry: (e) => set((s) => ({ entries: [e, ...s.entries] })),

  hangJackFlash: {},
  triggerHangJack: (tableId) =>
    set((s) => ({ hangJackFlash: { ...s.hangJackFlash, [tableId]: Date.now() } })),
}));
