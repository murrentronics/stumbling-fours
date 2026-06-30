import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useApp, type Team, type Match } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Trophy, Plus, Trash2, Lock, Shuffle, Medal, Shield, UserPlus, Play } from "lucide-react";

type Member = { id: string; email: string; display_name: string | null };

export const Route = createFileRoute("/tournament")({
  head: () => ({
    meta: [
      { title: "Tournament — Stumbling Fours" },
      { name: "description", content: "Create your tournament, lock in teams, set prizes and bracket size." },
    ],
  }),
  component: TournamentPage,
});

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
  const [teams, setTeams] = useState<Team[]>(tournament?.teams ?? []);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id,email,display_name")
      .order("display_name")
      .then(({ data }) => setMembers((data as Member[]) ?? []));
  }, []);

  const canEdit = isAdmin;

  const addTeam = () => {
    const base = teams.length;
    const makeTeam = (idx: number, color: "team-a" | "team-b"): Team => ({
      id: `t-${Date.now()}-${idx}`,
      name: "",
      color,
      players: Array.from({ length: pp }, () => ({ email: "", name: "" })),
    });
    setTeams([
      ...teams,
      makeTeam(base + 1, "team-a"),
      makeTeam(base + 2, "team-b"),
    ]);
  };

  const updateTeam = (id: string, patch: Partial<Team>) =>
    setTeams(teams.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const removeTeam = (id: string) => setTeams(teams.filter((t) => t.id !== id));

  const lock = () => {
    setTournament({
      id: tournament?.id ?? `trn-${Date.now()}`,
      name, playersPerTeam: pp, gamesPerRound: gpr,
      prizes: { first, second, third },
      teams,
      createdAt: tournament?.createdAt ?? Date.now(),
    });
  };

  const startRound = () => {
    lock();
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
    // keep completed/past matches, replace live/pending
    const past = existingMatches.filter((m) => m.status === "completed");
    setMatches([...newMatches, ...past]);
    navigate({ to: "/tables" });
  };

  const bracket = generateBracket(teams);
  const canStart = canEdit && teams.length >= 2 && teams.length % 2 === 0;

  return (
    <div className="pt-2 space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-black text-4xl gold-text flex items-center gap-3">
            <Trophy className="h-8 w-8" /> Tournament
          </h1>
          <p className="text-foreground/65 text-sm">
            {canEdit ? "Set the rules, lock in your teams, and let the bracket fly." : "Read-only — sign in as Admin to edit."}
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
              title={canStart ? "" : "Need an even number of teams (2+)"}
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
          <h2 className="font-display font-black text-2xl gold-text">Teams</h2>
          {canEdit && (
            <button onClick={addTeam} className="chip-button chip-button-hover text-xs">
              <Plus className="h-4 w-4 mr-1" /> Add Team
            </button>
          )}
        </div>

        {teams.length === 0 && (
          <div className="text-sm text-foreground/60 italic">No teams yet — add the first one.</div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {teams.map((t) => (
            <div key={t.id} className="rounded-xl p-4 border-2"
                 style={{ borderColor: `var(--${t.color})`, background: "oklch(0.18 0.05 150 / 80%)" }}>
              <div className="flex items-center gap-3 mb-3">
                <input
                  className="ts-input flex-1 font-display font-bold"
                  value={t.name}
                  placeholder={`Enter team name (${t.color === "team-a" ? "Red" : "Blue"})`}
                  disabled={!canEdit}
                  onChange={(e) => updateTeam(t.id, { name: e.target.value })}
                />
                <select
                  className="ts-input w-28"
                  value={t.color}
                  disabled={!canEdit}
                  onChange={(e) => updateTeam(t.id, { color: e.target.value as "team-a" | "team-b" })}
                >
                  <option value="team-a">Red</option>
                  <option value="team-b">Blue</option>
                </select>
                {canEdit && (
                  <button onClick={() => removeTeam(t.id)} className="p-2 rounded-md hover:bg-white/5">
                    <Trash2 className="h-4 w-4 text-foreground/60" />
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {Array.from({ length: pp }).map((_, i) => {
                  const p = t.players[i] ?? { email: "", name: "" };
                  // Emails already used elsewhere on any team (so we don't reassign)
                  const used = new Set(
                    teams.flatMap((tt) =>
                      tt.players
                        .map((pl, idx) => (tt.id === t.id && idx === i ? "" : pl.email))
                        .filter(Boolean),
                    ),
                  );
                  return (
                    <div key={i}>
                      <select
                        className="ts-input"
                        value={p.email}
                        disabled={!canEdit}
                        onChange={(e) => {
                          const email = e.target.value;
                          const m = members.find((mm) => mm.email === email);
                          const players = [...t.players];
                          players[i] = {
                            email,
                            name: m?.display_name || (email ? email.split("@")[0] : ""),
                          };
                          updateTeam(t.id, { players });
                        }}
                      >
                        <option value="">— Select Player {i + 1} —</option>
                        {members.map((m) => (
                          <option
                            key={m.id}
                            value={m.email}
                            disabled={used.has(m.email)}
                          >
                            {(m.display_name || m.email.split("@")[0]) + ` (${m.email})`}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bracket preview */}
      {teams.length >= 2 && (
        <section className="ornate-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-black text-2xl gold-text">Bracket Preview</h2>
            <button onClick={() => setTeams(shuffle(teams))} className="chip-button chip-button-hover text-xs"
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

      {/* small style block for inputs */}
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
  // pad to next power of 2
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
