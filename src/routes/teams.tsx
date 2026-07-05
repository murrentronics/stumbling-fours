import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Users, Plus, Trash2, UserMinus, Shield, Search, X, ChevronDown, ChevronUp } from "lucide-react";
import { type TeamColor, TEAM_COLORS } from "@/lib/store";

export const Route = createFileRoute("/teams")({
  head: () => ({
    meta: [
      { title: "Teams — Stumbling Fours" },
      { name: "description", content: "Create and manage the standing teams for your All Fours league." },
    ],
  }),
  component: TeamsPage,
});

type RosterTeam = { id: string; name: string; color: TeamColor };
type Member = { team_id: string; user_id: string; display_name: string; email: string | null };
type Profile = { id: string; email: string; display_name: string | null };

function TeamsPage() {
  const { isAdmin, loading } = useAuth();
  const [teams, setTeams] = useState<RosterTeam[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState<TeamColor>("team-a");
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    const [{ data: t }, { data: m }, { data: p }, { data: adminRoles }] = await Promise.all([
      supabase.from("roster_teams").select("*").order("created_at"),
      supabase.from("roster_team_members").select("*"),
      supabase.from("profiles").select("id,email,display_name").order("display_name"),
      supabase.from("user_roles").select("user_id").eq("role", "admin"),
    ]);
    const adminIds = new Set((adminRoles ?? []).map((r: { user_id: string }) => r.user_id));

    // Auto-remove any admin who was previously assigned to a team
    const adminMembers = ((m as Member[]) ?? []).filter((mm) => adminIds.has(mm.user_id));
    if (adminMembers.length > 0) {
      await Promise.all(
        adminMembers.map((mm) =>
          supabase.from("roster_team_members").delete().eq("user_id", mm.user_id)
        )
      );
    }

    const nonAdminProfiles = ((p as Profile[]) ?? []).filter((pr) => !adminIds.has(pr.id));
    const nonAdminMembers = ((m as Member[]) ?? []).filter((mm) => !adminIds.has(mm.user_id));
    setTeams(((t as RosterTeam[]) ?? []).filter((team) => team.name !== 'Admin'));
    setMembers(nonAdminMembers);
    setProfiles(nonAdminProfiles);
  };

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("teams_page_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "roster_teams" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "roster_team_members" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // If the currently selected color becomes taken (e.g. after teams load), auto-pick the next free one
  useEffect(() => {
    const takenColors = new Set(teams.map((t) => t.color));
    if (takenColors.has(color)) {
      const next = TEAM_COLORS.find((tc) => !takenColors.has(tc.value));
      if (next) setColor(next.value);
    }
  }, [teams]);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    const { error } = await supabase.from("roster_teams").insert({ name: trimmed, color });
    if (error) { setErr(error.message); return; }
    setName("");
    // auto-advance to next untaken color (teams will reload via realtime, but pre-empt here)
    const takenAfter = new Set([...teams.map((t) => t.color), color]);
    const next = TEAM_COLORS.find((tc) => !takenAfter.has(tc.value));
    if (next) setColor(next.value);
  };

  const removeTeam = async (id: string) => {
    if (!confirm("Delete this team and all its members?")) return;
    await supabase.from("roster_teams").delete().eq("id", id);
  };

  const assign = async (teamId: string, userId: string) => {
    const prof = profiles.find((p) => p.id === userId);
    if (!prof) return;
    // Remove any existing membership for this user first (single-team constraint)
    await supabase.from("roster_team_members").delete().eq("user_id", userId);
    await supabase.from("roster_team_members").insert({
      team_id: teamId,
      user_id: userId,
      display_name: prof.display_name || prof.email.split("@")[0],
      email: prof.email,
    });
  };

  const unassign = async (teamId: string, userId: string) => {
    await supabase.from("roster_team_members").delete().eq("team_id", teamId).eq("user_id", userId);
  };

  const assignedUserIds = new Set(members.map((m) => m.user_id));

  const [teamSearch, setTeamSearch] = useState("");
  const [openTeams, setOpenTeams] = useState<Set<string>>(new Set());
  const toggleTeam = (id: string) =>
    setOpenTeams((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));
  const filteredTeams = teamSearch.trim()
    ? sortedTeams.filter((t) => t.name.toLowerCase().includes(teamSearch.toLowerCase()))
    : sortedTeams;

  return (
    <div className="pt-2 space-y-6">
      <div>
        <h1 className="font-display font-black text-4xl gold-text flex items-center gap-3">
          <Users className="h-8 w-8" /> Teams
        </h1>
        <p className="text-foreground/65 text-sm">
          Build your standing teams. Members can also self-assign at sign-up.
        </p>
      </div>

      <section className="ornate-border p-6">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-5 w-5 text-foreground/70" />
          <h2 className="font-display font-black text-xl gold-text">Create a Team</h2>
        </div>
        <form onSubmit={createTeam} className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <input
              className="ts-input flex-1 min-w-[220px]"
              placeholder="Team name (e.g. Port of Spade)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className="chip-button chip-button-hover">
              <Plus className="h-4 w-4 mr-2" /> Add Team
            </button>
          </div>
          {/* Color swatch picker */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-foreground/50 mb-1.5">Team Colour</div>
            <div className="flex flex-wrap gap-2">
              {TEAM_COLORS.map((tc) => {
                const taken = teams.some((t) => t.color === tc.value);
                if (taken) return null;
                const selected = color === tc.value;
                return (
                  <button
                    key={tc.value}
                    type="button"
                    title={tc.label}
                    onClick={() => setColor(tc.value)}
                    className="w-8 h-8 rounded-full transition-all"
                    style={{
                      background: tc.css,
                      outline: selected ? `3px solid white` : "3px solid transparent",
                      outlineOffset: "2px",
                      boxShadow: selected ? `0 0 10px ${tc.css}` : "none",
                      opacity: 1,
                    }}
                  />
                );
              })}
            </div>
            {color && (
              <div className="mt-1.5 text-xs text-foreground/60">
                Selected: <span style={{ color: TEAM_COLORS.find((c) => c.value === color)?.css }}>{TEAM_COLORS.find((c) => c.value === color)?.label}</span>
              </div>
            )}
          </div>
        </form>
        {err && <div className="mt-2 text-xs text-red-300 bg-red-950/40 rounded-md p-2">{err}</div>}
      </section>

      {teams.length === 0 && (
        <div className="ornate-border p-8 text-center text-foreground/60 text-sm">
          No teams yet — add one above to get started.
        </div>
      )}

      {teams.length > 0 && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40 pointer-events-none" />
            <input
              className="ts-input"
              style={{ paddingLeft: "2.25rem", paddingRight: teamSearch ? "2.25rem" : undefined }}
              placeholder="Search teams…"
              value={teamSearch}
              onChange={(e) => setTeamSearch(e.target.value)}
            />
            {teamSearch && (
              <button
                type="button"
                onClick={() => setTeamSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/70 transition"
                title="Clear"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="mt-2 text-xs text-foreground/50">
            {teamSearch.trim()
              ? <>{filteredTeams.length} of {teams.length} team{teams.length === 1 ? "" : "s"}</>
              : <>{teams.length} team{teams.length === 1 ? "" : "s"} total</>
            }
          </div>
        </>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {filteredTeams.length === 0 && teams.length > 0 && (
          <div className="col-span-full text-center text-sm text-foreground/50 py-4">No teams match.</div>
        )}
        {filteredTeams.map((t) => {
          const roster = members.filter((m) => m.team_id === t.id);
          const isOpen = openTeams.has(t.id);
          return (
            <div
              key={t.id}
              className="rounded-xl border-2 overflow-hidden"
              style={{ borderColor: `var(--${t.color})`, background: "oklch(0.18 0.05 150 / 80%)" }}
            >
              {/* ── Accordion header ── */}
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <div>
                  <div className="font-display font-black text-xl" style={{ color: `var(--${t.color})` }}>
                    {t.name}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-foreground/50 mt-0.5">
                    {roster.length} member{roster.length === 1 ? "" : "s"}
                  </div>
                </div>
                <button onClick={() => removeTeam(t.id)} className="p-2 rounded-md hover:bg-white/5">
                  <Trash2 className="h-4 w-4 text-foreground/60" />
                </button>
              </div>

              {/* ── Chevron toggle centered at bottom of header ── */}
              <button
                onClick={() => toggleTeam(t.id)}
                className="w-full flex justify-center items-center py-1.5 hover:bg-white/5 transition"
                style={{ borderTop: isOpen ? `1px solid oklch(0.83 0.16 88 / 15%)` : "none" }}
                aria-label={isOpen ? "Collapse" : "Expand"}
              >
                {isOpen
                  ? <ChevronUp className="h-4 w-4 text-foreground/40" />
                  : <ChevronDown className="h-4 w-4 text-foreground/40" />}
              </button>

              {/* ── Expandable body ── */}
              {isOpen && (
                <div
                  className="px-5 pb-5 pt-3 space-y-3"
                  style={{ borderTop: `1px solid oklch(0.83 0.16 88 / 15%)` }}
                >
                  <div className="space-y-1.5">
                    {roster.length === 0 && (
                      <div className="text-xs italic text-foreground/45">No members yet.</div>
                    )}
                    {roster.map((m) => (
                      <div key={m.user_id} className="flex items-center justify-between rounded-md px-3 py-2"
                           style={{ background: "oklch(0.20 0.06 150)" }}>
                        <div className="text-sm">
                          <div className="font-bold">{m.display_name}</div>
                          <div className="text-[10px] text-foreground/50">{m.email}</div>
                        </div>
                        <button onClick={() => unassign(t.id, m.user_id)}
                                className="p-1.5 rounded-md hover:bg-white/5" title="Remove">
                          <UserMinus className="h-4 w-4 text-foreground/60" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <select
                    className="ts-input"
                    value=""
                    onChange={(e) => e.target.value && assign(t.id, e.target.value)}
                  >
                    <option value="">+ Assign a member…</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id} disabled={assignedUserIds.has(p.id)}>
                        {(p.display_name || p.email.split("@")[0]) + ` (${p.email})`}
                        {assignedUserIds.has(p.id) ? " · assigned" : ""}
                      </option>
                    ))}
                  </select>
                  {roster.length > 0 && (
                    <div className="text-[10px] text-foreground/40 text-center">
                      {roster.length} member{roster.length === 1 ? "" : "s"} · up to 2 can sit at any one table
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

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
        }
        .ts-input:focus { border-color: oklch(0.83 0.16 88); box-shadow: 0 0 0 3px oklch(0.83 0.16 88 / 25%); }
      `}</style>
    </div>
  );
}
