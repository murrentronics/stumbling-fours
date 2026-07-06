import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useApp, winnerIsTeamA, type TeamColor } from "@/lib/store";
import { Trophy, ChevronDown, ChevronUp, Users } from "lucide-react";

export const Route = createFileRoute("/league")({
  head: () => ({
    meta: [
      { title: "Teams — Stumbling Fours" },
      { name: "description", content: "Team standings, records and player rosters." },
    ],
  }),
  component: StandingsPage,
});

type RosterTeam  = { id: string; name: string; color: TeamColor };
type RosterMember = { team_id: string; user_id: string; display_name: string; email: string | null };

function StandingsPage() {
  const allMatches = useApp((s) => s.matches);
  const [rosterTeams,   setRosterTeams]   = useState<RosterTeam[]>([]);
  const [rosterMembers, setRosterMembers] = useState<RosterMember[]>([]);
  const [openIds,       setOpenIds]       = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      const [{ data: t }, { data: m }, { data: adminRoles }] = await Promise.all([
        supabase.from("roster_teams").select("id,name,color").order("name"),
        supabase.from("roster_team_members").select("team_id,user_id,display_name,email"),
        supabase.from("user_roles").select("user_id").eq("role", "admin"),
      ]);
      const adminIds = new Set((adminRoles ?? []).map((r: { user_id: string }) => r.user_id));
      setRosterTeams(((t as RosterTeam[]) ?? []).filter((rt) => rt.name !== "Admin"));
      setRosterMembers(((m as RosterMember[]) ?? []).filter((mm) => !adminIds.has(mm.user_id)));
    };
    void load();

    const ch = supabase
      .channel("standings_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "roster_teams" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "roster_team_members" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // ── Derive stats from completed matches ──────────────────────────────────
  const completed = useMemo(
    () => allMatches.filter((m) => m.status === "completed"),
    [allMatches],
  );

  // wins and losses keyed by roster team NAME (matches embed team name, not roster_team id)
  const stats = useMemo(() => {
    const map = new Map<string, { wins: number; losses: number; tournamentWins: number }>();
    const ensure = (name: string) => {
      if (!map.has(name)) map.set(name, { wins: 0, losses: 0, tournamentWins: 0 });
      return map.get(name)!;
    };

    // Group completed matches by tournament to find tournament winners
    const byTournament = new Map<string, typeof completed>();
    for (const m of completed) {
      const tid = m.tournamentId ?? "legacy";
      if (!byTournament.has(tid)) byTournament.set(tid, []);
      byTournament.get(tid)!.push(m);
    }

    // Tournament win = team that wins the Final (highest round) in that tournament
    for (const [, tMatches] of byTournament) {
      const maxRound = Math.max(...tMatches.map((m) => m.round));
      const finals = tMatches.filter((m) => m.round === maxRound);
      for (const m of finals) {
        const wA = winnerIsTeamA(m);
        const winner = wA ? m.teamA : m.teamB;
        ensure(winner.name).tournamentWins++;
      }
    }

    // Game wins / losses
    for (const m of completed) {
      const wA = winnerIsTeamA(m);
      ensure(m.teamA.name);
      ensure(m.teamB.name);
      if (wA) {
        ensure(m.teamA.name).wins++;
        ensure(m.teamB.name).losses++;
      } else {
        ensure(m.teamB.name).wins++;
        ensure(m.teamA.name).losses++;
      }
    }

    return map;
  }, [completed]);

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Sort teams alphabetically
  const sorted = [...rosterTeams].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="pt-2 space-y-6">
      <div>
        <h1 className="font-display font-black text-4xl gold-text flex items-center gap-3">
          <Users className="h-8 w-8" /> Standings
        </h1>
        <p className="text-foreground/65 text-sm mt-1">
          All teams in the league — tap to see the roster.
        </p>
      </div>

      {sorted.length === 0 && (
        <div className="ornate-border p-10 text-center text-foreground/55 text-sm">
          No teams yet. Check back once teams are set up.
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((team) => {
          const members = rosterMembers
            .filter((m) => m.team_id === team.id)
            .sort((a, b) => a.display_name.localeCompare(b.display_name));
          const s = stats.get(team.name) ?? { wins: 0, losses: 0, tournamentWins: 0 };
          const isOpen = openIds.has(team.id);

          return (
            <div
              key={team.id}
              className="rounded-xl border-2 overflow-hidden"
              style={{ borderColor: `var(--${team.color})`, background: "oklch(0.18 0.05 150 / 80%)" }}
            >
              {/* ── Header ── */}
              <div className="px-5 pt-4 pb-2">
                <div className="flex items-start justify-between gap-3">
                  {/* Left: team name + stats */}
                  <div className="min-w-0">
                    <div className="font-display font-black text-xl truncate"
                         style={{ color: `var(--${team.color})` }}>
                      {team.name}
                    </div>
                    <div className="flex items-center flex-wrap gap-2 mt-1.5">
                      {/* Tournament wins */}
                      {s.tournamentWins > 0 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase"
                              style={{ background: "var(--gradient-gold)", color: "oklch(0.18 0.05 150)" }}>
                          <Trophy className="h-3 w-3" />
                          {s.tournamentWins} {s.tournamentWins === 1 ? "Tournament" : "Tournaments"}
                        </span>
                      )}
                      {/* Games W/L */}
                      <span className="text-[11px] font-bold text-foreground/60">
                        <span className="text-emerald-400">{s.wins}W</span>
                        {" · "}
                        <span className="text-red-400">{s.losses}L</span>
                      </span>
                      {/* Member count */}
                      <span className="text-[10px] text-foreground/40 uppercase tracking-widest">
                        {members.length} member{members.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Chevron toggle ── */}
              <button
                onClick={() => toggle(team.id)}
                className="w-full flex justify-center items-center py-1.5 hover:bg-white/5 transition"
                style={{ borderTop: isOpen ? `1px solid oklch(0.83 0.16 88 / 15%)` : "none" }}
                aria-label={isOpen ? "Collapse" : "Expand"}
              >
                {isOpen
                  ? <ChevronUp className="h-4 w-4 text-foreground/40" />
                  : <ChevronDown className="h-4 w-4 text-foreground/40" />}
              </button>

              {/* ── Expandable roster ── */}
              {isOpen && (
                <div
                  className="px-5 pb-4 pt-2 space-y-1.5"
                  style={{ borderTop: `1px solid oklch(0.83 0.16 88 / 15%)` }}
                >
                  {members.length === 0 ? (
                    <div className="text-xs italic text-foreground/40">No members yet.</div>
                  ) : (
                    members.map((m) => (
                      <div key={m.user_id}
                           className="flex items-center gap-2.5 rounded-md px-3 py-2"
                           style={{ background: "oklch(0.20 0.06 150)" }}>
                        <div className="w-2 h-2 rounded-full flex-shrink-0"
                             style={{ background: `var(--${team.color})` }} />
                        <span className="text-sm font-bold">{m.display_name}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
