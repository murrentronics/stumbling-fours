import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useApp, type Team, type Match, type TeamColor, winnerIsTeamA } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Trophy, Plus, Trash2, Shuffle, Medal, Play, ChevronDown, ChevronUp, History } from "lucide-react";

type RosterTeam = { id: string; name: string; color: TeamColor };
type RosterMember = { team_id: string; user_id: string; display_name: string; email: string | null };

export const Route = createFileRoute("/tournament")({
  head: () => ({
    meta: [
      { title: "Tournament — Stumbling Fours" },
      { name: "description", content: "Create your tournament, lock in teams, set prizes and bracket size." },
    ],
  }),
  component: TournamentPage,
});

type SlotTeam = {
  slotId: string;
  rosterTeamId: string; // "" = unselected
  color: TeamColor;
  playerUserIds: string[]; // selected members, length = playersPerTeam
};

function TournamentPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const tournament = useApp((s) => s.tournament);
  const setTournament = useApp((s) => s.setTournament);
  const setMatches = useApp((s) => s.setMatches);
  const existingMatches = useApp((s) => s.matches);

  const [name, setName] = useState(tournament?.name ?? "Stumbling Fours Cup");
  const [pp, setPp] = useState(tournament?.playersPerTeam ?? 2);
  const [first, setFirst] = useState(tournament?.prizes.first ?? "Trophy + $1000");
  const [second, setSecond] = useState(tournament?.prizes.second ?? "$400");
  const [third, setThird] = useState(tournament?.prizes.third ?? "$200");

  // Scheduled date — stored as YYYY-MM-DDTHH:mm for the datetime-local input
  const toInputVal = (ts?: number) => {
    if (!ts) return "";
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [scheduledInput, setScheduledInput] = useState(toInputVal(tournament?.scheduledDate));

  const [rosterTeams, setRosterTeams] = useState<RosterTeam[]>([]);
  const [rosterMembers, setRosterMembers] = useState<RosterMember[]>([]);
  const [slots, setSlots] = useState<SlotTeam[]>([]);

  useEffect(() => {
    const load = async () => {
      const [{ data: t }, { data: m }, { data: adminRoles }] = await Promise.all([
        supabase.from("roster_teams").select("id,name,color").order("name"),
        supabase.from("roster_team_members").select("team_id,user_id,display_name,email"),
        supabase.from("user_roles").select("user_id").eq("role", "admin"),
      ]);
      const adminIds = new Set((adminRoles ?? []).map((r: { user_id: string }) => r.user_id));
      setRosterTeams(((t as RosterTeam[]) ?? []).filter((team) => team.name !== 'Admin'));
      setRosterMembers(((m as RosterMember[]) ?? []).filter((mm) => !adminIds.has(mm.user_id)));
    };
    void load();
    const ch = supabase
      .channel("tournament_roster_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "roster_teams" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "roster_team_members" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const canEdit = isAdmin;

  // Keep playerUserIds arrays in sync when playersPerTeam changes
  useEffect(() => {
    setSlots((prev) =>
      prev.map((s) => {
        if (s.playerUserIds.length === pp) return s;
        const next = Array(pp).fill("").map((_, i) => s.playerUserIds[i] ?? "");
        return { ...s, playerUserIds: next };
      })
    );
  }, [pp]);

  const addSlot = () => {
    const base = slots.length;
    setSlots([
      ...slots,
      { slotId: `s-${Date.now()}-${base + 1}`, rosterTeamId: "", color: "team-a", playerUserIds: Array(pp).fill("") },
      { slotId: `s-${Date.now()}-${base + 2}`, rosterTeamId: "", color: "team-b", playerUserIds: Array(pp).fill("") },
    ]);
  };

  const updateSlot = (id: string, patch: Partial<SlotTeam>) =>
    setSlots(slots.map((s) => (s.slotId === id ? { ...s, ...patch } : s)));

  const removeSlot = (id: string) => setSlots(slots.filter((s) => s.slotId !== id));

  const buildTeams = (): Team[] => {
    return slots
      .filter((s) => s.rosterTeamId)
      .map((s): Team => {
        const rt = rosterTeams.find((r) => r.id === s.rosterTeamId);
        const players = s.playerUserIds.filter(Boolean).map((uid) => {
          // Try exact match first (user_id + team), fall back to user_id only
          const m =
            rosterMembers.find((mm) => mm.user_id === uid && mm.team_id === s.rosterTeamId) ??
            rosterMembers.find((mm) => mm.user_id === uid);
          return { email: m?.email ?? "", name: m?.display_name ?? uid };
        });
        return {
          id: s.slotId,
          name: rt?.name ?? "Team",
          color: s.color,
          players,
        };
      });
  };

  const lock = () => {
    const teams = buildTeams();
    const scheduledDate = scheduledInput ? new Date(scheduledInput).getTime() : undefined;
    setTournament({
      id: tournament?.id ?? `trn-${Date.now()}`,
      name, playersPerTeam: pp, gamesPerRound: 1,
      prizes: { first, second, third },
      teams,
      createdAt: tournament?.createdAt ?? Date.now(),
      scheduledDate,
    });
  };

  const startRound = () => {
    const teams = buildTeams();
    const scheduledDate = scheduledInput ? new Date(scheduledInput).getTime() : undefined;
    setTournament({
      id: tournament?.id ?? `trn-${Date.now()}`,
      name, playersPerTeam: pp, gamesPerRound: 1,
      prizes: { first, second, third },
      teams,
      createdAt: tournament?.createdAt ?? Date.now(),
      scheduledDate,
    });
    const shuffled = shuffle(teams);
    const newMatches: Match[] = [];
    for (let i = 0; i < shuffled.length - 1; i += 2) {
      const a = shuffled[i];
      const b = shuffled[i + 1];
      newMatches.push({
        id: `m-${Date.now()}-${i}`,
        tableId: `T-${i / 2 + 1}`,
        tableName: `Table ${i / 2 + 1}`,
        tournamentId: tournament?.id ?? `trn-${Date.now()}`,
        tournamentName: name,
        teamA: a, teamB: b,
        scoreA: 0, scoreB: 0,
        status: "live",
        round: 1,
        startedAt: Date.now(),
      });
    }
    const past = existingMatches.filter((m) => m.status === "completed");
    setMatches([...newMatches, ...past]);
    navigate({ to: "/tables" });
  };

  const teamsPreview = useMemo(buildTeams, [slots, rosterTeams, rosterMembers]);
  const bracket = generateBracket(teamsPreview);
  const validSlots = slots.filter(
    (s) => s.rosterTeamId && s.playerUserIds.slice(0, pp).every(Boolean)
  );
  const canStart = canEdit && validSlots.length >= 2 && validSlots.length % 2 === 0;

  // player user ids already assigned in OTHER slots (globally unique per player)
  const usedPlayerIdsExcluding = (excludeSlot: string) =>
    new Set(
      slots
        .filter((s) => s.slotId !== excludeSlot)
        .flatMap((s) => s.playerUserIds.filter(Boolean))
    );

  type TournTab = "create" | "history";
  const [tournTab, setTournTab] = useState<TournTab>("create");

  return (
    <div className="pt-2 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display font-black text-4xl gold-text flex items-center gap-3">
          <Trophy className="h-8 w-8" /> Tournament
        </h1>
      </div>

      {/* Tab strip */}
      <div className="flex items-center gap-1 p-1.5 rounded-full w-full"
           style={{ background: "oklch(0.20 0.06 150)", border: "1px solid oklch(0.83 0.16 88 / 30%)" }}>
        {([
          { id: "create",  label: "Create"      },
          { id: "history", label: "Tournaments"  },
        ] as { id: TournTab; label: string }[]).map((t) => {
          const active = tournTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTournTab(t.id)}
              className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 font-bold uppercase tracking-widest transition text-xs
                ${active ? "text-black" : "text-foreground/70"}`}
              style={active ? { background: "var(--gradient-gold)" } : {}}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Create tab ─────────────────────────────────────────────────── */}
      {tournTab === "create" && (
        <>
          {/* Schedule button */}
          {canEdit && (
            <div className="flex justify-end">
              <button
                onClick={startRound}
                disabled={!canStart}
                title={canStart ? "" : "Need an even number of fully-filled teams (2+)"}
                className="chip-button chip-button-hover disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "var(--gradient-crimson)", color: "white" }}
              >
                <Play className="h-4 w-4 mr-2" /> Schedule
              </button>
            </div>
          )}

          {/* Settings */}
          <section className="ornate-border p-6 grid md:grid-cols-2 gap-5">
            <Field label="Tournament Name">
              <input className="ts-input" value={name} disabled={!canEdit} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Schedule Date & Time (optional)">
              <input
                type="datetime-local"
                className="ts-input"
                value={scheduledInput}
                disabled={!canEdit}
                onChange={(e) => setScheduledInput(e.target.value)}
                style={{ colorScheme: "dark" }}
              />
            </Field>
            <Field label="Players per Team (at each table)">
              <div className="flex gap-2">
                {[1, 2].map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setPp(n)}
                    className="flex-1 py-2.5 rounded-lg border-2 font-display font-black text-lg transition"
                    style={{
                      borderColor: pp === n ? "oklch(0.83 0.16 88)" : "oklch(0.83 0.16 88 / 25%)",
                      background: pp === n ? "var(--gradient-gold)" : "oklch(0.16 0.04 150)",
                      color: pp === n ? "oklch(0.18 0.05 150)" : "var(--color-foreground)",
                      boxShadow: pp === n ? "0 0 12px oklch(0.83 0.16 88 / 40%)" : "none",
                      opacity: !canEdit ? 0.7 : 1,
                      cursor: !canEdit ? "not-allowed" : "pointer",
                    }}
                  >
                    {n} {n === 1 ? "Player" : "Players (Partners)"}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-foreground/45 mt-1.5">
                {pp === 1 ? "1-on-1 — one player per team sits at each table." : "2-on-2 — two partners from each team sit together."}
              </div>
            </Field>
            <Field label="1st Place Prize">
              <input className="ts-input" value={first} disabled={!canEdit} onChange={(e) => setFirst(e.target.value)} />
            </Field>
            <Field label="2nd Place Prize (optional)">
              <input className="ts-input" value={second} disabled={!canEdit} onChange={(e) => setSecond(e.target.value)} />
            </Field>
            <Field label="3rd Place Prize (optional)">
              <input className="ts-input" value={third} disabled={!canEdit} onChange={(e) => setThird(e.target.value)} />
            </Field>
          </section>

          {/* Prizes preview */}
          <section className="grid md:grid-cols-3 gap-4">
            <PrizeCard place="1st" value={first} medal="oklch(0.83 0.16 88)" />
            <PrizeCard place="2nd" value={second} medal="oklch(0.78 0.02 250)" />
            <PrizeCard place="3rd" value={third} medal="oklch(0.62 0.13 50)" />
          </section>

          {/* Teams */}
          <section className="ornate-border p-6">
            <div className="mb-4">
              <h2 className="font-display font-black text-lg gold-text whitespace-nowrap">Team Selection</h2>
            </div>
            {canEdit && (
              <button onClick={addSlot} className="chip-button chip-button-hover w-full justify-center mb-4 text-sm">
                <Plus className="h-4 w-4 mr-2" /> Add Team Pair
              </button>
            )}
            {rosterTeams.length === 0 && (
              <div className="text-sm text-foreground/60 italic mb-4">
                No standing teams yet — head to <span className="gold-text font-bold">Teams</span> to create some.
              </div>
            )}
            {slots.length === 0 && rosterTeams.length > 0 && (
              <div className="text-sm text-foreground/60 italic">No teams added yet — click "Add Team Pair".</div>
            )}
            <div className="grid md:grid-cols-2 gap-4">
              {slots.map((s) => {
                const roster = rosterMembers.filter((m) => m.team_id === s.rosterTeamId);
                const usedInSlot = new Set(s.playerUserIds.filter(Boolean));
                const usedElsewhere = usedPlayerIdsExcluding(s.slotId);
                return (
                  <div key={s.slotId} className="rounded-xl p-4 border-2"
                       style={{ borderColor: `var(--${s.color})`, background: "oklch(0.18 0.05 150 / 80%)" }}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-md flex-shrink-0 border-2"
                           style={{ background: s.rosterTeamId ? `var(--${s.color})` : "oklch(0.3 0 0)", borderColor: s.rosterTeamId ? `var(--${s.color})` : "oklch(0.4 0 0)" }} />
                      <select className="ts-input flex-1 font-display font-bold" value={s.rosterTeamId} disabled={!canEdit}
                              onChange={(e) => {
                                const chosen = rosterTeams.find((rt) => rt.id === e.target.value);
                                updateSlot(s.slotId, { rosterTeamId: e.target.value, color: chosen?.color ?? s.color, playerUserIds: Array(pp).fill("") });
                              }}>
                        <option value="">— Select Team —</option>
                        {rosterTeams.map((rt) => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                      </select>
                      {canEdit && (
                        <button onClick={() => removeSlot(s.slotId)} className="p-2 rounded-md hover:bg-white/5">
                          <Trash2 className="h-4 w-4 text-foreground/60" />
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {Array.from({ length: pp }).map((_, i) => {
                        const selected = s.playerUserIds[i] ?? "";
                        const disabled = !canEdit || !s.rosterTeamId;
                        return (
                          <select key={i} className="ts-input" value={selected} disabled={disabled}
                                  onChange={(e) => { const next = [...s.playerUserIds]; next[i] = e.target.value; updateSlot(s.slotId, { playerUserIds: next }); }}>
                            <option value="">{s.rosterTeamId ? `— Select Player ${i + 1} —` : "Select a team first"}</option>
                            {roster.map((m) => (
                              <option key={m.user_id} value={m.user_id}
                                      disabled={(usedInSlot.has(m.user_id) && m.user_id !== selected) || usedElsewhere.has(m.user_id)}>
                                {m.display_name}{m.email ? ` (${m.email})` : ""}
                              </option>
                            ))}
                          </select>
                        );
                      })}
                      {s.rosterTeamId && roster.length === 0 && (
                        <div className="text-[11px] italic text-foreground/50">No members assigned to this team yet.</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Bracket preview */}
          {teamsPreview.length >= 2 && (
            <section className="ornate-border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-black text-2xl gold-text">Bracket Preview</h2>
                <button onClick={() => setSlots(shuffle(slots))} className="chip-button chip-button-hover text-xs"
                        style={{ background: "var(--gradient-crimson)", color: "white" }}>
                  <Shuffle className="h-4 w-4 mr-1" /> Re-shuffle
                </button>
              </div>
              <div className="grid md:grid-cols-3 gap-6 overflow-x-auto">
                {bracket.map((round, ri) => (
                  <div key={ri}>
                    <div className="font-marquee tracking-[0.3em] text-xs text-foreground/60 mb-2">
                      {ri === bracket.length - 1 ? "FINAL" : ri === bracket.length - 2 ? "SEMIFINAL" : `ROUND ${ri + 1}`}
                    </div>
                    <div className="space-y-3">
                      {round.map((pair, pi) => (
                        <div key={pi} className="rounded-lg p-3 border"
                             style={{ background: "oklch(0.20 0.06 150)", borderColor: "oklch(0.83 0.16 88 / 30%)" }}>
                          {ri === 0 && (
                            <div className="text-[9px] font-marquee tracking-[0.3em] text-foreground/40 mb-2 pb-1.5 border-b"
                                 style={{ borderColor: "oklch(0.83 0.16 88 / 15%)" }}>
                              TABLE {pi + 1}
                            </div>
                          )}
                          <div className="mb-1">
                            <div className="text-sm font-bold" style={{ color: pair[0] ? `var(--${pair[0].color})` : "var(--foreground)" }}>{pair[0]?.name ?? "TBD"}</div>
                            {pair[0]?.players && pair[0].players.length > 0 && (
                              <div className="mt-0.5 space-y-0.5 pl-1">
                                {pair[0].players.map((p, i) => <div key={i} className="text-[10px] text-foreground/55 truncate">{p.name || p.email.split("@")[0]}</div>)}
                              </div>
                            )}
                          </div>
                          <div className="text-[10px] text-foreground/40 my-1.5 tracking-widest">VS</div>
                          <div>
                            <div className="text-sm font-bold" style={{ color: pair[1] ? `var(--${pair[1].color})` : "var(--foreground)" }}>{pair[1]?.name ?? "TBD"}</div>
                            {pair[1]?.players && pair[1].players.length > 0 && (
                              <div className="mt-0.5 space-y-0.5 pl-1">
                                {pair[1].players.map((p, i) => <div key={i} className="text-[10px] text-foreground/55 truncate">{p.name || p.email.split("@")[0]}</div>)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* ── Tournaments history tab ─────────────────────────────────────── */}
      {tournTab === "history" && <TournamentsHistoryTab />}

      <style>{`
        .ts-input {
          background: oklch(0.16 0.04 150);
          border: 1px solid oklch(0.83 0.16 88 / 25%);
          color: var(--color-foreground);
          padding: 0.55rem 0.75rem;
          border-radius: 0.5rem;
          width: 100%;
          font-size: 0.875rem;
          outline: none;
          transition: border-color .15s ease, box-shadow .15s ease;
        }
        .ts-input:focus { border-color: oklch(0.83 0.16 88); box-shadow: 0 0 0 3px oklch(0.83 0.16 88 / 25%); }
        .ts-input:disabled { opacity: 0.7; cursor: not-allowed; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-[0.25em] text-foreground/60 mb-1.5">{label}</div>
      {children}
    </label>
  );
}

function PrizeCard({ place, value, medal }: { place: string; value: string; medal: string }) {
  return (
    <div className="ornate-border p-5 flex items-center gap-4">
      <div className="h-14 w-14 rounded-full grid place-items-center" style={{ background: medal, boxShadow: `0 0 25px ${medal}` }}>
        <Medal className="h-6 w-6" style={{ color: "oklch(0.18 0.05 150)" }} />
      </div>
      <div>
        <div className="font-marquee tracking-[0.3em] text-xs text-foreground/60">{place} PLACE</div>
        <div className="font-display font-black text-xl gold-text">{value || "—"}</div>
      </div>
    </div>
  );
}

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateBracket(teams: Team[]): (Team | undefined)[][][] {
  if (teams.length < 2) return [];
  const size = 1 << Math.ceil(Math.log2(teams.length));
  const padded: (Team | undefined)[] = [...teams];
  while (padded.length < size) padded.push(undefined);
  const rounds: (Team | undefined)[][][] = [];
  let current = padded;
  while (current.length > 1) {
    const pairs: (Team | undefined)[][] = [];
    for (let i = 0; i < current.length; i += 2) pairs.push([current[i], current[i + 1]]);
    rounds.push(pairs);
    current = new Array(pairs.length).fill(undefined);
  }
  return rounds;
}

// ── Tournaments History Tab ────────────────────────────────────────────────────

function TournamentsHistoryTab() {
  const allMatches = useApp((s) => s.matches);
  const allEntries = useApp((s) => s.entries);

  const completed = allMatches.filter((m) => m.status === "completed");

  if (completed.length === 0) {
    return (
      <div className="ornate-border p-12 text-center">
        <div className="h-14 w-14 mx-auto rounded-full grid place-items-center mb-3"
             style={{ background: "var(--gradient-gold)", color: "oklch(0.18 0.05 150)" }}>
          <History className="h-6 w-6" />
        </div>
        <div className="font-display font-bold text-xl gold-text">No completed tournaments yet</div>
        <div className="text-sm text-foreground/55 mt-1">Completed games will appear here grouped by tournament.</div>
      </div>
    );
  }

  const fmtDate = (ts: number) =>
    new Date(ts).toLocaleDateString("en-TT", { day: "numeric", month: "short", year: "numeric" });

  // Group by tournamentId
  const groups = new Map<string, { id: string; name: string; matches: typeof completed }>();
  for (const m of completed) {
    const tid   = m.tournamentId   ?? "legacy";
    const tname = m.tournamentName ?? "Tournament";
    if (!groups.has(tid)) groups.set(tid, { id: tid, name: tname, matches: [] });
    groups.get(tid)!.matches.push(m);
  }

  const sortedGroups = Array.from(groups.values()).sort((a, b) => {
    const latestA = Math.max(...a.matches.map((m) => m.startedAt));
    const latestB = Math.max(...b.matches.map((m) => m.startedAt));
    return latestB - latestA;
  });

  return (
    <div className="space-y-4">
      {sortedGroups.map((grp) => {
        const timestamps = grp.matches.map((m) => m.startedAt);
        const minTs = Math.min(...timestamps);
        const maxTs = Math.max(...timestamps);
        const dateRange = minTs === maxTs ? fmtDate(minTs) : `${fmtDate(minTs)} – ${fmtDate(maxTs)}`;
        const maxRound = Math.max(...grp.matches.map((m) => m.round));
        const sorted = [...grp.matches].sort((a, b) =>
          b.round !== a.round ? b.round - a.round : b.startedAt - a.startedAt
        );
        return (
          <THistoryAccordion
            key={grp.id}
            name={grp.name}
            dateRange={dateRange}
            matches={sorted}
            maxRound={maxRound}
            allEntries={allEntries}
          />
        );
      })}
    </div>
  );
}

type THistoryEntry = import("@/lib/store").RoundEntry;
type THistoryMatch = import("@/lib/store").Match;

function THistoryAccordion({
  name, dateRange, matches, maxRound, allEntries,
}: {
  name: string;
  dateRange: string;
  matches: THistoryMatch[];
  maxRound: number;
  allEntries: THistoryEntry[];
}) {
  const [open, setOpen] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="ornate-border overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 p-5 text-left"
        style={{ background: "oklch(0.20 0.06 150 / 60%)" }}
      >
        <div className="h-10 w-10 rounded-full grid place-items-center flex-shrink-0"
             style={{ background: "var(--gradient-gold)", color: "oklch(0.18 0.05 150)" }}>
          <Trophy className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-black text-base gold-text leading-snug">{name}</div>
          <div className="font-marquee text-xs tracking-[0.25em] text-foreground/55 mt-0.5">{dateRange}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-foreground/50">{matches.length} games</span>
          {open ? <ChevronUp className="h-4 w-4 text-foreground/50" /> : <ChevronDown className="h-4 w-4 text-foreground/50" />}
        </div>
      </button>

      {open && (
        <div className="divide-y" style={{ borderColor: "oklch(0.83 0.16 88 / 15%)" }}>
          {matches.map((m) => {
            const isFinal   = m.round === maxRound;
            const isExpanded = expandedId === m.id;
            const matchEntries = allEntries.filter((e) => e.matchId === m.id);
            const roundLabel = getRoundLabel(m.round, maxRound);
            const entriesA = matchEntries.filter((e) => e.teamId === m.teamA.id);
            const entriesB = matchEntries.filter((e) => e.teamId === m.teamB.id);

            return (
              <div key={m.id} style={{ borderColor: "oklch(0.83 0.16 88 / 15%)" }}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : m.id)}
                  className="w-full text-left transition-all active:scale-[0.99]"
                  style={{
                    background: isExpanded ? "oklch(0.22 0.06 150)" : isFinal ? "oklch(0.83 0.16 88 / 6%)" : "oklch(0.18 0.05 150 / 60%)",
                    borderBottom: isExpanded ? "none" : "1px solid oklch(0.83 0.16 88 / 10%)",
                  }}
                >
                  <div className="px-4 py-3.5">
                    <div className="flex items-center gap-2 mb-2.5">
                      {isFinal ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex-shrink-0"
                              style={{ background: "var(--gradient-gold)", color: "oklch(0.18 0.05 150)" }}>★ Final</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0"
                              style={{ background: "oklch(0.25 0.06 150)", color: "var(--color-foreground)", opacity: 0.7 }}>{roundLabel}</span>
                      )}
                      <span className="text-[10px] text-foreground/35 flex-shrink-0">
                        {new Date(m.startedAt).toLocaleDateString("en-TT", { day: "numeric", month: "short" })} · {m.tableName}
                      </span>
                      <div className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-full flex-shrink-0"
                           style={{ background: isExpanded ? "oklch(0.83 0.16 88 / 20%)" : "oklch(0.83 0.16 88 / 10%)", border: "1px solid oklch(0.83 0.16 88 / 30%)", color: "oklch(0.83 0.16 88)" }}>
                        <span className="text-[9px] font-bold uppercase tracking-wider">{isExpanded ? "Close" : "Details"}</span>
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: `var(--${m.teamA.color})` }} />
                          <span className="font-display font-bold text-sm truncate" style={{ color: `var(--${m.teamA.color})` }}>{m.teamA.name}</span>
                          {m.disqualifiedTeamId === m.teamA.id && <span className="text-[9px] font-bold px-1 py-0.5 rounded flex-shrink-0" style={{ background: "oklch(0.55 0.22 25 / 25%)", color: "oklch(0.75 0.18 25)" }}>DQ</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {(() => { const wA = winnerIsTeamA(m, matchEntries); return (<>
                          <span className="font-display font-black text-xl" style={{ color: wA ? "oklch(0.83 0.16 88)" : "var(--color-foreground)" }}>{m.scoreA}</span>
                          <span className="text-foreground/30 text-sm font-bold">—</span>
                          <span className="font-display font-black text-xl" style={{ color: !wA ? "oklch(0.83 0.16 88)" : "var(--color-foreground)" }}>{m.scoreB}</span>
                        </>); })()}
                      </div>
                      <div className="flex-1 min-w-0 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {m.disqualifiedTeamId === m.teamB.id && <span className="text-[9px] font-bold px-1 py-0.5 rounded flex-shrink-0" style={{ background: "oklch(0.55 0.22 25 / 25%)", color: "oklch(0.75 0.18 25)" }}>DQ</span>}
                          <span className="font-display font-bold text-sm truncate" style={{ color: `var(--${m.teamB.color})` }}>{m.teamB.name}</span>
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: `var(--${m.teamB.color})` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </button>

                {isExpanded && (() => {
                  const wA = winnerIsTeamA(m, matchEntries);
                  const winnerTeam  = wA ? m.teamA : m.teamB;
                  const winnerScore = wA ? m.scoreA : m.scoreB;
                  const loserScore  = wA ? m.scoreB : m.scoreA;
                  return (
                    <div className="px-4 pb-5 space-y-4" style={{ background: "oklch(0.15 0.04 150 / 80%)", borderTop: "1px solid oklch(0.83 0.16 88 / 12%)" }}>
                      <div className="grid grid-cols-2 gap-3 pt-4">
                        {[{ team: m.teamA, isWinner: wA, isDQ: m.disqualifiedTeamId === m.teamA.id },
                          { team: m.teamB, isWinner: !wA, isDQ: m.disqualifiedTeamId === m.teamB.id }].map(({ team, isWinner, isDQ }) => (
                          <div key={team.id} className="rounded-xl p-3 space-y-1.5"
                               style={{ background: "oklch(0.18 0.05 150 / 80%)", border: `1px solid var(--${team.color})`, opacity: isDQ ? 0.6 : 1 }}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: `var(--${team.color})` }} />
                              <span className="font-display font-bold text-xs truncate" style={{ color: `var(--${team.color})` }}>{team.name}</span>
                              {isWinner && <span className="ml-auto text-[10px] gold-text font-black flex-shrink-0">★ Won</span>}
                              {isDQ && <span className="ml-auto text-[10px] font-bold flex-shrink-0" style={{ color: "oklch(0.75 0.18 25)" }}>DQ</span>}
                            </div>
                            {team.players.map((p) => (
                              <div key={p.email} className="text-[11px] text-foreground/65 truncate pl-0.5">{p.name || p.email.split("@")[0]}</div>
                            ))}
                          </div>
                        ))}
                      </div>
                      {matchEntries.length > 0 && (
                        <div className="grid grid-cols-2 gap-3">
                          {[{ entries: entriesA, team: m.teamA }, { entries: entriesB, team: m.teamB }].map(({ entries, team }) => (
                            <div key={team.id} className="space-y-1.5">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] uppercase tracking-[0.2em] font-bold truncate" style={{ color: `var(--${team.color})` }}>{team.name}</span>
                                <span className="text-[10px] text-foreground/45 flex-shrink-0 ml-1">{entries.reduce((s,e)=>s+e.total,0)} pts</span>
                              </div>
                              {entries.map((e) => (
                                <div key={e.id} className="rounded-lg px-2.5 py-2 flex items-center justify-between gap-2"
                                     style={{ background: "oklch(0.20 0.06 150)", border: "1px solid oklch(0.83 0.16 88 / 15%)" }}>
                                  <div className="flex items-center gap-1 flex-wrap min-w-0">
                                    {[e.high&&{l:"H",r:false},e.low&&{l:"L",r:false},e.jack===3&&{l:"HJ",r:true},e.jack===1&&{l:"J",r:false},e.game&&{l:"G",r:false}]
                                      .filter(Boolean).map((b: any) => (
                                      <span key={b.l} className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase"
                                            style={{ background: b.r ? "var(--gradient-crimson)" : "oklch(0.83 0.16 88 / 20%)", color: b.r ? "white" : "oklch(0.83 0.16 88)" }}>{b.l}</span>
                                    ))}
                                  </div>
                                  <span className="font-display font-black text-sm flex-shrink-0 gold-text">+{e.total}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid oklch(0.83 0.16 88 / 25%)" }}>
                        <div className="p-3 flex items-center justify-between gap-3" style={{ background: "oklch(0.20 0.06 150)" }}>
                          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: `var(--${winnerTeam.color})` }}>{winnerTeam.name} wins</div>
                          <div className="font-display font-black text-2xl gold-text flex-shrink-0">{winnerScore} — {loserScore}</div>
                        </div>
                        {m.disqualifiedTeamId && (
                          <div className="flex items-center gap-2 px-3 py-2" style={{ background: "oklch(0.55 0.22 25 / 12%)", borderTop: "1px solid oklch(0.55 0.22 25 / 25%)" }}>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase flex-shrink-0" style={{ background: "var(--gradient-crimson)", color: "white" }}>DQ</span>
                            <span className="text-[11px] text-foreground/60">
                              {m.disqualifiedTeamId === m.teamA.id ? m.teamA.name : m.teamB.name} was disqualified — opponent awarded the win
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getRoundLabel(round: number, maxRound: number): string {
  const remaining = maxRound - round;
  if (remaining === 0) return "Final";
  if (remaining === 1) return "Semifinal";
  if (remaining === 2) return "Quarterfinal";
  return `Round ${round}`;
}
