import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useApp, type Team, type Match } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Trophy, Plus, Trash2, Lock, Shuffle, Medal, Shield, UserPlus, Play } from "lucide-react";

type RosterTeam = { id: string; name: string; color: "team-a" | "team-b" };
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
  color: "team-a" | "team-b";
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
  const [gpr, setGpr] = useState(tournament?.gamesPerRound ?? 1);
  const [first, setFirst] = useState(tournament?.prizes.first ?? "Trophy + $1000");
  const [second, setSecond] = useState(tournament?.prizes.second ?? "$400");
  const [third, setThird] = useState(tournament?.prizes.third ?? "$200");

  const [rosterTeams, setRosterTeams] = useState<RosterTeam[]>([]);
  const [rosterMembers, setRosterMembers] = useState<RosterMember[]>([]);
  const [slots, setSlots] = useState<SlotTeam[]>([]);

  useEffect(() => {
    const load = async () => {
      const [{ data: t }, { data: m }] = await Promise.all([
        supabase.from("roster_teams").select("id,name,color").order("name"),
        supabase.from("roster_team_members").select("team_id,user_id,display_name,email"),
      ]);
      setRosterTeams((t as RosterTeam[]) ?? []);
      setRosterMembers((m as RosterMember[]) ?? []);
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
        const players = s.playerUserIds.map((uid) => {
          const m = rosterMembers.find((mm) => mm.user_id === uid && mm.team_id === s.rosterTeamId);
          return { email: m?.email ?? "", name: m?.display_name ?? "" };
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
    setTournament({
      id: tournament?.id ?? `trn-${Date.now()}`,
      name, playersPerTeam: pp, gamesPerRound: gpr,
      prizes: { first, second, third },
      teams,
      createdAt: tournament?.createdAt ?? Date.now(),
    });
  };

  const startRound = () => {
    const teams = buildTeams();
    setTournament({
      id: tournament?.id ?? `trn-${Date.now()}`,
      name, playersPerTeam: pp, gamesPerRound: gpr,
      prizes: { first, second, third },
      teams,
      createdAt: tournament?.createdAt ?? Date.now(),
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
  const validSlots = slots.filter((s) => s.rosterTeamId && s.playerUserIds.every(Boolean));
  const canStart = canEdit && validSlots.length >= 2 && validSlots.length % 2 === 0;

  // team ids already used by other slots
  const usedTeamIds = (excludeSlot: string) =>
    new Set(slots.filter((s) => s.slotId !== excludeSlot && s.rosterTeamId).map((s) => s.rosterTeamId));

  return (
    <div className="pt-2 space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-black text-4xl gold-text flex items-center gap-3">
            <Trophy className="h-8 w-8" /> Tournament
          </h1>
          <p className="text-foreground/65 text-sm">
            {canEdit ? "Pick your standing teams, lock in the roster, and let the bracket fly." : "Read-only — sign in as Admin to edit."}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={lock} className="chip-button chip-button-hover">
              <Lock className="h-4 w-4 mr-2" /> Save
            </button>
            <button
              onClick={startRound}
              disabled={!canStart}
              title={canStart ? "" : "Need an even number of fully-filled teams (2+)"}
              className="chip-button chip-button-hover disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "var(--gradient-crimson)", color: "white" }}
            >
              <Play className="h-4 w-4 mr-2" /> Start Round
            </button>
          </div>
        )}
      </div>

      {canEdit && <AdminPromotionPanel />}

      {/* Settings */}
      <section className="ornate-border p-6 grid md:grid-cols-2 gap-5">
        <Field label="Tournament Name">
          <input className="ts-input" value={name} disabled={!canEdit} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Players per Team">
          <input type="number" min={1} max={6} className="ts-input" value={pp} disabled={!canEdit}
                 onChange={(e) => setPp(Math.max(1, +e.target.value))} />
        </Field>
        <Field label="Games per Round">
          <input type="number" min={1} max={9} className="ts-input" value={gpr} disabled={!canEdit}
                 onChange={(e) => setGpr(Math.max(1, +e.target.value))} />
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-black text-2xl gold-text">Teams in this Tournament</h2>
          {canEdit && (
            <button onClick={addSlot} className="chip-button chip-button-hover text-xs">
              <Plus className="h-4 w-4 mr-1" /> Add Team Pair
            </button>
          )}
        </div>

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
            const usedIds = usedTeamIds(s.slotId);
            const roster = rosterMembers.filter((m) => m.team_id === s.rosterTeamId);
            const usedPlayers = new Set(s.playerUserIds.filter(Boolean));
            return (
              <div key={s.slotId} className="rounded-xl p-4 border-2"
                   style={{ borderColor: `var(--${s.color})`, background: "oklch(0.18 0.05 150 / 80%)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <select
                    className="ts-input flex-1 font-display font-bold"
                    value={s.rosterTeamId}
                    disabled={!canEdit}
                    onChange={(e) => updateSlot(s.slotId, { rosterTeamId: e.target.value, playerUserIds: Array(pp).fill("") })}
                  >
                    <option value="">— Select Team —</option>
                    {rosterTeams.map((rt) => (
                      <option key={rt.id} value={rt.id} disabled={usedIds.has(rt.id)}>
                        {rt.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="ts-input w-28"
                    value={s.color}
                    disabled={!canEdit}
                    onChange={(e) => updateSlot(s.slotId, { color: e.target.value as "team-a" | "team-b" })}
                  >
                    <option value="team-a">Red</option>
                    <option value="team-b">Blue</option>
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
                      <select
                        key={i}
                        className="ts-input"
                        value={selected}
                        disabled={disabled}
                        onChange={(e) => {
                          const next = [...s.playerUserIds];
                          next[i] = e.target.value;
                          updateSlot(s.slotId, { playerUserIds: next });
                        }}
                      >
                        <option value="">
                          {s.rosterTeamId ? `— Select Player ${i + 1} —` : "Select a team first"}
                        </option>
                        {roster.map((m) => (
                          <option
                            key={m.user_id}
                            value={m.user_id}
                            disabled={usedPlayers.has(m.user_id) && m.user_id !== selected}
                          >
                            {m.display_name}{m.email ? ` (${m.email})` : ""}
                          </option>
                        ))}
                      </select>
                    );
                  })}
                  {s.rosterTeamId && roster.length === 0 && (
                    <div className="text-[11px] italic text-foreground/50">
                      No members assigned to this team yet.
                    </div>
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
                      <div className="text-sm font-bold" style={{ color: "var(--team-a)" }}>{pair[0]?.name ?? "TBD"}</div>
                      <div className="text-[10px] text-foreground/40 my-1 tracking-widest">VS</div>
                      <div className="text-sm font-bold" style={{ color: "var(--team-b)" }}>{pair[1]?.name ?? "TBD"}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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

function AdminPromotionPanel() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null); setMsg(null);
    const { error } = await supabase.rpc("promote_to_admin", { _email: email });
    setBusy(false);
    if (error) setErr(error.message);
    else { setMsg(`${email} is now an admin.`); setEmail(""); }
  };

  return (
    <section className="ornate-border p-6">
      <h2 className="font-display font-black text-2xl gold-text flex items-center gap-2 mb-1">
        <Shield className="h-6 w-6" /> Admin Controls
      </h2>
      <p className="text-sm text-foreground/65 mb-4">
        Promote a registered user to admin. They must already have an account.
      </p>
      <form onSubmit={submit} className="flex flex-wrap gap-2 items-center">
        <input
          type="email"
          required
          placeholder="user@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="ts-input flex-1 min-w-[240px]"
        />
        <button disabled={busy || !email} type="submit" className="chip-button chip-button-hover">
          <UserPlus className="h-4 w-4 mr-2" />
          {busy ? "Promoting…" : "Make Admin"}
        </button>
      </form>
      {err && <div className="mt-3 text-xs text-red-300 bg-red-950/40 rounded-md p-2">{err}</div>}
      {msg && <div className="mt-3 text-xs text-emerald-200 bg-emerald-950/40 rounded-md p-2">{msg}</div>}
    </section>
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
